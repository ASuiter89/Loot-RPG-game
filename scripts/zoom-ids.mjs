// Zoom specific current-atlas ids so we can eyeball whether they are one object
// or two touching objects. Also overlays a per-column opaque-pixel histogram to
// reveal a vertical "valley" (a real seam between two objects).
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { DECOR_INDEX, DECOR_ATLAS } = await import(resolve(root, 'src/assets/decorAtlas.js'));
const ids = (process.argv[2] || '218,219,220').split(',').map(Number);

const exe = ['/opt/pw-browsers/chromium'].find((c) => existsSync(c));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'], executablePath: exe });
const page = await browser.newPage();
const png = await page.evaluate(async ({ DECOR_INDEX, DECOR_ATLAS, ids }) => {
  const im = new Image(); im.src = DECOR_ATLAS; await im.decode();
  const src = document.createElement('canvas'); src.width = im.width; src.height = im.height;
  const sg = src.getContext('2d'); sg.drawImage(im, 0, 0);
  const Z = 6, pad = 30, histH = 40, gapx = 24;
  const items = ids.map((id) => DECOR_INDEX.find((d) => d.id === id)).filter(Boolean);
  const cw = items.reduce((s, d) => s + d.w * Z + gapx, gapx);
  const ch = Math.max(...items.map((d) => d.h)) * Z + pad + histH + 20;
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#14121a'; g.fillRect(0, 0, cw, ch);
  let ox = gapx;
  for (const d of items) {
    g.drawImage(src, d.dx, d.dy, d.w, d.h, ox, pad, d.w * Z, d.h * Z);
    // per-column opaque count histogram under the sprite
    const data = sg.getImageData(d.dx, d.dy, d.w, d.h).data;
    const col = new Array(d.w).fill(0);
    for (let x = 0; x < d.w; x++) for (let y = 0; y < d.h; y++) if (data[(y * d.w + x) * 4 + 3] > 24) col[x]++;
    const mx = Math.max(...col, 1); const hy = pad + d.h * Z + 8;
    g.fillStyle = '#40e070';
    for (let x = 0; x < d.w; x++) { const h = (col[x] / mx) * histH; g.fillRect(ox + x * Z, hy + histH - h, Z, h); }
    g.fillStyle = '#e8c267'; g.font = '13px monospace';
    g.fillText('#' + d.id + ' ' + (d.w / 32).toFixed(2) + 'x' + (d.h / 32).toFixed(2) + 't ' + d.tag, ox, pad - 10);
    ox += d.w * Z + gapx;
  }
  return cv.toDataURL('image/png');
}, { DECOR_INDEX, DECOR_ATLAS, ids });
writeFileSync(join(root, 'scratch-shots/zoom-ids.png'), Buffer.from(png.split(',')[1], 'base64'));
console.log('wrote scratch-shots/zoom-ids.png for ids', ids.join(','));
await browser.close();
