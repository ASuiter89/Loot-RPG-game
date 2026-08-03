// Atlas-blit smoke test — boots the REAL built game in Chromium and proves that
// no packed art sheet is ever scaled onto the map straight from a source
// sub-rectangle.
//
// Why this matters: handing the canvas `drawImage(sheet, sx,sy,sw,sh, …)` and a
// smaller destination lets the browser choose its scaling detail level off the
// WHOLE sheet instead of the requested cell. Safari/iOS does exactly that, and
// once a tile is drawn smaller than its source (deep floors shrink the tiles) the
// neighbouring cells smear across the entire destination rect — a coloured box
// behind every sprite, orange next to the atlas's ramen/loot rows and green next
// to the decor sheet's plants. atlasCell() copies each cell into its own canvas
// first, so there is nothing outside the tile left to sample.
//
// The test hooks drawImage on the MAIN canvas only (the per-cell bakes below it
// are 1:1 copies into offscreen canvases and are exactly what we want), sweeps a
// spread of floors, and fails on any sub-rect blit whose source is one of the
// packed sheets. It also checks sprites are actually still being drawn, so the
// assertion can't pass by rendering nothing.
//
// Usage: node test/smoke/atlas-cell-blits.mjs [path-to-html]  (default index.html)

import { chromium } from 'playwright';
import { existsSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename, extname } from 'node:path';
import http from 'node:http';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.map': 'application/json',
};
function startServer(rootDir) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const filePath = join(rootDir, urlPath === '/' ? 'index.html' : urlPath);
    if (!filePath.startsWith(rootDir)) { res.statusCode = 403; return res.end(); }
    if (!existsSync(filePath)) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
    createReadStream(filePath).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}
function findExecutable() {
  for (const c of [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean)) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(__dirname, '../../index.html');
if (!existsSync(target)) { console.error(`atlas-cell: target not found: ${target}`); process.exit(2); }

async function main() {
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-gpu'] };
  const exe = findExecutable();
  if (exe) launchOpts.executablePath = exe;

  const server = await startServer(dirname(target));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/${basename(target)}?preview=1`;
  const browser = await chromium.launch(launchOpts);
  // A phone-sized viewport: small tiles are exactly the case that shrinks a cell
  // below its source size and triggers the smear.
  const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  const failures = [];
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.__previewAtlasSheets === 'function', { timeout: 20000 });
    await page.waitForTimeout(400);

    // Hook drawImage before any floor renders. `sheets` is captured once the art
    // has loaded; a call is a violation when it targets the visible canvas, hands
    // over a source rect (9 args), and draws from one of the packed sheets.
    await page.evaluate(() => {
      const sheets = window.__previewAtlasSheets();
      const proto = CanvasRenderingContext2D.prototype;
      const real = proto.drawImage;
      window.__atlasViolations = [];
      window.__cellBlits = 0;
      proto.drawImage = function (img, ...rest) {
        const onMap = this.canvas && this.canvas.id === 'canvas';
        if (onMap) {
          if (rest.length === 8 && sheets.indexOf(img) >= 0) {
            const i = sheets.indexOf(img);
            if (window.__atlasViolations.length < 20) window.__atlasViolations.push({ sheet: i, args: rest.slice(0, 4) });
          } else if (img instanceof HTMLCanvasElement) {
            window.__cellBlits++;
          }
        }
        return real.call(this, img, ...rest);
      };
    });

    // A spread of floors: outdoor biomes, a built interior, an island and a deep
    // (big-map, small-tile) floor, so every sheet gets a chance to paint.
    const seen = [];
    for (const lvl of [2, 4, 6, 9, 13, 17, 21, 26, 32, 40]) {
      const info = await page.evaluate((l) => window.__previewFloor(l), lvl);
      await page.waitForTimeout(160);
      if (!info.err) seen.push(`${lvl}:${info.biome}${info.indoor ? ' (indoor)' : ''}`);
    }
    // Indoor floors are a random ~28% roll, so force one to exercise the
    // furniture / interior-material sheets deterministically.
    await page.evaluate(() => window.__previewIndoor && window.__previewIndoor(0));
    await page.waitForTimeout(200);

    const res = await page.evaluate(() => ({
      violations: window.__atlasViolations, cellBlits: window.__cellBlits,
    }));

    console.log(`atlas-cell: floors ${seen.join(' · ')}`);
    console.log(`atlas-cell: ${res.cellBlits} per-cell canvas blits, ${res.violations.length} sub-rect sheet blits`);

    if (res.violations.length) {
      const names = ['sprite', 'monster', 'boss', 'decor', 'furniture', 'terrain', 'interiors'];
      const detail = res.violations.map((v) => `${names[v.sheet] || v.sheet} sheet at [${v.args.join(',')}]`).join('; ');
      failures.push(`packed sheet scaled onto the map from a source sub-rect (use atlasCell): ${detail}`);
    }
    // Guard the guard: if nothing drew, "no violations" would be meaningless.
    if (!(res.cellBlits > 50)) failures.push(`only ${res.cellBlits} per-cell blits — the map does not appear to have rendered sprites`);

    if (pageErrors.length) failures.push(`uncaught page errors:\n  - ${pageErrors.join('\n  - ')}`);
  } catch (e) {
    failures.push(`atlas-cell check failed: ${String(e).split('\n')[0]}`);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\nATLAS-CELL BLITS FAILED:');
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log('\natlas-cell: PASS —', target);
}
main().catch((e) => { console.error('atlas-cell: unexpected error', e); process.exit(1); });
