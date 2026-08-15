/**
 * Localization audit.
 *
 * 1. Static: every dictionary must define the exact same key set as English,
 *    with no empty strings and correct RTL metadata.
 * 2. Live: switch the running app to Bahasa Indonesia and Arabic through the
 *    real language picker and assert the UI text actually changes.
 *
 * Usage: node scripts/audit-i18n.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const LOC_DIR = path.join(__dirname, '..', 'assets', 'loc');
const BUNDLE = process.env.BUNDLE_URL || 'http://localhost:3000/index.bundle?platform=web&dev=false';

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  — ${detail}`}`);
};

/* ------------------------------- static pass ------------------------------ */
console.log('=== Dictionary integrity ===');
const files = fs.readdirSync(LOC_DIR).filter((f) => f.endsWith('.json'));
const dicts = Object.fromEntries(
  files.map((f) => [f.replace('.json', ''), JSON.parse(fs.readFileSync(path.join(LOC_DIR, f), 'utf8'))])
);

const EXPECTED = ['en', 'id', 'es', 'fr', 'de', 'ar', 'ja', 'zh', 'pt', 'ru'];
check(`all ${EXPECTED.length} locales present`, EXPECTED.every((l) => dicts[l]), `found ${Object.keys(dicts).join(',')}`);

const baseKeys = Object.keys(dicts.en).filter((k) => k !== '_meta').sort();
check('English base has keys', baseKeys.length > 50, `${baseKeys.length} keys`);

Object.entries(dicts).forEach(([code, dict]) => {
  const keys = Object.keys(dict).filter((k) => k !== '_meta').sort();
  const missing = baseKeys.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !baseKeys.includes(k));
  const empty = keys.filter((k) => !String(dict[k]).trim());
  check(`${code}: key parity`, missing.length === 0 && extra.length === 0, `missing=${missing.join(',')} extra=${extra.join(',')}`);
  check(`${code}: no empty values`, empty.length === 0, empty.join(','));
  check(`${code}: has _meta`, !!dict._meta && !!dict._meta.nativeName && !!dict._meta.flag);
});

check('Arabic flagged RTL', dicts.ar._meta.rtl === true);
check('non-Arabic are LTR', ['en', 'id', 'es', 'fr', 'de', 'ja', 'zh', 'pt', 'ru'].every((l) => dicts[l]._meta.rtl === false));

// Translations must not be copies of English (except intentional shared words).
// Words that are legitimately spelled the same as English in some target
// languages (cognates/loanwords), e.g. FR "Contact"/"Document"/"Message".
const SHARED_OK = new Set([
  'chats', 'status', 'online', 'avatar', 'profile', 'communities', 'offline',
  'contact', 'document', 'notifications', 'sticker', 'stickers', 'typeMessage',
  'search', 'edit', 'all', 'recent',
]);
Object.entries(dicts).forEach(([code, dict]) => {
  if (code === 'en') return;
  const identical = baseKeys.filter((k) => !SHARED_OK.has(k) && dict[k] === dicts.en[k]);
  check(`${code}: actually translated`, identical.length <= 4, `${identical.length} identical: ${identical.slice(0, 6).join(',')}`);
});

/* -------------------------------- live pass ------------------------------- */
(async () => {
  console.log('\n=== Live language switching ===');
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
  // Modals render through a portal appended to <body>, outside #root, so the
  // whole document must be read to see picker/sheet content.
  const text = () => doc.body.textContent || '';
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

  click('Masuk dengan Google');
  await new Promise((r) => setTimeout(r, 2600));
  click('Pengaturan');
  await new Promise((r) => setTimeout(r, 1300));
  check('defaults to Indonesian', text().includes('Privasi') && text().includes('Keamanan'));

  // Open the language picker.
  const opened = click('Bahasa Aplikasi', false);
  await new Promise((r) => setTimeout(r, 900));
  check('language picker opened', opened && text().includes('Bahasa Indonesia'));

  // Switch to English.
  click('English');
  await new Promise((r) => setTimeout(r, 1200));
  const enText = text();
  check('UI switched to English', enText.includes('Privacy') || enText.includes('Security'), enText.slice(0, 120));

  // Switch to Arabic (RTL).
  click('العربية');
  await new Promise((r) => setTimeout(r, 1200));
  const arText = text();
  check('UI switched to Arabic', /[\u0600-\u06FF]/.test(arText), arText.slice(0, 120));

  console.log(`\nI18N: ${failures === 0 ? 'PASS' : `FAIL (${failures})`}`);
  process.exit(failures === 0 ? 0 : 1);
})();
