// A/B capture: for a few representative biomes, screenshot the SAME map with the
// clustered multi-floor accents ON vs OFF, so we can judge whether the layered
// floors earn their keep. Boots the real game at ?preview=1 like the other harness.
import { chromium } from 'playwright';
import { existsSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname } from 'node:path';
import http from 'node:http';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.map': 'application/json' };
function startServer(rootDir) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath = join(rootDir, urlPath === '/' ? 'index.html' : urlPath);
    if (!filePath.startsWith(rootDir)) { res.statusCode = 403; return res.end(); }
    if (!existsSync(filePath)) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
    createReadStream(filePath).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}
const findExe = () => [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean).find((c) => existsSync(c));

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : root;
// biome depths chosen for palette variety: crypt, lava, tombs, forest, obsidian
const LEVELS = [1, 3, 5, 7, 20];

async function main() {
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-gpu'] };
  const exe = findExe(); if (exe) launchOpts.executablePath = exe;
  const server = await startServer(root);
  const port = server.address().port;
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/index.html?preview=1`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => typeof window.__previewFloor === 'function', { timeout: 20000 });
  await page.waitForFunction(() => { try { return window.gameState().inTown === false; } catch (e) { return false; } }, { timeout: 15000 });

  for (const lvl of LEVELS) {
    const info = await page.evaluate((l) => window.__previewFloor(l), lvl);
    const slug = String(lvl).padStart(2, '0') + '-' + String((info && info.biome) || 'x').replace(/[^a-z0-9]+/gi, '').toLowerCase().slice(3, 16);
    await page.waitForTimeout(300);
    for (const on of [true, false]) {
      await page.evaluate((o) => window.__previewMultiFloor(o), on);
      await page.waitForTimeout(250);
      const file = join(outDir, `ab-${slug}-${on ? 'multi' : 'flat'}.png`);
      await page.locator('#canvas').screenshot({ path: file });
      console.log(`  ${slug} ${on ? 'multi' : 'flat'} -> ${file}`);
    }
  }
  console.log(errs.length ? ('errors: ' + errs.slice(0, 5).join('; ')) : 'no page errors');
  await browser.close();
  server.close();
}
main().catch((e) => { console.error('ab failed:', e); process.exit(1); });
