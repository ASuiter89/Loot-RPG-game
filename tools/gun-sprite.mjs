// Bespoke pixel art for the GUN weapon category's atlas tile (`w_gun`).
//
// The world sprite atlas in src/legacy/game.js is one packed 960x960 PNG of 96px
// cells (10 x 10 = 100 cells, named by SPRITE_IDX). A new weapon category needs a
// tile of its own — reusing the bow's would put the wrong object in the hero's
// hand — so the flintlock below is drawn as a hand-authored 48x48 indexed grid,
// nearest-neighbour doubled into the 96px cell and written to the one free cell (99).
//
// Usage:
//   node tools/gun-sprite.mjs             # render only -> .atlas-cells/w_gun.png
//   node tools/gun-sprite.mjs --ascii     # also dump the finished grid as text
//   node tools/gun-sprite.mjs --write     # patch the atlas in src/legacy/game.js
//
// --write is idempotent: cell 99 is repainted and every other cell round-trips
// byte-identically through the canvas encoder.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { launchChromium } from './skill-icons/pw.mjs';

const GAME = 'src/legacy/game.js';
const CELL = 99;                        // the one free cell in the 10x10 atlas
const ATLAS_COLS = 10, ATLAS_TS = 96;
const N = 48;                           // authoring grid, doubled into the cell

// ── palette ────────────────────────────────────────────────────────────────
// Cool gunmetal against warm walnut and brass, lit from the upper left — the same
// steel / wood / gold reads the other weapon tiles carry.
const PAL = {
  '.': null,
  k: '#171216',   // outline
  b: '#39404a',   // steel shadow
  B: '#59616f',   // steel mid
  H: '#8791a0',   // steel light
  S: '#c3cbd6',   // steel specular
  w: '#2f1c10',   // walnut shadow
  W: '#4f3120',   // walnut mid
  L: '#77502f',   // walnut light
  l: '#96683d',   // walnut specular
  g: '#6b4d13',   // brass shadow
  G: '#ac8228',   // brass mid
  Y: '#e8c463',   // brass specular
};

// ── the pistol, drawn run by run ───────────────────────────────────────────
// Each entry is [row, startColumn, pixels]. Runs are layered top-to-bottom in the
// order a gunsmith would read the piece: muzzle, barrel, pan, hammer, lock plate,
// grip, trigger guard, butt cap. Columns and rows are the 48-grid's own.
const BARREL = 'kHSBBBBbbbk';               // octagonal barrel, lit on its left flat
const LOCK = 'kGGGGGGggk';                  // brass lock plate beside the breech
const LOCK_SCREW = 'kGGggGGggk';            // ... with its screw line
const GRIP = 'kllLWWWWWwwwk';               // raked walnut grip
const HAMMER = 'kHBBbbbbbk';                // the cock's head
const NECK = 'kHBBbk';                      // ... and its neck
// Left edge of the grip, row 31 down to row 45: it rakes back a little under half
// a pixel per row, which reads as a smooth slope at this size.
const GRIP_X = [21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 28, 29];

const RUNS = [
  // muzzle: a brass ring around a dark bore, so the business end reads at icon size
  [4, 14, 'kkkkkkkkkkkkkkk'],
  [5, 14, 'kGYYGkkkGGGGggk'],
  [6, 14, 'kGYYGkkkGGGGggk'],
  [7, 14, 'kGYYGGGGGGGGggk'],
  // barrel, from the muzzle down to the grip's shoulder
  ...Array.from({ length: 8 }, (_, i) => [8 + i, 16, BARREL]),
  // flash pan against the breech
  [16, 16, BARREL + 'kkkk'],
  ...Array.from({ length: 4 }, (_, i) => [17 + i, 16, BARREL + 'HBbk']),
  // hammer, thrown back and hooked over the plate — the shape that says "flintlock"
  [10, 29, 'kkkkkkkkkk'],
  [11, 29, HAMMER], [12, 29, HAMMER], [13, 29, HAMMER],
  [14, 30, 'kHBBbbbbk'],
  [15, 31, 'kHBBbkkkk'],
  ...Array.from({ length: 5 }, (_, i) => [16 + i, 31, NECK]),
  // lock plate, tapering to a tail behind the breech
  [21, 16, BARREL + 'kkkkkkkkkk'],
  [22, 16, BARREL + 'kYYYGGGggk'],
  [23, 16, BARREL + LOCK], [24, 16, BARREL + LOCK],
  [25, 16, BARREL + LOCK_SCREW], [26, 16, BARREL + LOCK_SCREW],
  [27, 16, BARREL + LOCK],
  [28, 16, BARREL + 'kGGGGGggk'],
  [29, 16, BARREL + 'kGGGGggk'],
  [30, 16, BARREL + 'kkkkkkkk'],
  // grip, raking back and down from the lock
  ...GRIP_X.map((x, i) => [31 + i, x, GRIP]),
  // trigger guard: a brass strap under the barrel, a strut down its front, and a
  // bow sweeping back into the grip — the gap between them stays open, so it
  // reads as a loop rather than a slab.
  [31, 12, 'kGGGGGGGGk'],
  ...Array.from({ length: 6 }, (_, i) => [32 + i, 12, 'kGGk']),
  [38, 12, 'kGGGk'], [39, 12, 'kGGGGGk'],
  [40, 13, 'kGGGGGGGk'], [41, 15, 'kGGGGGGGk'], [42, 18, 'kGGGGGGGGk'],
  // butt cap
  [43, 26, 'kYYGGGGGGGGGggk'],
  [44, 26, 'kGGGGGGGGGGGggk'],
  [45, 27, 'kgGGGGGGGGGGggk'],
];

const grid = Array.from({ length: N }, () => Array(N).fill('.'));
for (const [y, x0, pixels] of RUNS) {
  for (let i = 0; i < pixels.length; i++) {
    const x = x0 + i;
    if (x >= 0 && x < N && y >= 0 && y < N) grid[y][x] = pixels[i];
  }
}

// ── outline pass ───────────────────────────────────────────────────────────
// Every empty pixel touching painted art becomes a dark rim, so the silhouette
// stays readable over any floor colour — the treatment the other weapon tiles use.
const OUT = grid.map((r) => r.slice());
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    if (grid[y][x] !== '.') continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
      .some(([dx, dy]) => { const c = grid[y + dy]?.[x + dx]; return c && c !== '.' && c !== 'k'; });
    if (near) OUT[y][x] = 'k';
  }
}

// ── centre the art in its cell ─────────────────────────────────────────────
// The atlas readers fit each tile's OPAQUE box, and drawHeldWeapon centres the
// cell on the hero's hand, so an off-centre silhouette would hang wrong. Shift
// the finished drawing so its bounding box sits in the middle of the grid.
let x0 = N, y0 = N, x1 = -1, y1 = -1;
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  if (OUT[y][x] === '.') continue;
  if (x < x0) x0 = x; if (x > x1) x1 = x;
  if (y < y0) y0 = y; if (y > y1) y1 = y;
}
const dx = Math.round((N - 1 - x1 - x0) / 2), dy = Math.round((N - 1 - y1 - y0) / 2);
const ART = Array.from({ length: N }, () => Array(N).fill('.'));
for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
  if (OUT[y][x] !== '.') ART[y + dy][x + dx] = OUT[y][x];
}

// ── render ─────────────────────────────────────────────────────────────────
if (process.argv.includes('--ascii')) console.log(ART.map((r) => r.join('')).join('\n'));

const src = readFileSync(GAME, 'utf8');
const atlasRe = /(spriteSheet\.src = ")(data:image\/png;base64,[^"]+)(")/;
const m = atlasRe.exec(src);
if (!m) { console.error(`no atlas found in ${GAME}`); process.exit(2); }

const browser = await launchChromium(chromium, { args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent('<!doctype html><meta charset=utf8>');
const out = await page.evaluate(async ({ url, rows, pal, cell, cols, ts, n }) => {
  const draw = (c, ox, oy, scale) => {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const col = pal[rows[y][x]];
        if (!col) continue;
        c.fillStyle = col;
        c.fillRect(ox + x * scale, oy + y * scale, scale, scale);
      }
    }
  };
  // The standalone tile, for eyeballing the art on its own.
  const tile = document.createElement('canvas');
  tile.width = ts; tile.height = ts;
  draw(tile.getContext('2d'), 0, 0, ts / n);

  // The full atlas with cell `cell` replaced.
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const sheet = document.createElement('canvas');
  sheet.width = img.naturalWidth; sheet.height = img.naturalHeight;
  const sc = sheet.getContext('2d');
  sc.imageSmoothingEnabled = false;
  sc.drawImage(img, 0, 0);
  const ox = (cell % cols) * ts, oy = ((cell / cols) | 0) * ts;
  sc.clearRect(ox, oy, ts, ts);
  draw(sc, ox, oy, ts / n);
  return { tile: tile.toDataURL('image/png'), sheet: sheet.toDataURL('image/png') };
}, { url: m[2], rows: ART.map((r) => r.join('')), pal: PAL, cell: CELL, cols: ATLAS_COLS, ts: ATLAS_TS, n: N });
await browser.close();

mkdirSync('.atlas-cells', { recursive: true });
writeFileSync('.atlas-cells/w_gun.png', Buffer.from(out.tile.split(',')[1], 'base64'));
console.log('tile  -> .atlas-cells/w_gun.png');

if (process.argv.includes('--write')) {
  writeFileSync(GAME, src.replace(atlasRe, (_s, a, _b, c) => a + out.sheet + c));
  console.log(`atlas -> ${GAME} (cell ${CELL}; ${out.sheet.length} base64 chars, was ${m[2].length})`);
} else {
  console.log(`atlas  = ${out.sheet.length} base64 chars (was ${m[2].length}) — pass --write to patch`);
}
