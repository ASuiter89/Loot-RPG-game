// Audit the bundled LPC terrain atlas: which of its 2048 cells hold art, and
// which of those we don't yet reference. Renders an annotated map + prints stats.
import { chromium } from 'playwright';
import { existsSync, createReadStream, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname } from 'node:path';
import http from 'node:http';

const MIME = { '.png': 'image/png', '.html': 'text/html', '.json': 'application/json' };
function startServer(rootDir) {
  const server = http.createServer((req, res) => {
    const p = join(rootDir, decodeURIComponent((req.url || '/').split('?')[0]));
    if (!p.startsWith(rootDir) || !existsSync(p)) { res.statusCode = 404; return res.end('x'); }
    res.setHeader('Content-Type', MIME[extname(p)] || 'application/octet-stream');
    createReadStream(p).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}
const exe = ['/opt/pw-browsers/chromium'].find((c) => existsSync(c));
const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = resolve(__dirname, '../scratch-shots');
const used = new Set(JSON.parse(readFileSync(join(dir, 'used-ids.json'), 'utf8')));

const server = await startServer(dir);
const port = server.address().port;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'], executablePath: exe });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/atlas.png`); // same-origin so canvas isn't tainted

const result = await page.evaluate(async ({ port, used }) => {
  const usedSet = new Set(used);
  const img = new Image();
  img.src = `http://127.0.0.1:${port}/atlas.png`;
  await img.decode();
  const W = img.width, H = img.height, COLS = W / 32, ROWS = H / 32;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, W, H).data;

  // per-cell: does it hold art? (enough non-transparent, textured pixels)
  const cellHasArt = (cx, cy) => {
    let opaque = 0, sr = 0, sg = 0, sb = 0, n = 0;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const i = ((cy * 32 + y) * W + (cx * 32 + x)) * 4;
      if (data[i + 3] > 24) { opaque++; sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; n++; }
    }
    if (opaque < 40) return false;            // mostly transparent → blank
    const mr = sr / n, mg = sg / n, mb = sb / n;
    let varr = 0;
    for (let y = 0; y < 32; y += 2) for (let x = 0; x < 32; x += 2) {
      const i = ((cy * 32 + y) * W + (cx * 32 + x)) * 4;
      if (data[i + 3] > 24) varr += Math.abs(data[i] - mr) + Math.abs(data[i + 1] - mg) + Math.abs(data[i + 2] - mb);
    }
    return varr / 256 > 3; // some texture, not a flat pad
  };

  let art = 0, usedArt = 0, unusedArt = 0, unusedRows = new Set();
  const unusedArtCells = [];
  // annotated overview
  const S = 14; const ov = document.createElement('canvas'); ov.width = COLS * S; ov.height = ROWS * S;
  const o = ov.getContext('2d'); o.imageSmoothingEnabled = false;
  o.fillStyle = '#141018'; o.fillRect(0, 0, ov.width, ov.height);
  o.drawImage(img, 0, 0, ov.width, ov.height);
  for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
    const id = cy * COLS + cx;
    const has = cellHasArt(cx, cy);
    if (has) {
      art++;
      if (usedSet.has(id)) { usedArt++; o.strokeStyle = 'rgba(90,200,120,0.9)'; }
      else { unusedArt++; unusedRows.add(cy); unusedArtCells.push(id); o.strokeStyle = 'rgba(240,70,70,0.95)'; }
      o.lineWidth = 1; o.strokeRect(cx * S + 0.5, cy * S + 0.5, S - 1, S - 1);
    }
  }
  // dataURL of the overview
  return {
    COLS, ROWS, cells: COLS * ROWS, art, usedArt, unusedArt,
    unusedRows: [...unusedRows].sort((a, b) => a - b),
    unusedArtCells,
    overview: ov.toDataURL('image/png'),
  };
}, { port, used: [...used] });

// save the overview
const b64 = result.overview.split(',')[1];
const { writeFileSync } = await import('node:fs');
writeFileSync(join(dir, 'atlas-map.png'), Buffer.from(b64, 'base64'));

console.log(`cells with art: ${result.art} of ${result.cells}`);
console.log(`  used by us:   ${result.usedArt}`);
console.log(`  UNUSED art:   ${result.unusedArt}   <-- available terrain tiles`);
console.log(`rows containing unused art: ${result.unusedRows.join(', ')}`);
console.log('saved: scratch-shots/atlas-map.png (green=used, red=unused-with-art)');

await browser.close();
server.close();
