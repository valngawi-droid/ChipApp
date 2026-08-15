/**
 * Untranslated-string sweep.
 *
 * Renders the app in its default (Indonesian) locale, walks every tab, and
 * flags any visible text that still matches a known English-only word. This
 * catches literals that were never routed through t().
 *
 * Usage: node scripts/audit-untranslated.js
 */
const { JSDOM, VirtualConsole } = require('jsdom');

const BUNDLE = process.env.BUNDLE_URL || 'http://localhost:3000/index.bundle?platform=web&dev=false';

// English words that must not survive in the Indonesian UI chrome.
const FORBIDDEN = [
  'Edit', 'Done', 'Cancel', 'Delete', 'Search', 'Settings', 'Chats', 'Calls',
  'Communities', 'Privacy', 'Security', 'Language', 'Appearance', 'Light', 'Dark',
  'Read Receipts', 'Security Notifications', 'Safety Number', 'Create Call Link',
  'Recent', 'Missed', 'Incoming', 'Outgoing', 'Sign Out', 'My Status', 'Channels',
  'New Community', 'Storage and Data', 'Chat Wallpaper', 'Two-Step Verification',
  'Starred Messages', 'Linked Devices', 'Help', 'Invite a Friend', 'Account',
  'Notifications', 'Made with love', 'System Default', 'Stickers', 'No results',
];

// Proper nouns / brand names / seeded content that are meant to stay as-is.
const ALLOWED = [
  'ChipApp', 'Google', 'Nadia Pratiwi', 'Design Team', 'Mom', 'Alexander Chen',
  'Keluarga Besar', 'Sofia Martínez', 'Dev Standup', 'Rizky', 'Putri', 'Om Budi',
  'Tech Daily', 'Jakarta Traffic', 'ChipApp Builders', 'Backend', 'Figma',
  'Warga RW 08', 'Build', 'English', 'Español', 'Français', 'Deutsch', 'Português',
  'Русский', 'العربية', '日本語', '简体中文', 'Bahasa Indonesia', 'Marketplace',
];

(async () => {
  const code = await (await fetch(BUNDLE)).text();
  const vc = new VirtualConsole();
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost:3000/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc,
  });
  const { window } = dom;
  window.matchMedia = (q) => ({ matches:false, media:q, onchange:null, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, dispatchEvent(){return false;} });
  window.scrollTo = () => {};
  window.fetch = (i, init) => fetch(String(i).startsWith('http') ? i : `http://localhost:3000${i}`, init);
  window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
  global.ResizeObserver = window.ResizeObserver;
  window.document.fonts = { load: () => Promise.resolve([]), check: () => true, ready: Promise.resolve(), add() {} };
  process.on('unhandledRejection', () => {});

  window.eval(code);
  await new Promise((r) => setTimeout(r, 2500));

  const doc = window.document;
  const click = (needle, exact = true) => {
    const nodes = [...doc.querySelectorAll('div,span,button,a')].reverse();
    const t = nodes.find((n) => {
      const s = (n.textContent || '').trim();
      return exact ? s === needle : s.includes(needle);
    });
    if (!t) return false;
    const o = { bubbles: true, cancelable: true, view: window };
    t.dispatchEvent(new window.MouseEvent('mousedown', o));
    t.dispatchEvent(new window.MouseEvent('mouseup', o));
    t.dispatchEvent(new window.MouseEvent('click', o));
    return true;
  };

  // Collect the leaf text of every screen.
  const seen = new Map();
  const collect = (screen) => {
    [...doc.querySelectorAll('div,span')].forEach((n) => {
      if (n.children.length) return; // leaves only
      const s = (n.textContent || '').trim();
      if (!s || s.length > 90) return;
      if (!seen.has(s)) seen.set(s, screen);
    });
  };

  collect('login');
  click('Masuk dengan Google');
  await new Promise((r) => setTimeout(r, 2600));
  collect('chats');

  for (const [tab, label] of [['status', 'Pembaruan'], ['calls', 'Panggilan'], ['communities', 'Komunitas'], ['settings', 'Pengaturan']]) {
    click(label);
    await new Promise((r) => setTimeout(r, 1200));
    collect(tab);
  }

  // Chat room
  click('Pengaturan'); await new Promise((r) => setTimeout(r, 600));
  click('Obrolan'); await new Promise((r) => setTimeout(r, 900));
  click('Nadia Pratiwi', false);
  await new Promise((r) => setTimeout(r, 1600));
  collect('chatroom');

  const hits = [];
  for (const [text, screen] of seen) {
    if (ALLOWED.some((a) => text.includes(a))) continue;
    const bad = FORBIDDEN.find((w) => new RegExp(`(^|\\s)${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s)`, 'i').test(text));
    if (bad) hits.push({ text, screen, bad });
  }

  console.log(`scanned ${seen.size} unique strings across 7 screens`);
  if (hits.length) {
    console.log(`\n${hits.length} untranslated string(s):`);
    hits.forEach((h) => console.log(`  [${h.screen}] "${h.text}"  (matched "${h.bad}")`));
  }
  console.log(`\nUNTRANSLATED: ${hits.length === 0 ? 'PASS' : 'FAIL'}`);
  process.exit(hits.length === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
