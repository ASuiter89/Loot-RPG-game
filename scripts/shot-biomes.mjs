// Capture the game canvas for every OUTDOOR biome, with the raised-wall shadow
// live, so we can review it across all grounds before merging. One clean shot per
// unique biome (skips indoor rolls and floors with a blocking overlay).
import { chromium } from 'playwright';
import { existsSync, createReadStream, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname } from 'node:path';
import http from 'node:http';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'scratch-shots', 'biomes');
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
await page.waitForFunction(() => typeof window.__previewFloor === 'function', { timeout: 20000 });

const seen = new Map();     // biome name -> level captured
const clean = () => page.evaluate(() => { try { const g = window.gameState(); return !g.blockingOverlay && g.mode !== 'title'; } catch (e) { return true; } });
const canvas = page.locator('#canvas');
for (let lvl = 1; lvl <= 25; lvl++) {
  let info = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    info = await page.evaluate((l) => window.__previewFloor(l), lvl);
    if (info && !info.err && !info.indoor && await clean()) break;
    info = null;
  }
  if (!info || seen.has(info.biome)) continue;
  seen.set(info.biome, lvl);
  await new Promise((r) => setTimeout(r, 250));   // let the deferred greed gate fire
  await page.evaluate(() => {                       // then clear preview-only overlays
    document.getElementById('greed-overlay')?.classList.remove('open');
    const lb = document.getElementById('loot-banner'); if (lb) { lb.classList.remove('open'); lb.style.display = 'none'; }
  });
  await new Promise((r) => setTimeout(r, 150));
  const safe = info.biome.replace(/^the\s+/i, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const idx = String(seen.size).padStart(2, '0');
  await canvas.screenshot({ path: join(outDir, `${idx}-${safe}.png`) });
  console.log(`${idx}  ${info.biome}  (lvl ${lvl})`);
}
console.log(`\ncaptured ${seen.size} biomes -> scratch-shots/biomes/`);
await browser.close(); server.close();
