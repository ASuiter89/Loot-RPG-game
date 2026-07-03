// Apply the hand-curation of the decor object set. Works on the CURRENT packed
// atlas + index (so the indices in the corrections below stay valid), then emits a
// new atlas + index where every object carries an explicit `block` mode
// ('all' = block whole footprint · 'base' = block just the placement tile · 'none'
// = walkable) and a stable `id`. Splits re-detect the separate blobs inside a
// merged sprite; combines composite pieces side-by-side. Silhouette is derived:
// only `base` pieces (things you walk behind) draw over you.
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const idx = JSON.parse(readFileSync(join(root, 'scratch-shots/decor-index.json'), 'utf8'));
const atlasB64 = readFileSync(join(root, 'scratch-shots/decor-atlas.png')).toString('base64');

// ── corrections keyed by CURRENT index (0..230) ──
const REMOVE = new Set([27, 83, 87, 92, 127, 134, 135, 136, 175, 176, 202, 203, 204, 207, 208, 209, 214, 215, 140, 141, 150, 151, 152]);
// explicit block-mode overrides (default is derived from shape if absent)
const BLOCK = {};
for (const i of [137, 138, 146, 147, 156, 157, 174, 44, 51, 53, 56, 57, 60, 62, 63, 82, 85, 86, 90, 91, 199, 201, 205, 206, 210, 213, 216, 88, 89, 170, 128, 129, 130, 131, 132, 133]) BLOCK[i] = 'all';
for (const i of [76, 78]) BLOCK[i] = 'base';
for (const i of [29, 34]) BLOCK[i] = 'none';
// splits: index -> { axis, parts:[block|'remove', …] } ; parts are ordered along axis
const SPLIT = {
  139: { axis: 'x', parts: ['all', 'all'] }, 149: { axis: 'x', parts: ['all', 'all'] },
  148: { axis: 'x', parts: ['all', 'all', 'remove'] }, 158: { axis: 'x', parts: ['all', 'all', 'remove'] },
  179: { axis: 'x', parts: ['all', 'all'] }, 180: { axis: 'x', parts: ['all', 'all'] },
  187: { axis: 'x', parts: ['all', 'all'] }, 188: { axis: 'x', parts: ['all', 'all'] },
  81: { axis: 'x', parts: ['none', 'none', 'none'] }, 54: { axis: 'x', parts: ['all', 'all'] },
  55: { axis: 'x', parts: ['all', 'all', 'all'] },
  47: { axis: 'y', parts: ['none', 'base'] },            // top mushrooms walkable, bottom trunk blocks
  52: { axis: 'x', parts: ['mixed'], custom: 'stackLeftBigRight' },
  113: { axis: 'y', parts: ['base', 'all', 'all'], custom: 'trees' }, 117: { axis: 'y', parts: ['base', 'all', 'all'], custom: 'trees' },
  116: { axis: 'y', parts: ['base', 'remove'] }, 120: { axis: 'y', parts: ['base', 'remove'] },
  184: { axis: 'x', parts: ['base', 'base'] }, 186: { axis: 'x', parts: ['base', 'base'] },
};
// combines: groups of indices to composite side-by-side into one object, given block
const COMBINE = [
  { parts: [225, 228], block: 'none' }, { parts: [226, 229], block: 'none' }, { parts: [227, 230], block: 'none' },
];

const exe = ['/opt/pw-browsers/chromium'].find((c) => existsSync(c));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'], executablePath: exe });
const page = await browser.newPage();
const out = await page.evaluate(async ({ idx, atlasB64, REMOVE, BLOCK, SPLIT, COMBINE }) => {
  REMOVE = new Set(REMOVE);
  const im = new Image(); im.src = 'data:image/png;base64,' + atlasB64; await im.decode();
  const src = document.createElement('canvas'); src.width = im.width; src.height = im.height;
  const sg = src.getContext('2d'); sg.drawImage(im, 0, 0);
  const alphaAt = (x, y) => sg.getImageData(x, y, 1, 1).data[3];
  // 8-conn components within a rect (no dilation), tight bboxes
  function comps(dx, dy, w, h) {
    const data = sg.getImageData(dx, dy, w, h).data;
    const seen = new Uint8Array(w * h), out = [], st = [];
    for (let i = 0; i < w * h; i++) {
      if (seen[i] || data[i * 4 + 3] <= 24) { seen[i] = 1; continue; }
      let minx = w, miny = h, maxx = 0, maxy = 0, area = 0; st.push(i); seen[i] = 1;
      while (st.length) { const p = st.pop(); const x = p % w, y = (p / w) | 0; area++;
        if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const nx = x + b, ny = y + a; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const np = ny * w + nx; if (seen[np]) continue; seen[np] = 1; if (data[np * 4 + 3] > 24) st.push(np); } }
      if (area >= 40) out.push({ x: minx + dx, y: miny + dy, w: maxx - minx + 1, h: maxy - miny + 1, area });
    }
    return out;
  }
  // cluster components into N groups along an axis by the largest gaps
  function clusterN(cs, axis, n) {
    const key = axis === 'x' ? (c) => c.x + c.w / 2 : (c) => c.y + c.h / 2;
    cs = cs.slice().sort((a, b) => key(a) - key(b));
    if (cs.length <= n) return cs.map((c) => [c]);
    const gaps = [];
    for (let i = 1; i < cs.length; i++) gaps.push({ i, g: key(cs[i]) - key(cs[i - 1]) });
    gaps.sort((a, b) => b.g - a.g);
    const cuts = new Set(gaps.slice(0, n - 1).map((g) => g.i));
    const groups = [[]]; for (let i = 0; i < cs.length; i++) { if (cuts.has(i)) groups.push([]); groups[groups.length - 1].push(cs[i]); }
    return groups;
  }
  const bbox = (g) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const c of g) { x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x + c.w); y1 = Math.max(y1, c.y + c.h); } return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };

  const pieces = []; // {sx,sy,sw,sh, tag, block}  (source rect in the current atlas)
  const defBlock = (d) => {
    const solid = d.ht >= 1.6 || ['furniture', 'barrel', 'chest', 'brazier'].includes(d.tag);
    if (!solid) return 'none';
    if (['tree', 'tree_dead', 'tree_pine'].includes(d.tag)) return 'base';
    const flat = d.ht <= 1.5 || (d.w / 32) >= d.ht * 0.85;
    return flat ? 'all' : 'base';
  };
  const combined = new Set(COMBINE.flatMap((c) => c.parts));
  idx.forEach((d, i) => {
    if (REMOVE.has(i) || combined.has(i)) return;
    if (SPLIT[i]) {
      const s = SPLIT[i]; let cs = comps(d.dx, d.dy, d.w, d.h);
      if (s.custom === 'trees') {
        // biggest blob = the big tree (block base); the rest = small trees (block all)
        cs.sort((a, b) => b.area - a.area); const big = cs[0]; const small = cs.slice(1).filter((c) => c.area > big.area * 0.12);
        if (big) pieces.push({ sx: big.x, sy: big.y, sw: big.w, sh: big.h, tag: d.tag, block: 'base' });
        small.forEach((c) => pieces.push({ sx: c.x, sy: c.y, sw: c.w, sh: c.h, tag: d.tag, block: 'all' }));
        return;
      }
      if (s.custom === 'stackLeftBigRight') {
        cs.sort((a, b) => (b.w * b.h) - (a.w * a.h)); const big = cs[0]; // big right object
        const rest = cs.slice(1).sort((a, b) => a.y - b.y); // stacked left: top, bottom
        if (big) pieces.push({ sx: big.x, sy: big.y, sw: big.w, sh: big.h, tag: d.tag, block: 'all' });
        if (rest[0]) pieces.push({ sx: rest[0].x, sy: rest[0].y, sw: rest[0].w, sh: rest[0].h, tag: d.tag, block: 'none' }); // top walkable
        if (rest[1]) pieces.push({ sx: rest[1].x, sy: rest[1].y, sw: rest[1].w, sh: rest[1].h, tag: d.tag, block: 'all' });  // bottom blocks
        return;
      }
      const groups = clusterN(cs, s.axis, s.parts.length);
      groups.forEach((g, gi) => { const act = s.parts[gi] || s.parts[s.parts.length - 1]; if (act === 'remove') return; const b = bbox(g); pieces.push({ sx: b.x, sy: b.y, sw: b.w, sh: b.h, tag: d.tag, block: act }); });
      return;
    }
    pieces.push({ sx: d.dx, sy: d.dy, sw: d.w, sh: d.h, tag: d.tag, block: BLOCK[i] != null ? BLOCK[i] : defBlock(d) });
  });
  // combines: composite the pieces bottom-aligned side-by-side into one sprite
  const composites = COMBINE.map((c) => {
    const ds = c.parts.map((i) => idx[i]).filter(Boolean);
    const h = Math.max(...ds.map((d) => d.h)), w = ds.reduce((s, d) => s + d.w + 1, -1);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    let x = 0; for (const d of ds) { g.drawImage(im, d.dx, d.dy, d.w, d.h, x, h - d.h, d.w, d.h); x += d.w + 1; }
    return { canvas: cv, w, h, tag: ds[0].tag, block: c.block };
  });

  // ── re-pack everything into a new atlas ──
  const PAD = 2, MAXW = 512; let cx = PAD, cy = PAD, rowH = 0, atlasW = 0;
  const placed = [];
  const allSprites = pieces.map((p) => ({ w: p.sw, h: p.sh, draw: (g, dx, dy) => g.drawImage(im, p.sx, p.sy, p.sw, p.sh, dx, dy, p.sw, p.sh), tag: p.tag, block: p.block }))
    .concat(composites.map((c) => ({ w: c.w, h: c.h, draw: (g, dx, dy) => g.drawImage(c.canvas, dx, dy), tag: c.tag, block: c.block })));
  for (const s of allSprites) { if (cx + s.w + PAD > MAXW) { cx = PAD; cy += rowH + PAD; rowH = 0; } placed.push({ ...s, dx: cx, dy: cy }); cx += s.w + PAD; rowH = Math.max(rowH, s.h); atlasW = Math.max(atlasW, cx); }
  const atlasH = cy + rowH + PAD;
  const A = document.createElement('canvas'); A.width = atlasW; A.height = atlasH; const ag = A.getContext('2d'); ag.imageSmoothingEnabled = false;
  placed.forEach((s) => s.draw(ag, s.dx, s.dy));
  const index = placed.map((s, i) => ({ id: i, dx: s.dx, dy: s.dy, w: s.w, h: s.h, ht: +(s.h / 32).toFixed(2), tag: s.tag, block: s.block }));
  return { atlas: A.toDataURL('image/png'), index, count: placed.length };
}, { idx, atlasB64, REMOVE: [...REMOVE], BLOCK, SPLIT, COMBINE });

writeFileSync(join(root, 'scratch-shots/decor-atlas.png'), Buffer.from(out.atlas.split(',')[1], 'base64'));
writeFileSync(join(root, 'scratch-shots/decor-index.json'), JSON.stringify(out.index, null, 0));
const header = '// LPC decor atlas — auto-extracted then HAND-CURATED (per-object block mode +\n'
  + '// splits/combines/removes). Each entry: { id (stable), dx,dy,w,h (atlas px, 32px/\n'
  + '// tile), ht (tiles), tag, block: "all"|"base"|"none" }. block "base" pieces draw a\n'
  + '// silhouette when you stand behind them. Generated by scripts/extract-decor.mjs +\n'
  + '// scripts/apply-decor-corrections.mjs. See docs/asset-credits.md.\n';
writeFileSync(join(root, 'src/assets/decorAtlas.js'),
  header + 'export const DECOR_INDEX = ' + JSON.stringify(out.index) + ';\n'
  + 'export const DECOR_ATLAS = ' + JSON.stringify(out.atlas) + ';\n');
console.log('curated ' + out.count + ' objects');
const byBlock = {}; out.index.forEach((d) => byBlock[d.block] = (byBlock[d.block] || 0) + 1);
console.log('by block:', JSON.stringify(byBlock));
await browser.close();
