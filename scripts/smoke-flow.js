/**
 * Interaction smoke test: drives the real bundle through sign-in and asserts
 * that the authenticated shell (tab bar + chat list) actually renders.
 *
 * Usage: node scripts/smoke-flow.js [bundleUrl]
 */
const { JSDOM, VirtualConsole } = require('jsdom');

const URL_ = process.argv[2] || 'http://localhost:3000/index.bundle?platform=web&dev=false';

const clickByText = (window, needle) => {
  const nodes = [...window.document.querySelectorAll('div,span,button,a')];
  const target = nodes.reverse().find((n) => (n.textContent || '').trim() === needle);
  if (!target) return false;
  const opts = { bubbles: true, cancelable: true, view: window };
  target.dispatchEvent(new window.MouseEvent('mousedown', opts));
  target.dispatchEvent(new window.MouseEvent('mouseup', opts));
  target.dispatchEvent(new window.MouseEvent('click', opts));
  return true;
};

(async () => {
  const code = await (await fetch(URL_)).text();

  const errors = [];
  const vc = new VirtualConsole();
  const fmt = (...a) => a.map(String).join(' ');
  vc.on('error', (...a) => errors.push(fmt(...a)));
  vc.on('jsdomError', (e) => errors.push(e.stack || String(e)));

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
  window.fetch = (input, init) => fetch(String(input).startsWith('http') ? input : `http://localhost:3000${input}`, init);
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  global.ResizeObserver = window.ResizeObserver;

  window.eval(code);
  await new Promise((r) => setTimeout(r, 2500));

  const root = window.document.getElementById('root');
  const step = (label) => console.log(`[${label}] ${JSON.stringify((root.textContent || '').slice(0, 260))}`);
  step('login');

  const clicked = clickByText(window, 'Sign in with Google');
  console.log(`clicked sign-in: ${clicked}`);
  await new Promise((r) => setTimeout(r, 3500));
  step('after-auth');

  const text = root.textContent || '';
  const checks = {
    'tab bar present': /Chats/.test(text) && /Settings/.test(text) && /Communities/.test(text),
    'chat list rendered': /Nadia Pratiwi/.test(text),
    'unread/preview content': /Design Team|Mom/.test(text),
  };
  Object.entries(checks).forEach(([k, v]) => console.log(`${v ? 'PASS' : 'FAIL'} — ${k}`));

  const real = errors.filter((e) => !/Not implemented|Could not parse CSS/i.test(e));
  if (real.length) {
    console.log(`\n--- ${real.length} error(s) ---`);
    real.slice(0, 6).forEach((e) => console.log(e.slice(0, 700), '\n'));
  }

  const ok = Object.values(checks).every(Boolean) && real.length === 0;
  console.log(`\nFLOW: ${ok ? 'PASS' : 'FAIL'}`);
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error('harness failed:', e);
  process.exit(1);
});
