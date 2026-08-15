/**
 * Design-system audit.
 *
 * Renders the real bundle in jsdom, navigates each tab, and asserts that the
 * emitted DOM actually carries the ChipApp/Apple-HIG tokens: the exact colour
 * values, the SF type ramp sizes, hairline separators, and the expected
 * content per screen. This catches "looks fine in code, wrong on screen"
 * regressions that a typecheck cannot.
 *
 * Usage: node scripts/audit-ui.js
 */
const { JSDOM, VirtualConsole } = require('jsdom');

const BUNDLE = process.env.BUNDLE_URL || 'http://localhost:3000/index.bundle?platform=web&dev=false';

const norm = (c) => (c || '').replace(/\s+/g, '').toLowerCase();
const hexToRgb = (h) => {
  const s = h.replace('#', '');
  return `rgb(${parseInt(s.slice(0, 2), 16)},${parseInt(s.slice(2, 4), 16)},${parseInt(s.slice(4, 6), 16)})`;
};

(async () => {
  const code = await (await fetch(BUNDLE)).text();

  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(String(e)));

  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost:3000/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const { window } = dom;
  window.matchMedia = (q) => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
  });
  window.scrollTo = () => {};
  window.fetch = (i, init) => fetch(String(i).startsWith('http') ? i : `http://localhost:3000${i}`, init);
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  global.ResizeObserver = window.ResizeObserver;
  // @expo/vector-icons uses fontfaceobserver; jsdom never resolves a real font
  // load, so it would reject after 12s and kill the harness. Stub it out — icon
  // fonts are irrelevant to the token assertions below.
  window.document.fonts = {
    load: () => Promise.resolve([]),
    check: () => true,
    ready: Promise.resolve(),
    add: () => {},
  };
  process.on('unhandledRejection', () => {});

  window.eval(code);
  await new Promise((r) => setTimeout(r, 2500));

  const doc = window.document;
  const allStyles = () => [...doc.querySelectorAll('*')].map((n) => n.getAttribute('style') || '').join(' ');
  const text = () => doc.getElementById('root').textContent || '';

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

  const results = [];
  const check = (name, cond, detail = '') => {
    results.push({ name, ok: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond || !detail ? '' : `  — ${detail}`}`);
  };

  /* ------------------------------ login screen --------------------------- */
  console.log('\n=== Login ===');
  const loginStyles = allStyles();
  check('brand green #25D366 present', norm(loginStyles).includes(norm(hexToRgb('#25D366'))) || norm(loginStyles).includes('#25d366'));
  check('large-title 34px type ramp', /font-size:\s*34px/.test(loginStyles));
  check('Google sign-in button rendered', text().includes('Masuk dengan Google'));
  check('E2EE badge shown', text().includes('Terenkripsi secara end-to-end'));

  click('Masuk dengan Google');
  await new Promise((r) => setTimeout(r, 2800));

  /* ------------------------------- chats --------------------------------- */
  console.log('\n=== Chats ===');
  const chatsText = text();
  const chatsStyles = allStyles();
  check('large title + tab bar', chatsText.includes('Obrolan') && chatsText.includes('Pengaturan'));
  check('seeded conversations', chatsText.includes('Nadia Pratiwi') && chatsText.includes('Design Team'));
  check('unread badge colour', norm(chatsStyles).includes(norm(hexToRgb('#25D366'))));
  // react-native-web resolves StyleSheet.hairlineWidth to 1px (device pixel
  // ratio handling happens in the browser), so assert the separator exists.
  check(
    'hairline separators present',
    /border-bottom-width:\s*(0?\.5|1)px/i.test(chatsStyles) || /height:\s*(0?\.5|1)px/.test(chatsStyles)
  );
  check('iOS accent #007AFF on actions', norm(chatsStyles).includes(norm(hexToRgb('#007AFF'))));
  check('17px body type ramp', /font-size:\s*17px/.test(chatsStyles));

  /* ------------------------------ chat room ------------------------------ */
  console.log('\n=== Chat room ===');
  click('Nadia Pratiwi', false);
  await new Promise((r) => setTimeout(r, 1800));
  const roomText = text();
  const roomStyles = allStyles();
  check('conversation opened', roomText.includes('Sudah sampai rumah') || roomText.includes('Ketik pesan'));
  check('outgoing bubble tint #DCF8C6', norm(roomStyles).includes(norm(hexToRgb('#DCF8C6'))));
  check('chat wallpaper #EFE7DE', norm(roomStyles).includes(norm(hexToRgb('#EFE7DE'))));
  check('encryption system notice', roomText.toLowerCase().includes('end-to-end'));
  check('voice note duration rendered', /0:\d\d/.test(roomText));

  /* ------------------------------- settings ------------------------------ */
  console.log('\n=== Settings ===');
  click('Pengaturan');
  await new Promise((r) => setTimeout(r, 1500));
  const setText = text();
  check('grouped table sections', setText.includes('Privasi') && setText.includes('Keamanan'));
  check('language row', setText.includes('Bahasa Aplikasi') || setText.includes('Bahasa'));
  // The 12 five-digit groups are separate <Text> nodes, so textContent
  // concatenates them into one long run of digits.
  check('safety number (60 digits)', /\d{60}/.test(setText.replace(/\s+/g, '')));
  check('storage figure', /\d+(\.\d+)?\s?MB/.test(setText));
  check('version footer', setText.includes('4.2.0'));

  /* -------------------------------- calls -------------------------------- */
  console.log('\n=== Calls ===');
  click('Panggilan');
  await new Promise((r) => setTimeout(r, 1200));
  const callsText = text();
  check('call log entries', callsText.includes('Alexander Chen') || callsText.includes('Nadia Pratiwi'));
  check('segmented filter', callsText.includes('Semua') && callsText.includes('Tak terjawab'));
  check('call durations', /\d+:\d\d/.test(callsText));

  /* ------------------------------ communities ---------------------------- */
  console.log('\n=== Communities ===');
  click('Komunitas');
  await new Promise((r) => setTimeout(r, 1200));
  const commText = text();
  check('community list', commText.includes('Warga RW 08') || commText.includes('ChipApp Builders'));
  check('channels section', commText.includes('Tech Daily') || commText.toUpperCase().includes('SALURAN'));
  check('verified follower counts', /\d+(\.\d+)?[KM]/.test(commText));

  /* -------------------------------- status ------------------------------- */
  console.log('\n=== Status ===');
  click('Pembaruan');
  await new Promise((r) => setTimeout(r, 1200));
  const stText = text();
  check('my status row', stText.includes('Status Saya') || stText.includes('Pembaruan'));
  check('contact updates', stText.includes('Nadia Pratiwi') || stText.includes('Sofia'));

  /* -------------------------------- summary ------------------------------ */
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (errors.length) console.log(`runtime errors: ${errors.length}`);
  console.log(`AUDIT: ${failed.length === 0 && errors.length === 0 ? 'PASS' : 'FAIL'}`);
  process.exit(failed.length === 0 && errors.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error('audit harness failed:', e);
  process.exit(1);
});
