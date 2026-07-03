// Round-2 curation on the current curated atlas+index. Removes, splits/un-combines,
// and a custom per-object collision MASK (arbitrary blocked tiles, e.g. a T). Passed
// -through objects KEEP their stable id; split products get fresh ids so review
// indices stay put. Silhouette is derived downstream from the mask (blocks-some-but-
// not-all → you walk behind it).
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const idx = JSON.parse(readFileSync(join(root, 'scratch-shots/decor-index.json'), 'utf8'));
const atlasB64 = readFileSync(join(root, 'scratch-shots/decor-atlas.png')).toString('base64');

const REMOVE = new Set([53]);
const SPLIT = { // id -> per-part block after splitting into that many blobs
  56: ['all', 'all'], 185: ['all', 'all'], 186: ['all', 'all'],
  215: ['none', 'none'], 216: ['none', 'none'], 217: ['none', 'none'],
};
// custom collision masks: id -> [[dx,dy]…] blocked tiles relative to the bottom-
// centre placement tile (0,0). #87 = uppercase T: top row + centre stem.
const MASK = { 87: [[-1, -1], [0, -1], [1, -1], [0, 0]] };

const exe = ['/opt/pw-browsers/chromium'].find((c) => existsSync(c));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'], executablePath: exe });
const page = await browser.newPage();
const out = await page.evaluate(async ({ idx, atlasB64, REMOVE, SPLIT, MASK }) => {
  REMOVE = new Set(REMOVE);
  const im = new Image(); im.src = 'data:image/png;base64,' + atlasB64; await im.decode();
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const sg = c.getContext('2d'); sg.drawImage(im, 0, 0);
  function comps(dx, dy, w, h) {
    const data = sg.getImageData(dx, dy, w, h).data;
    const seen = new Uint8Array(w * h), out = [], st = [];
    for (let i = 0; i < w * h; i++) {
      if (seen[i] || data[i * 4 + 3] <= 24) { seen[i] = 1; continue; }
      let mnx = w, mny = h, mxx = 0, mxy = 0, area = 0; st.push(i); seen[i] = 1;
      while (st.length) { const p = st.pop(); const x = p % w, y = (p / w) | 0; area++; if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const nx = x + b, ny = y + a; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const np = ny * w + nx; if (seen[np]) continue; seen[np] = 1; if (data[np * 4 + 3] > 24) st.push(np); } }
      if (area >= 40) out.push({ x: mnx + dx, y: mny + dy, w: mxx - mnx + 1, h: mxy - mny + 1, area });
    }
    return out;
  }
  function clusterN(cs, n) { // by x, largest gaps
    cs = cs.slice().sort((a, b) => (a.x + a.w / 2) - (b.x + b.w / 2));
    if (cs.length <= n) return cs.map((c) => [c]);
    const gaps = []; for (let i = 1; i < cs.length; i++) gaps.push({ i, g: (cs[i].x + cs[i].w / 2) - (cs[i - 1].x + cs[i - 1].w / 2) });
    gaps.sort((a, b) => b.g - a.g); const cut = new Set(gaps.slice(0, n - 1).map((g) => g.i));
    const gs = [[]]; cs.forEach((cc, i) => { if (cut.has(i)) gs.push([]); gs[gs.length - 1].push(cc); }); return gs;
  }
  const bbox = (g) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const cc of g) { x0 = Math.min(x0, cc.x); y0 = Math.min(y0, cc.y); x1 = Math.max(x1, cc.x + cc.w); y1 = Math.max(y1, cc.y + cc.h); } return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };

  let maxId = Math.max(...idx.map((d) => d.id == null ? 0 : d.id));
  const pieces = [];
  idx.forEach((d, i) => {
    const id = d.id != null ? d.id : i;
    if (REMOVE.has(id)) return;
    if (SPLIT[id]) {
      const parts = SPLIT[id]; const groups = clusterN(comps(d.dx, d.dy, d.w, d.h), parts.length);
      groups.forEach((g, gi) => { const b = bbox(g); pieces.push({ sx: b.x, sy: b.y, sw: b.w, sh: b.h, tag: d.tag, block: parts[gi] || parts[parts.length - 1], id: ++maxId }); });
      return;
    }
    pieces.push({ sx: d.dx, sy: d.dy, sw: d.w, sh: d.h, tag: d.tag, block: d.block, id, mask: MASK[id] || d.mask });
  });
  // re-pack
  const PAD = 2, MAXW = 512; let cx = PAD, cy = PAD, rowH = 0, aw = 0; const placed = [];
  for (const p of pieces) { if (cx + p.sw + PAD > MAXW) { cx = PAD; cy += rowH + PAD; rowH = 0; } placed.push({ ...p, dx: cx, dy: cy }); cx += p.sw + PAD; rowH = Math.max(rowH, p.sh); aw = Math.max(aw, cx); }
  const ah = cy + rowH + PAD;
  const A = document.createElement('canvas'); A.width = aw; A.height = ah; const ag = A.getContext('2d'); ag.imageSmoothingEnabled = false;
  placed.forEach((p) => ag.drawImage(im, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.sw, p.sh));
  const index = placed.map((p) => { const e = { id: p.id, dx: p.dx, dy: p.dy, w: p.sw, h: p.sh, ht: +(p.sh / 32).toFixed(2), tag: p.tag, block: p.block }; if (p.mask) e.mask = p.mask; return e; });
  return { atlas: A.toDataURL('image/png'), index, count: placed.length };
}, { idx, atlasB64, REMOVE: [...REMOVE], SPLIT, MASK });

writeFileSync(join(root, 'scratch-shots/decor-atlas.png'), Buffer.from(out.atlas.split(',')[1], 'base64'));
writeFileSync(join(root, 'scratch-shots/decor-index.json'), JSON.stringify(out.index, null, 0));
const header = '// LPC decor atlas — auto-extracted then HAND-CURATED (per-object block mode +\n'
  + '// optional collision mask + splits/combines/removes). Each entry: { id (stable),\n'
  + '// dx,dy,w,h (atlas px, 32px/tile), ht (tiles), tag, block: "all"|"base"|"none",\n'
  + '// mask?: [[dx,dy]…] blocked tiles rel. to placement }. A piece that leaves some of\n'
  + '// its tiles walkable draws a silhouette when you stand behind it. See docs/asset-credits.md.\n';
writeFileSync(join(root, 'src/assets/decorAtlas.js'),
  header + 'export const DECOR_INDEX = ' + JSON.stringify(out.index) + ';\n'
  + 'export const DECOR_ATLAS = ' + JSON.stringify(out.atlas) + ';\n');
console.log('round-2: ' + out.count + ' objects');
await browser.close();
