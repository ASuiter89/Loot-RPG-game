// Round-4 curation: remove the two floor lamps (#219, #220) per review. Every
// other object KEEPS its stable id. Re-packs the atlas and re-emits decorAtlas.js.
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const idx = JSON.parse(readFileSync(join(root, 'scratch-shots/decor-index.json'), 'utf8'));
const atlasB64 = readFileSync(join(root, 'scratch-shots/decor-atlas.png')).toString('base64');

const REMOVE = new Set([219, 220]);

const exe = ['/opt/pw-browsers/chromium'].find((c) => existsSync(c));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'], executablePath: exe });
const page = await browser.newPage();
const out = await page.evaluate(async ({ idx, atlasB64, REMOVE }) => {
  REMOVE = new Set(REMOVE);
  const atlas = new Image(); atlas.src = 'data:image/png;base64,' + atlasB64; await atlas.decode();
  const pieces = [];
  idx.forEach((d, i) => {
    const id = d.id != null ? d.id : i;
    if (REMOVE.has(id)) return;
    pieces.push({ sx: d.dx, sy: d.dy, sw: d.w, sh: d.h, tag: d.tag, block: d.block, id, mask: d.mask });
  });
  const PAD = 2, MAXW = 512; let cx = PAD, cy = PAD, rowH = 0, aw = 0; const placed = [];
  for (const p of pieces) { if (cx + p.sw + PAD > MAXW) { cx = PAD; cy += rowH + PAD; rowH = 0; } placed.push({ ...p, dx: cx, dy: cy }); cx += p.sw + PAD; rowH = Math.max(rowH, p.sh); aw = Math.max(aw, cx); }
  const ah = cy + rowH + PAD;
  const A = document.createElement('canvas'); A.width = aw; A.height = ah; const ag = A.getContext('2d'); ag.imageSmoothingEnabled = false;
  placed.forEach((p) => ag.drawImage(atlas, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.sw, p.sh));
  const index = placed.map((p) => { const e = { id: p.id, dx: p.dx, dy: p.dy, w: p.sw, h: p.sh, ht: +(p.sh / 32).toFixed(2), tag: p.tag, block: p.block }; if (p.mask) e.mask = p.mask; return e; });
  return { atlas: A.toDataURL('image/png'), index, count: placed.length };
}, { idx, atlasB64, REMOVE: [...REMOVE] });

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
console.log('round-4: ' + out.count + ' objects (removed ' + [...REMOVE].join(',') + ')');
await browser.close();
