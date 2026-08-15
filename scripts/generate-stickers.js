/**
 * Generates ChipApp's bundled sticker packs as original SVG vector art.
 *
 * Vectors (rather than multi-resolution PNG rasters) keep the repository small
 * while staying crisp at any density — they are rasterised at build time for
 * the shipping app. All shapes are drawn from scratch here, so there is no
 * third-party artwork licensing to worry about.
 *
 * Usage: node scripts/generate-stickers.js
 */
const fs = require('fs');
const path = require('path');

const outRoot = path.join(__dirname, '..', 'assets', 'stickers');

const svg = (body, bg = 'none') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">` +
  (bg !== 'none' ? `<rect width="512" height="512" rx="96" fill="${bg}"/>` : '') +
  body +
  `</svg>\n`;

/* ---------------------------- Pack 1: Emotions --------------------------- */

const face = (fill, stroke) => `
  <circle cx="256" cy="256" r="210" fill="${fill}" stroke="${stroke}" stroke-width="10"/>`;

const eyes = (type) => {
  switch (type) {
    case 'happy':
      return `<path d="M150 220 q40 -46 80 0" stroke="#2B1B0E" stroke-width="18" fill="none" stroke-linecap="round"/>
              <path d="M282 220 q40 -46 80 0" stroke="#2B1B0E" stroke-width="18" fill="none" stroke-linecap="round"/>`;
    case 'wink':
      return `<path d="M150 218 q40 -44 80 0" stroke="#2B1B0E" stroke-width="18" fill="none" stroke-linecap="round"/>
              <circle cx="322" cy="212" r="22" fill="#2B1B0E"/>`;
    case 'heart':
      return `<path d="M190 190 c18 -22 52 -18 52 12 c0 26 -34 44 -52 62 c-18 -18 -52 -36 -52 -62 c0 -30 34 -34 52 -12z" fill="#FF2D55"/>
              <path d="M322 190 c18 -22 52 -18 52 12 c0 26 -34 44 -52 62 c-18 -18 -52 -36 -52 -62 c0 -30 34 -34 52 -12z" fill="#FF2D55"/>`;
    case 'closed':
      return `<path d="M152 216 q38 34 78 0" stroke="#2B1B0E" stroke-width="17" fill="none" stroke-linecap="round"/>
              <path d="M284 216 q38 34 78 0" stroke="#2B1B0E" stroke-width="17" fill="none" stroke-linecap="round"/>`;
    case 'wide':
      return `<circle cx="190" cy="212" r="30" fill="#FFF"/><circle cx="196" cy="216" r="18" fill="#2B1B0E"/>
              <circle cx="322" cy="212" r="30" fill="#FFF"/><circle cx="328" cy="216" r="18" fill="#2B1B0E"/>`;
    default:
      return `<circle cx="190" cy="212" r="23" fill="#2B1B0E"/><circle cx="322" cy="212" r="23" fill="#2B1B0E"/>`;
  }
};

const mouth = (type) => {
  switch (type) {
    case 'grin':
      return `<path d="M150 300 q106 108 212 0 z" fill="#7A1F2B"/><path d="M150 300 q106 20 212 0" fill="#FFF"/>`;
    case 'smile':
      return `<path d="M166 306 q90 76 180 0" stroke="#2B1B0E" stroke-width="18" fill="none" stroke-linecap="round"/>`;
    case 'o':
      return `<ellipse cx="256" cy="336" rx="44" ry="54" fill="#7A1F2B"/>`;
    case 'sad':
      return `<path d="M170 366 q86 -70 172 0" stroke="#2B1B0E" stroke-width="18" fill="none" stroke-linecap="round"/>`;
    case 'flat':
      return `<path d="M180 340 h152" stroke="#2B1B0E" stroke-width="17" stroke-linecap="round"/>`;
    default:
      return `<path d="M176 312 q80 62 160 0" stroke="#2B1B0E" stroke-width="18" fill="none" stroke-linecap="round"/>`;
  }
};

const emotions = [
  ['grinning', '#FFD43B', 'happy', 'grin'],
  ['smiling', '#FFD43B', 'default', 'smile'],
  ['in-love', '#FFD43B', 'heart', 'grin'],
  ['winking', '#FFD43B', 'wink', 'smile'],
  ['surprised', '#FFD43B', 'wide', 'o'],
  ['sad', '#FFC94D', 'closed', 'sad'],
  ['neutral', '#FFD43B', 'default', 'flat'],
  ['sleepy', '#FFD98A', 'closed', 'o'],
  ['cool', '#FFD43B', 'default', 'smile'],
  ['blush', '#FFC0A8', 'happy', 'smile'],
];

/* ----------------------------- Pack 2: Hands ----------------------------- */

const hands = [
  ['thumbs-up', `<path d="M196 236 l58 -112 q10 -20 30 -14 q22 6 18 30 l-14 78 h96 q30 0 30 30 l-22 132 q-6 30 -36 30 H196z" fill="#FFCC80" stroke="#B57A3A" stroke-width="10" stroke-linejoin="round"/><rect x="108" y="236" width="82" height="182" rx="24" fill="#FFB74D" stroke="#B57A3A" stroke-width="10"/>`],
  ['thumbs-down', `<g transform="rotate(180 256 256)"><path d="M196 236 l58 -112 q10 -20 30 -14 q22 6 18 30 l-14 78 h96 q30 0 30 30 l-22 132 q-6 30 -36 30 H196z" fill="#FFCC80" stroke="#B57A3A" stroke-width="10" stroke-linejoin="round"/><rect x="108" y="236" width="82" height="182" rx="24" fill="#FFB74D" stroke="#B57A3A" stroke-width="10"/></g>`],
  ['ok-hand', `<circle cx="196" cy="196" r="74" fill="none" stroke="#FFCC80" stroke-width="42"/><path d="M262 168 q64 -44 92 26 q26 62 -10 138 q-30 62 -104 62 q-70 0 -92 -56" fill="#FFCC80" stroke="#B57A3A" stroke-width="10" stroke-linejoin="round"/>`],
  ['wave', `<path d="M150 300 q-24 -104 6 -160 q16 -28 34 4 l30 84 l-4 -140 q0 -34 30 -34 q28 0 30 34 l6 132 l16 -120 q4 -32 32 -28 q28 4 26 36 l-12 122 l30 -78 q12 -28 34 -14 q22 14 12 44 l-42 148 q-24 84 -108 84 q-78 0 -102 -68z" fill="#FFCC80" stroke="#B57A3A" stroke-width="10" stroke-linejoin="round"/>`],
  ['clap', `<g fill="#FFCC80" stroke="#B57A3A" stroke-width="10"><path d="M120 330 q-20 -90 10 -140 q16 -26 32 2 l40 78 l-20 -104 q-4 -30 24 -34 q26 -4 32 26 l24 108z"/><path d="M392 330 q20 -90 -10 -140 q-16 -26 -32 2 l-40 78 l20 -104 q4 -30 -24 -34 q-26 -4 -32 26 l-24 108z"/></g><g stroke="#FFB300" stroke-width="14" stroke-linecap="round"><path d="M256 96 v-46"/><path d="M150 128 l-30 -34"/><path d="M362 128 l30 -34"/></g>`],
  ['peace', `<path d="M200 400 q-40 -100 -22 -196 l14 -100 q4 -32 32 -28 q26 4 24 36 l-8 116 l40 -108 q10 -30 36 -20 q24 10 14 40 l-38 116 q46 34 46 90 q0 68 -70 68 q-46 0 -68 -14z" fill="#FFCC80" stroke="#B57A3A" stroke-width="10" stroke-linejoin="round"/>`],
  ['raised-hand', `<path d="M140 320 v-84 q0-28 26-28 q26 0 26 28 v-108 q0-30 28-30 q28 0 28 30 v96 v-116 q0-30 28-30 q28 0 28 30 v116 v-84 q0-28 26-28 q26 0 26 28 v170 q0 108 -108 108 q-108 0 -108 -98z" fill="#FFCC80" stroke="#B57A3A" stroke-width="10" stroke-linejoin="round"/>`],
  ['fist-bump', `<path d="M150 232 q0 -54 54 -54 h108 q54 0 54 54 v92 q0 60 -60 60 H210 q-60 0 -60 -60z" fill="#FFCC80" stroke="#B57A3A" stroke-width="10" stroke-linejoin="round"/><g fill="#FFB74D" stroke="#B57A3A" stroke-width="8" stroke-linejoin="round"><rect x="164" y="214" width="46" height="56" rx="23"/><rect x="212" y="204" width="46" height="66" rx="23"/><rect x="260" y="208" width="46" height="62" rx="23"/><rect x="308" y="218" width="42" height="52" rx="21"/></g><path d="M150 286 q-34 -6 -34 -40 q0 -34 36 -34 q22 0 30 16" fill="#FFCC80" stroke="#B57A3A" stroke-width="10" stroke-linejoin="round"/><path d="M186 330 h140" stroke="#B57A3A" stroke-width="8" stroke-linecap="round" opacity="0.55"/>`],
];

/* ----------------------------- Pack 3: Objects --------------------------- */

const objects = [
  ['heart', `<path d="M256 428 C120 340 56 268 56 190 C56 122 108 76 168 76 c36 0 70 18 88 46 c18 -28 52 -46 88 -46 c60 0 112 46 112 114 c0 78 -64 150 -200 238z" fill="#FF2D55"/>`],
  ['star', `<path d="M256 60 l58 128 l140 16 l-104 96 l28 138 l-122 -70 l-122 70 l28 -138 l-104 -96 l140 -16z" fill="#FFD43B" stroke="#E0A800" stroke-width="10" stroke-linejoin="round"/>`],
  ['fire', `<path d="M256 44 q18 96 74 140 q60 48 60 118 q0 106 -134 106 q-134 0 -134 -106 q0 -58 44 -104 q10 34 40 44 q-24 -110 50 -198z" fill="#FF6B00"/><path d="M256 190 q10 54 42 78 q32 24 32 62 q0 54 -74 54 q-74 0 -74 -54 q0 -34 30 -60 q6 20 24 26 q-14 -60 20 -106z" fill="#FFD43B"/>`],
  ['party', `<path d="M96 424 l112 -252 l132 132z" fill="#4FC3F7" stroke="#0288D1" stroke-width="8" stroke-linejoin="round"/><g fill="#FF2D55"><circle cx="352" cy="120" r="16"/><circle cx="424" cy="196" r="14"/><circle cx="300" cy="72" r="12"/></g><g fill="#FFD43B"><circle cx="400" cy="104" r="13"/><circle cx="340" cy="200" r="11"/></g><g fill="#34C759"><circle cx="452" cy="140" r="12"/><circle cx="248" cy="120" r="10"/></g>`],
  ['coffee', `<path d="M110 168 h236 v128 q0 84 -84 84 h-68 q-84 0 -84 -84z" fill="#FFF" stroke="#5D4037" stroke-width="12"/><path d="M346 200 h34 q46 0 46 46 q0 46 -46 46 h-34" fill="none" stroke="#5D4037" stroke-width="12"/><path d="M110 216 h236 v80 q0 68 -68 68 h-100 q-68 0 -68 -68z" fill="#6D4C41"/><g stroke="#B0BEC5" stroke-width="10" stroke-linecap="round" fill="none"><path d="M170 124 q16 -20 0 -40"/><path d="M228 124 q16 -20 0 -40"/><path d="M286 124 q16 -20 0 -40"/></g><rect x="86" y="392" width="284" height="26" rx="13" fill="#5D4037"/>`],
  ['gift', `<rect x="72" y="200" width="368" height="60" rx="12" fill="#FF2D55"/><rect x="104" y="260" width="304" height="184" rx="14" fill="#FF5470"/><rect x="228" y="200" width="56" height="244" fill="#FFD43B"/><path d="M256 200 q-84 0 -84 -50 q0 -34 40 -34 q44 0 44 84z" fill="#FFD43B"/><path d="M256 200 q84 0 84 -50 q0 -34 -40 -34 q-44 0 -44 84z" fill="#FFD43B"/>`],
  ['rocket', `<path d="M256 40 q80 78 80 190 q0 62 -28 108 h-104 q-28 -46 -28 -108 q0 -112 80 -190z" fill="#ECEFF1" stroke="#90A4AE" stroke-width="10"/><circle cx="256" cy="184" r="40" fill="#4FC3F7" stroke="#0288D1" stroke-width="10"/><path d="M176 260 l-56 66 l56 -8z" fill="#FF3B30"/><path d="M336 260 l56 66 l-56 -8z" fill="#FF3B30"/><path d="M214 348 h84 q-10 74 -42 116 q-32 -42 -42 -116z" fill="#FF9500"/>`],
  ['cake', `<rect x="88" y="252" width="336" height="164" rx="20" fill="#FFCDD2" stroke="#E57373" stroke-width="10"/><path d="M88 300 q42 34 84 0 q42 -34 84 0 q42 34 84 0 q42 -34 84 0 v-40 H88z" fill="#FFF"/><g stroke="#FFD43B" stroke-width="14" stroke-linecap="round"><path d="M176 252 v-52"/><path d="M256 252 v-64"/><path d="M336 252 v-52"/></g><g fill="#FF6B00"><ellipse cx="176" cy="188" rx="12" ry="18"/><ellipse cx="256" cy="176" rx="12" ry="18"/><ellipse cx="336" cy="188" rx="12" ry="18"/></g>`],
  ['thumbup-badge', `<circle cx="256" cy="256" r="200" fill="#25D366"/><path d="M196 250 l50 -96 q10 -18 28 -12 q20 6 16 26 l-12 68 h84 q26 0 26 26 l-20 116 q-6 26 -32 26 H196z" fill="#FFF"/><rect x="126" y="250" width="66" height="154" rx="18" fill="#E8F5E9"/>`],
  ['check-badge', `<circle cx="256" cy="256" r="200" fill="#34C759"/><path d="M156 262 l70 70 l134 -140" fill="none" stroke="#FFF" stroke-width="42" stroke-linecap="round" stroke-linejoin="round"/>`],
];

/* ------------------------------- Generate -------------------------------- */

const packs = {
  emotions: {
    name: 'ChipApp Emotions',
    items: emotions.map(([id, fill, eye, mo]) => [id, svg(face(fill, '#E0A800') + eyes(eye) + mouth(mo))]),
  },
  hands: {
    name: 'ChipApp Hands',
    items: hands.map(([id, body]) => [id, svg(body)]),
  },
  objects: {
    name: 'ChipApp Objects',
    items: objects.map(([id, body]) => [id, svg(body)]),
  },
};

let count = 0;
let bytes = 0;
const manifest = [];

Object.entries(packs).forEach(([packId, { name, items }]) => {
  const dir = path.join(outRoot, packId);
  fs.mkdirSync(dir, { recursive: true });
  const stickers = [];
  items.forEach(([id, content]) => {
    const file = path.join(dir, `${id}.svg`);
    fs.writeFileSync(file, content);
    bytes += Buffer.byteLength(content);
    count += 1;
    stickers.push({ id, file: `${packId}/${id}.svg` });
  });
  manifest.push({ id: packId, name, publisher: 'ChipApp', stickers });
  console.log(`${packId.padEnd(10)} ${items.length} stickers`);
});

fs.writeFileSync(
  path.join(outRoot, 'manifest.json'),
  JSON.stringify({ version: '4.2.0', packs: manifest }, null, 2) + '\n'
);

console.log(`\n${count} stickers, ${(bytes / 1024).toFixed(1)} KB -> assets/stickers/`);

/* --------------------------- PNG rasterisation ---------------------------- *
 * React Native's <Image> cannot load SVG without an extra native dependency,
 * so we also emit @1x/@2x/@3x PNGs that Metro can bundle directly. The SVGs
 * remain the source of truth.
 * -------------------------------------------------------------------------- */
try {
  const { Resvg } = require('@resvg/resvg-js');
  let pngBytes = 0;
  let pngCount = 0;
  Object.keys(packs).forEach((packId) => {
    const dir = path.join(outRoot, packId);
    fs.readdirSync(dir)
      .filter((f) => f.endsWith('.svg'))
      .forEach((f) => {
        const src = fs.readFileSync(path.join(dir, f), 'utf8');
        [
          ['', 160],
          ['@2x', 320],
          ['@3x', 480],
        ].forEach(([suffix, width]) => {
          const png = new Resvg(src, {
            fitTo: { mode: 'width', value: width },
            background: 'rgba(0,0,0,0)',
          })
            .render()
            .asPng();
          const out = path.join(dir, `${f.replace('.svg', '')}${suffix}.png`);
          fs.writeFileSync(out, png);
          pngBytes += png.length;
          pngCount += 1;
        });
      });
  });
  console.log(`${pngCount} PNGs rasterised, ${(pngBytes / 1024 / 1024).toFixed(2)} MB`);
} catch (e) {
  console.log(`(skipped PNG rasterisation: ${e.message})`);
}
