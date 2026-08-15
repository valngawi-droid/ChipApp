/**
 * Headless render smoke test.
 *
 * Downloads the real Metro web bundle and executes it inside jsdom, so any
 * import-time crash, bad hook usage, or render-time exception fails CI instead
 * of only showing up in the browser. Chrome is unavailable in this sandbox, so
 * jsdom stands in for it.
 *
 * Usage: node scripts/smoke-web.js [url]
 */
const { JSDOM, VirtualConsole } = require('jsdom');

const URL_ = process.argv[2] || 'http://localhost:3000/index.bundle?platform=web&dev=true';

(async () => {
  const res = await fetch(URL_);
  if (!res.ok) throw new Error(`bundle fetch failed: ${res.status}`);
  const code = await res.text();
  console.log(`bundle: ${(code.length / 1e6).toFixed(2)} MB`);

  const errors = [];
  const warnings = [];
  const virtualConsole = new VirtualConsole();
  const fmt = (...args) => args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
  virtualConsole.on('error', (...a) => errors.push(fmt(...a)));
  virtualConsole.on('warn', (...a) => warnings.push(fmt(...a)));
  virtualConsole.on('jsdomError', (e) => errors.push(e.stack || String(e)));

  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="root"></div></body></html>',
    {
      url: 'http://localhost:3000/',
      runScripts: 'outside-only',
      pretendToBeVisual: true,
      virtualConsole,
    }
  );

  const { window } = dom;
  // Minimal browser APIs react-native-web / Expo touch that jsdom lacks.
  window.matchMedia = window.matchMedia || ((q) => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
  }));
  window.scrollTo = () => {};
  // jsdom ships no ResizeObserver; react-native-web's onLayout needs one.
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  global.ResizeObserver = window.ResizeObserver;
  window.fetch = fetch;
  if (!window.navigator.geolocation) window.navigator.geolocation = {};

  try {
    window.eval(code);
  } catch (e) {
    errors.push(`EVAL: ${e && e.stack ? e.stack : e}`);
  }

  // Allow effects, timers and the navigation container to settle.
  await new Promise((r) => setTimeout(r, 3000));

  const root = window.document.getElementById('root');
  const html = root ? root.innerHTML : '';
  const text = root ? root.textContent : '';

  console.log(`rendered DOM: ${html.length} chars`);
  console.log(`visible text: ${JSON.stringify(text.slice(0, 400))}`);

  const realErrors = errors.filter(
    (e) => !/Not implemented: HTMLCanvasElement|Could not parse CSS|ReactDOM.render is no longer/i.test(e)
  );
  if (realErrors.length) {
    console.log(`\n--- ${realErrors.length} ERROR(S) ---`);
    realErrors.slice(0, 8).forEach((e) => console.log(e.slice(0, 900), '\n'));
  }
  if (warnings.length) {
    console.log(`\n--- ${warnings.length} warning(s) (first 3) ---`);
    warnings.slice(0, 3).forEach((w) => console.log(w.slice(0, 300)));
  }

  const ok = html.length > 500 && realErrors.length === 0;
  console.log(`\nSMOKE: ${ok ? 'PASS' : 'FAIL'}`);
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error('smoke harness failed:', e);
  process.exit(1);
});
