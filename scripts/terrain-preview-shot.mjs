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

  // Find a forest floor that actually has trees, screenshot density, then put the
  // hero behind a tree and screenshot the occlusion + silhouette.
  const files = [];
  let treeInfo = null, bt = { ok: false };
  for (let attempt = 0; attempt < 60 && !(bt.ok && bt.ht >= 3); attempt++) {
    const info = await page.evaluate((l) => window.__previewFloor(l), 6 + (attempt % 16));
    if (!info || !info.trees) continue;
    bt = await page.evaluate(() => window.__previewBehindTree());
    if (bt.ok && bt.ht >= 3) treeInfo = info;
  }
  await page.waitForTimeout(2000); // let the one-time depth banner fade
  await page.evaluate(() => window.__previewBehindTree()); // re-assert hero position + redraw
  await page.waitForTimeout(300);
  files.push(await capture(page, 'occlusion', bt));
  // centred crop on the hero (camera keeps the hero at canvas centre)
  const box = await page.evaluate(() => { const c = document.getElementById('canvas').getBoundingClientRect(); return { cx: c.width / 2, cy: c.height / 2 }; });
  try { await page.locator('#canvas').screenshot({ path: join(outDir, 'preview-occlusion-zoom.png'), clip: { x: Math.max(0, box.cx - 200), y: Math.max(0, box.cy - 230), width: 400, height: 420 } }); } catch (e) {}
  // multi-floor: high-contrast biomes (crypt stone/mudstone/gravel, tombs sand/soil/stone)
  for (const [lvl, tag] of [[1, 'floors-crypt'], [5, 'floors-tombs'], [3, 'floors-lava']]) {
    const i = await page.evaluate((l) => window.__previewFloor(l), lvl);
    await page.waitForTimeout(400);
    files.push(await capture(page, tag, i));
  }
  console.log('preview: treeInfo=' + JSON.stringify(treeInfo) + ' behindTree=' + JSON.stringify(bt));

  if (errs.length) console.log('preview: console/page errors:\n  ' + errs.slice(0, 8).join('\n  '));
  else console.log('preview: no page errors');
  console.log('preview: DONE');
  await browser.close();
  server.close();
}
main().catch((e) => { console.error('preview failed:', e); process.exit(1); });
