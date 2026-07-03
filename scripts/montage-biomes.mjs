// Compose all captured biome shots into one labeled grid for review.
import { chromium } from 'playwright';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'scratch-shots', 'biomes');
const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const imgs = files.map((f) => ({ name: f.replace(/^\d+-/, '').replace(/\.png$/, '').replace(/-/g, ' '), b64: readFileSync(join(dir, f)).toString('base64') }));

const exe = ['/opt/pw-browsers/chromium'].find((c) => existsSync(c));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'], executablePath: exe });
const page = await browser.newPage();
const png = await page.evaluate(async ({ imgs }) => {
  const cols = 4, cellW = 300, cellH = 236, pad = 10, labelH = 26;
  const rows = Math.ceil(imgs.length / cols);
  const W = cols * cellW + (cols + 1) * pad, H = rows * (cellH + labelH) + (rows + 1) * pad;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = true;
  g.fillStyle = '#14121a'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < imgs.length; i++) {
    const im = new Image(); im.src = 'data:image/png;base64,' + imgs[i].b64; await im.decode();
    const c = i % cols, r = (i / cols) | 0;
    const x = pad + c * (cellW + pad), y = pad + r * (cellH + labelH + pad);
    // fit image into cell preserving aspect
    const s = Math.min(cellW / im.width, cellH / im.height);
    const dw = im.width * s, dh = im.height * s;
    g.drawImage(im, x + (cellW - dw) / 2, y + (cellH - dh) / 2, dw, dh);
    g.fillStyle = '#e8c267'; g.font = '600 15px ui-sans-serif,system-ui,sans-serif'; g.textAlign = 'center';
    g.fillText(imgs[i].name, x + cellW / 2, y + cellH + 18);
  }
  return cv.toDataURL('image/png');
}, { imgs });
writeFileSync(join(root, 'scratch-shots', 'biomes-montage.png'), Buffer.from(png.split(',')[1], 'base64'));
console.log('wrote scratch-shots/biomes-montage.png (' + imgs.length + ' biomes)');
await browser.close();
