// Capture the game canvas for every INDOOR theme (forced via __previewIndoor), so
// we can see how built interiors look alongside the outdoor wall-shadow change.
import { chromium } from 'playwright';
import { existsSync, createReadStream, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname } from 'node:path';
import http from 'node:http';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'scratch-shots', 'indoor');
mkdirSync(outDir, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.map': 'application/json' };
const server = await new Promise((r) => {
  const s = http.createServer((req, res) => {
    const p = join(root, decodeURIComponent((req.url || '/').split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(root) || !existsSync(p)) { res.statusCode = 404; return res.end('x'); }
    res.setHeader('Content-Type', MIME[extname(p)] || 'application/octet-stream');
    createReadStream(p).pipe(res);
  });
  s.listen(0, '127.0.0.1', () => r(s));
});
const port = server.address().port;
const exe = ['/opt/pw-browsers/chromium'].find((c) => existsSync(c));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'], executablePath: exe });
const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
page.on('pageerror', (e) => console.error('PAGE ERR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html?preview=1`);
await page.waitForFunction(() => typeof window.__previewIndoor === 'function', { timeout: 20000 });
const canvas = page.locator('#canvas');
const seen = new Map();
for (let idx = 0; idx < 12; idx++) {
  const info = await page.evaluate((i) => window.__previewIndoor(i), idx);
  if (!info || info.err || seen.has(info.theme)) continue;
  seen.set(info.theme, idx);
  await new Promise((r) => setTimeout(r, 250));
  await page.evaluate(() => {
    document.getElementById('greed-overlay')?.classList.remove('open');
    const lb = document.getElementById('loot-banner'); if (lb) { lb.classList.remove('open'); lb.style.display = 'none'; }
  });
  await new Promise((r) => setTimeout(r, 150));
  const safe = (info.theme || ('indoor-' + idx)).replace(/^the\s+/i, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const n = String(seen.size).padStart(2, '0');
  await canvas.screenshot({ path: join(outDir, `${n}-${safe}.png`) });
  console.log(`${n}  ${info.theme}  (${info.floorStyle}/${info.wallStyle})`);
}
console.log(`\ncaptured ${seen.size} indoor themes -> scratch-shots/indoor/`);
await browser.close(); server.close();
