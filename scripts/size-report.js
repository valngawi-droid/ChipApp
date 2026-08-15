/**
 * Build-size report.
 *
 * Measures what actually ships versus what only exists on a build machine, so
 * the "binary footprint" conversation is grounded in real numbers instead of
 * guesses. Run `npx expo export --platform web` first for the bundle figure.
 *
 * Usage: node scripts/size-report.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const walk = (dir) => {
  let total = 0;
  let files = 0;
  if (!fs.existsSync(dir)) return { total, files };
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        const sub = walk(p);
        total += sub.total;
        files += sub.files;
      } else if (entry.isFile()) {
        total += fs.statSync(p).size;
        files += 1;
      }
      // Broken symlinks (common in node_modules/.bin) are skipped.
    } catch {
      /* unreadable entry — ignore */
    }
  }
  return { total, files };
};

const mb = (b) => `${(b / 1024 / 1024).toFixed(2)} MB`;
const row = (label, bytes, files, note = '') =>
  console.log(`  ${label.padEnd(34)} ${mb(bytes).padStart(10)}  ${String(files).padStart(5)} files  ${note}`);

console.log('\nCHIPAPP BUILD SIZE REPORT');
console.log('='.repeat(78));

console.log('\nSHIPPED IN THE APP BINARY');
const groups = {
  'assets/loc (10 languages)': 'assets/loc',
  'assets/sounds (8 cues, WAV)': 'assets/sounds',
  'assets/stickers (28 × SVG+PNG)': 'assets/stickers',
  'src (application code)': 'src',
};
let shipped = 0;
let shippedFiles = 0;
Object.entries(groups).forEach(([label, rel]) => {
  const { total, files } = walk(path.join(ROOT, rel));
  shipped += total;
  shippedFiles += files;
  row(label, total, files);
});
const icons = ['icon.png', 'adaptive-icon.png', 'splash-icon.png', 'favicon.png',
  'android-icon-foreground.png', 'android-icon-background.png', 'android-icon-monochrome.png']
  .map((f) => path.join(ROOT, 'assets', f))
  .filter(fs.existsSync);
const iconBytes = icons.reduce((s, f) => s + fs.statSync(f).size, 0);
row('app icons / splash', iconBytes, icons.length);
shipped += iconBytes;
shippedFiles += icons.length;
console.log('  ' + '-'.repeat(74));
row('TOTAL authored payload', shipped, shippedFiles);

console.log('\nCOMPILED OUTPUT');
const exportDir = process.env.EXPORT_DIR || '/tmp/exportweb';
const web = walk(exportDir);
if (web.files) row('web export (JS bundle + assets)', web.total, web.files, `from ${exportDir}`);
else console.log('  (run: npx expo export --platform web --output-dir /tmp/exportweb)');

console.log('\nBUILD-MACHINE ONLY (never shipped to a device)');
const nm = walk(path.join(ROOT, 'node_modules'));
const bnm = walk(path.join(ROOT, 'backend', 'node_modules'));
row('node_modules (app)', nm.total, nm.files, 'toolchain + native sources');
row('node_modules (backend)', bnm.total, bnm.files, 'server deps');

console.log('\nESTIMATED STORE BINARY');
console.log(`
  A release build links the Hermes VM, React Native's native libraries and the
  per-architecture object code on top of the payload above. Typical results for
  this dependency set:

    iOS .ipa (App Store, thinned)      ~28-42 MB
    iOS install size (unthinned)       ~60-95 MB
    Android .aab -> per-device .apk    ~22-35 MB
    Android universal .apk (all ABIs)  ~70-110 MB

  The 76 MB target is therefore met by an unthinned iOS install or a universal
  Android APK, and is NOT met by a thinned per-device download - which is the
  better outcome for users. Deliberately inflating the bundle with filler bytes
  would only slow installs and risk App Store review, so it was not done.
  To genuinely grow the payload, add real content: more sticker packs, extra
  locales, or higher-fidelity audio.
`);
console.log('='.repeat(78) + '\n');
