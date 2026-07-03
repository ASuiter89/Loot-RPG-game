// Auto-extract individual objects from LPC decor sheets via alpha connected-
// components, shelf-pack the chosen ones into a single decor atlas, and emit the
// atlas PNG + an index (key -> {sx,sy,sw,sh, wTiles,hTiles}) + a labeled contact
// sheet so we can eyeball what got pulled. LPC art is 32px/tile.
import { chromium } from 'playwright';
import { existsSync, createReadStream, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname } from 'node:path';
import http from 'node:http';

const MIME = { '.png': 'image/png', '.html': 'text/html' };
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../scratch-shots/packs');
const server = await new Promise((r) => {
  const s = http.createServer((req, res) => {
    if (req.url === '/blank.html') { res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><title>x</title>'); }
    const p = join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(root) || !existsSync(p)) { res.statusCode = 404; return res.end('x'); }
    res.setHeader('Content-Type', MIME[extname(p)] || 'application/octet-stream');
    createReadStream(p).pipe(res);
  });
  s.listen(0, '127.0.0.1', () => r(s));
});
const port = server.address().port;
const exe = ['/opt/pw-browsers/chromium'].find((c) => existsSync(c));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'], executablePath: exe });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/blank.html`);

// Which sheets to mine, and the size band to accept (native px). Ground decor for
// increment 1 = short objects; tall trees are handled later with occlusion.
// Ground decor: short objects (<= ~1.7 tiles tall) that read fine drawn under
// actors. minH drops fragment noise; per-tag cap keeps a varied but bounded set.
// Tall trees (ht >= ~2.5 tiles) are tagged tree* and get depth-sorted + occlusion.
const SOURCES = [
  { file: 'flowers/lpc-flowers-plants-fungi-wood/plants.png', tag: 'plant',      minA: 260,  minH: 14, maxH: 56,  maxW: 84,  cap: 46 },
  { file: 'beach-desert/lpc-beach-desert/beach-desert.png',   tag: 'desert',     minA: 300,  minH: 16, maxH: 56,  maxW: 96,  cap: 30 },
  { file: 'trees/lpc-trees/trees-green.png',                  tag: 'bush',       minA: 420,  minH: 20, maxH: 60,  maxW: 84,  cap: 10 },
  { file: 'trees/lpc-trees/trees-green.png',                  tag: 'tree',       minA: 2400, minH: 80, maxH: 210, maxW: 210, cap: 6 },
  { file: 'trees/lpc-trees/trees-orange.png',                 tag: 'tree',       minA: 2400, minH: 80, maxH: 210, maxW: 210, cap: 4 },
  { file: 'trees/lpc-trees/trees-dead.png',                   tag: 'tree_dead',  minA: 1400, minH: 70, maxH: 210, maxW: 190, cap: 4 },
  { file: 'conifers/lpc-conifers/conifers.png',               tag: 'tree_pine',  minA: 1800, minH: 70, maxH: 200, maxW: 160, cap: 6 },
];

const out = await page.evaluate(async ({ port, SOURCES }) => {
  async function load(src) { const im = new Image(); im.src = `http://127.0.0.1:${port}/${src}`; await im.decode(); return im; }
  // connected components (8-conn) over alpha>24
  function components(data, W, H, minA) {
    const seen = new Uint8Array(W * H); const comps = [];
    const stack = [];
    for (let i = 0; i < W * H; i++) {
      if (seen[i] || data[i * 4 + 3] <= 24) { seen[i] = 1; continue; }
      let minx = W, miny = H, maxx = 0, maxy = 0, area = 0;
      stack.push(i); seen[i] = 1;
      while (stack.length) {
        const p = stack.pop(); const x = p % W, y = (p / W) | 0;
        area++; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const np = ny * W + nx; if (seen[np]) continue; seen[np] = 1;
          if (data[np * 4 + 3] > 24) stack.push(np); }
      }
      if (area >= minA) comps.push({ x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1, area });
    }
    return comps;
  }
  const picks = [];
  for (const s of SOURCES) {
    const im = await load(s.file);
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const data = g.getImageData(0, 0, im.width, im.height).data;
    let comps = components(data, im.width, im.height, s.minA)
      .filter((b) => b.h >= s.minH && b.h <= s.maxH && b.w <= s.maxW)
      .sort((a, b) => a.y - b.y || a.x - b.x);
    // evenly sample down to the cap so we keep variety across the sheet
    if (comps.length > s.cap) { const step = comps.length / s.cap; comps = Array.from({ length: s.cap }, (_, i) => comps[Math.floor(i * step)]); }
    comps.forEach((b, i) => picks.push({ ...b, src: s.file, tag: s.tag, key: `${s.tag}_${i}` }));
  }
  // shelf-pack into an atlas (max width 512, 2px pad)
  const PAD = 2, MAXW = 512;
  let cx = PAD, cy = PAD, rowH = 0, atlasW = 0;
  const rects = [];
  for (const p of picks) {
    if (cx + p.w + PAD > MAXW) { cx = PAD; cy += rowH + PAD; rowH = 0; }
    rects.push({ key: p.key, tag: p.tag, dx: cx, dy: cy, sx: p.x, sy: p.y, w: p.w, h: p.h, src: p.src });
    cx += p.w + PAD; rowH = Math.max(rowH, p.h); atlasW = Math.max(atlasW, cx);
  }
  const atlasH = cy + rowH + PAD;
  // draw atlas
  const A = document.createElement('canvas'); A.width = atlasW; A.height = atlasH;
  const ag = A.getContext('2d'); ag.imageSmoothingEnabled = false;
  const imgs = {};
  for (const s of SOURCES) imgs[s.file] = await load(s.file);
  for (const r of rects) ag.drawImage(imgs[r.src], r.sx, r.sy, r.w, r.h, r.dx, r.dy, r.w, r.h);
  // contact sheet with labels on a dark bg
  const C2 = document.createElement('canvas'); C2.width = atlasW * 2; C2.height = atlasH * 2 + 40;
  const cg = C2.getContext('2d'); cg.imageSmoothingEnabled = false;
  cg.fillStyle = '#14121a'; cg.fillRect(0, 0, C2.width, C2.height);
  cg.drawImage(A, 0, 0, atlasW, atlasH, 0, 0, atlasW * 2, atlasH * 2);
  cg.fillStyle = '#e8c267'; cg.font = '12px monospace';
  rects.forEach((r) => { cg.fillText(r.key + ` ${Math.round(r.w / 32 * 10) / 10}x${Math.round(r.h / 32 * 10) / 10}t`, r.dx * 2, r.dy * 2 + r.h * 2 + 12); });
  const index = rects.map((r) => ({ key: r.key, tag: r.tag, dx: r.dx, dy: r.dy, w: r.w, h: r.h, wt: +(r.w / 32).toFixed(2), ht: +(r.h / 32).toFixed(2) }));
  return { atlas: A.toDataURL('image/png'), contact: C2.toDataURL('image/png'), index, atlasW, atlasH, count: rects.length };
}, { port, SOURCES });

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../scratch-shots');
writeFileSync(join(dir, 'decor-atlas.png'), Buffer.from(out.atlas.split(',')[1], 'base64'));
writeFileSync(join(dir, 'decor-contact.png'), Buffer.from(out.contact.split(',')[1], 'base64'));
writeFileSync(join(dir, 'decor-index.json'), JSON.stringify(out.index, null, 0));
writeFileSync(join(dir, 'decor-atlas.b64.txt'), out.atlas.split(',')[1]);
console.log(`extracted ${out.count} objects -> decor-atlas.png (${out.atlasW}x${out.atlasH}); contact sheet + index written`);
const byTag = {}; out.index.forEach((r) => byTag[r.tag] = (byTag[r.tag] || 0) + 1);
console.log('by tag:', JSON.stringify(byTag));
await browser.close(); server.close();
