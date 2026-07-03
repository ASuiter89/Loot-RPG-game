// End-to-end check for the multi-tile decor path-sealing guard. Boots the REAL
// game in Chromium, generates many indoor floors (which are furnished densely),
// and asserts no floor tile gets walled off by decor. Indoor floors carry no
// water/lava and the base map is ensureConnected() before furniture, so any
// UNREACHABLE plain-floor tile can only be decor that sealed a path. Uses the
// gated preview hook window.__connCheck() (a real full-map flood — no ASCII
// windowing artefacts). Usage: node scripts/verify-decor-connectivity.mjs [trials]
import { chromium } from 'playwright';
import { existsSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname } from 'node:path';
import http from 'node:http';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TRIALS = Number(process.argv[2] || 400);
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
const page = await browser.newPage();
let pageErr = null;
page.on('pageerror', (e) => { pageErr = String(e); });
await page.goto(`http://127.0.0.1:${port}/index.html?preview=1`);
await page.waitForFunction(() => typeof window.__previewIndoor === 'function' && typeof window.__connCheck === 'function', { timeout: 20000 });

const result = await page.evaluate(async ({ TRIALS }) => {
  let totalSolid = 0, totalDecor = 0, worst = null, sealed = 0;
  for (let t = 0; t < TRIALS; t++) {
    const info = window.__previewIndoor(t);
    if (info && info.err) return { fatal: 'previewIndoor threw: ' + info.err };
    totalSolid += (info && info.solid) || 0;
    totalDecor += (info && info.decor) || 0;
    const s = window.__connCheck();
    if (s.bad > 0) { sealed++; if (!worst || s.bad > worst.bad) worst = { trial: t, bad: s.bad, theme: info.theme, detail: s.detail }; }
  }
  return { TRIALS, totalSolid, totalDecor, sealed, worst };
}, { TRIALS });

await browser.close(); server.close();
if (pageErr) { console.error('PAGE ERROR:', pageErr); process.exit(2); }
if (result.fatal) { console.error('FATAL:', result.fatal); process.exit(2); }
console.log(`indoor floors generated : ${result.TRIALS}`);
console.log(`solid decor placed total: ${result.totalSolid} (avg ${(result.totalSolid / result.TRIALS).toFixed(1)}/floor)`);
console.log(`all decor placed total  : ${result.totalDecor}`);
console.log(`floors with a sealed-off tile: ${result.sealed}`);
if (result.sealed > 0) {
  console.error('\nFAIL — decor stranded ' + result.worst.bad + ' floor tile(s) on trial ' + result.worst.trial + ' (' + result.worst.theme + '):');
  console.error('stranded tiles (x,y + E/W/S/N neighbours, D=decor): ' + JSON.stringify(result.worst.detail));
  process.exit(1);
}
console.log('\nPASS — no indoor floor had a decor-sealed path across ' + result.TRIALS + ' generations.');
