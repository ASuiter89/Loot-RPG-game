// Bespoke pixel art for the GUN weapon category's atlas tile (`w_gun`) — a
// long-barrelled flintlock rifle.
//
// The world sprite atlas in src/legacy/game.js is one packed 960x960 PNG of 96px
// cells (10 x 10 = 100 cells, named by SPRITE_IDX). A new weapon category needs a
// tile of its own — reusing the bow's would put the wrong object in the hero's
// hand — so this script draws the rifle and writes it into the one free cell (99).
//
// ── Matching the other weapon tiles ────────────────────────────────────────
// Measured off the shipped art (see .atlas-analyze in the commit history):
//   • ANGLE — every long weapon (spear, staff, axe, bow) runs corner to corner at
//     ~45 degrees, muzzle/head at the UPPER LEFT and butt at the LOWER RIGHT, which
//     is also what drawHeldWeapon assumes when it mirrors the sprite for a
//     right-facing hero. So the rifle is authored in a ROTATED frame: `u` runs
//     along that diagonal (0 at the top-left corner, ~136 at the bottom-right) and
//     `v` across it (positive = up-and-right, the lit side).
//   • LINE WIDTH — the spear's shaft is ~8px per row, i.e. ~5.7px measured
//     perpendicular. The rifle's barrel is 6px across, so it reads as the same
//     weight of line while staying obviously skinnier than its own stock.
//   • SHADING — those tiles carry 900-1900 distinct colours: smooth gradients
//     along and across each part, not flat fills. Every part here is shaded by a
//     4-stop ramp across its width plus a soft specular streak and a gentle
//     darkening down its length, with hard (un-antialiased) edges so the sprite
//     still upscales crisply.
//
// Usage:
//   node tools/gun-sprite.mjs             # render only -> .atlas-cells/w_gun.png
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
const N = ATLAS_TS;                     // authored at the cell's native size
const R2 = Math.SQRT2;

// ── materials ───────────────────────────────────────────────────────────────
// Four stops each, darkest (shadow flank) to lightest (lit flank), in the same
// gunmetal / walnut / brass family the other weapon tiles use.
const MAT = {
  steel: ['#14171d', '#2b313a', '#4d5561', '#7d8794'],
  iron:  ['#101318', '#22272e', '#3c434d', '#5d6572'],
  wood:  ['#170e07', '#2c1c0e', '#4a331d', '#6b4c2d'],
  brass: ['#33240a', '#5f4611', '#8d6d1e', '#b8933c'],
};
const OUTLINE = '#0e0b14';

// ── the rifle, part by part, in the rotated (u, v) frame ────────────────────
// `u0`/`u1` bound a part along the barrel axis; `v` is its centreline offset and
// `half` its half-width across. Both may be functions of u, which is what lets the
// butt stock flare and drop away from the bore line. Parts paint in order, so a
// later one sits on top of an earlier one.
const k = (n) => () => n;
const ramp = (u0, u1, a, b) => (u) => a + (b - a) * Math.min(1, Math.max(0, (u - u0) / (u1 - u0)));

const PARTS = [
  // Long, skinny barrel — the whole point of the silhouette. 6px across, running
  // more than half the tile before it ever reaches the lock.
  { u0: 9,   u1: 86,  v: k(0),    half: k(3),   mat: 'steel' },
  // Muzzle band and the ramrod pipe partway down, both a touch proud of the bore.
  { u0: 9,   u1: 15,  v: k(0),    half: k(4.3), mat: 'brass' },
  { u0: 48,  u1: 52,  v: k(0),    half: k(4.3), mat: 'brass' },
  // Front sight blade, standing on top of the barrel.
  { u0: 19,  u1: 22,  v: k(4.4),  half: k(1.7), mat: 'iron' },
  // Wooden fore-end, slung under the barrel from the pipe back to the lock.
  { u0: 40,  u1: 88,  v: k(-4.8), half: k(2.4), mat: 'wood' },
  // Lock plate / breech — the one place the piece is genuinely thick.
  { u0: 84,  u1: 100, v: k(0),    half: k(6.4), mat: 'steel' },
  { u0: 88,  u1: 99,  v: k(3.2),  half: k(3),   mat: 'brass' },
  // Hammer: a spur thrown back and up over the plate.
  { u0: 86,  u1: 92,  v: k(8.4),  half: k(2.6), mat: 'iron' },
  { u0: 90,  u1: 95,  v: k(10.4), half: k(2),   mat: 'iron' },
  // Trigger, then the brass guard bowing under it.
  { u0: 97,  u1: 100, v: k(-7),   half: k(1.2), mat: 'iron' },
  { u0: 93,  u1: 110, v: k(-9.2), half: k(1.4), mat: 'brass' },
  { u0: 93,  u1: 96,  v: k(-7.5), half: k(2),   mat: 'brass' },
  { u0: 107, u1: 110, v: k(-7.5), half: k(2),   mat: 'brass' },
  // Wrist, then the butt stock flaring and dropping away from the bore line.
  { u0: 98,  u1: 116, v: ramp(98, 116, -1, -3),   half: ramp(98, 116, 5, 6.2), mat: 'wood' },
  { u0: 114, u1: 132, v: ramp(114, 132, -3, -3.6), half: ramp(114, 132, 6.2, 9.6), mat: 'wood' },
  // Butt plate.
  { u0: 129, u1: 133, v: k(-3.6), half: k(9.6), mat: 'brass' },
];

// ── shade one pixel ─────────────────────────────────────────────────────────
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const RAMPS = Object.fromEntries(Object.entries(MAT).map(([n, cs]) => [n, cs.map(hex)]));

/**
 * Colour for a point `t` across a part's width (0 = shadow flank, 1 = lit flank)
 * at `s` along its length (0 = muzzle end, 1 = butt end). Light reads as coming
 * from screen-up, so the up-and-right flank of every part carries the highlight;
 * a narrow specular streak sits just inside it, and everything dims slightly
 * toward the butt so the piece doesn't read as one flat extrusion. `n` is a small
 * per-pixel grain offset (see below) that keeps the metal and wood from reading as
 * a clean CG extrusion beside the hand-painted tiles around it.
 */
function shade(mat, t, s, n) {
  const stops = RAMPS[mat];
  const p = t * 3;
  const i = Math.min(2, Math.floor(p));
  let c = mix(stops[i], stops[i + 1], p - i);
  const spec = Math.exp(-((t - 0.8) ** 2) / 0.012);           // soft highlight line
  c = mix(c, [236, 240, 248], spec * 0.16);
  const dim = 1 - 0.16 * s;                                    // falls off down the length
  return c.map((v, i) => Math.max(0, Math.min(255, Math.round(v * dim + n))));
}

/**
 * Deterministic +/-4 level grain, so the surfaces carry the same faint texture the
 * shipped tiles do. Hash-based rather than random: the tile must render identically
 * on every run, or --write would churn the atlas.
 */
function grain(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return Math.round((h - Math.floor(h)) * 9) - 4;
}

// ── raster ──────────────────────────────────────────────────────────────────
const px = Array.from({ length: N }, () => Array(N).fill(null));
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    // Sample at the pixel centre, in the rotated frame.
    const cx = x + 0.5, cy = y + 0.5;
    const u = (cx + cy) / R2;
    const v = (cx - cy) / R2;
    for (const p of PARTS) {
      if (u < p.u0 || u > p.u1) continue;
      const vc = p.v(u), h = p.half(u);
      if (v < vc - h || v > vc + h) continue;
      const t = (v - (vc - h)) / (2 * h);
      const s = (u - p.u0) / Math.max(1, p.u1 - p.u0) * 0.5 + (u / 136) * 0.5;
      px[y][x] = shade(p.mat, t, s, grain(x, y));
    }
  }
}

// Outline pass: every empty pixel touching art becomes a dark rim, so the
// silhouette stays readable over any floor colour — the treatment the other
// weapon tiles carry.
const OUT_RGB = hex(OUTLINE);
const art = px.map((r) => r.slice());
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    if (px[y][x]) continue;
    const touches = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
      .some(([dx, dy]) => px[y + dy] && px[y + dy][x + dx]);
    if (touches) art[y][x] = OUT_RGB;
  }
}

// ── render ──────────────────────────────────────────────────────────────────
const src = readFileSync(GAME, 'utf8');
const atlasRe = /(spriteSheet\.src = ")(data:image\/png;base64,[^"]+)(")/;
const m = atlasRe.exec(src);
if (!m) { console.error(`no atlas found in ${GAME}`); process.exit(2); }

const rows = art.map((r) => r.map((c) => (c ? `rgb(${c[0]},${c[1]},${c[2]})` : null)));
const browser = await launchChromium(chromium, { args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent('<!doctype html><meta charset=utf8>');
const out = await page.evaluate(async ({ url, grid, cell, cols, ts }) => {
  const draw = (c, ox, oy) => {
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid.length; x++) {
        const col = grid[y][x];
        if (!col) continue;
        c.fillStyle = col;
        c.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  };
  // The standalone tile, for eyeballing the art on its own.
  const tile = document.createElement('canvas');
  tile.width = ts; tile.height = ts;
  draw(tile.getContext('2d'), 0, 0);

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
  draw(sc, ox, oy);
  return { tile: tile.toDataURL('image/png'), sheet: sheet.toDataURL('image/png') };
}, { url: m[2], grid: rows, cell: CELL, cols: ATLAS_COLS, ts: ATLAS_TS });
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
