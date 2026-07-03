// PREVIEW screenshot harness — boots the REAL game with the procedural terrain
// pack (?terrain=proc&preview=1), drops into a dungeon floor, and screenshots the
// canvas so we can see a real level rendered with the new tileset. Not a test;
// a one-off visual capture. Mirrors test/smoke/smoke.mjs for the server + launch.
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
function findExecutable() {
  for (const c of [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean)) if (existsSync(c)) return c;
  return undefined;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : root;

async function capture(page, tag, info) {
  const file = join(outDir, `preview-${tag}.png`);
  await page.locator('#canvas').screenshot({ path: file });
  console.log(`  ${tag}: ${JSON.stringify(info)} -> ${file}`);
  return file;
}

async function main() {
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-gpu'] };
  const exe = findExecutable(); if (exe) launchOpts.executablePath = exe;
  const server = await startServer(root);
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/index.html?preview=1`; // normal LPC terrain + decor
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  console.log('preview: booting', url);
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
  // wait for the preview bootstrap to drop us into a dungeon
  await page.waitForFunction(() => { try { return window.gameState() && window.gameState().inTown === false; } catch (e) { return false; } }, { timeout: 15000 });
  await page.waitForTimeout(600);

  // Grab a spread of outdoor floors so the decor shows across biomes.
  const files = [];
  for (const [lvl, tag] of [[3, 'decor-1'], [8, 'decor-2'], [13, 'decor-3'], [5, 'decor-4']]) {
    const info = await page.evaluate((l) => window.__previewFloor(l), lvl);
    await page.waitForTimeout(500);
    files.push(await capture(page, tag, info));
  }
  console.log('preview: captured ' + files.length + ' floors');

  if (errs.length) console.log('preview: console/page errors:\n  ' + errs.slice(0, 8).join('\n  '));
  else console.log('preview: no page errors');
  console.log('preview: DONE');
  await browser.close();
  server.close();
}
main().catch((e) => { console.error('preview failed:', e); process.exit(1); });
