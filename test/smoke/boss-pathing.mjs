// End-to-end smoke test for the "a hunting foe never wedges behind cover" rule.
//
// Boots the real game in Chromium (?preview=1 exposes the audit hooks) and runs
// __bossChaseTest(), which drives the ACTUAL enemy AI over deterministic arenas:
//   * wide-behind-rock   a 2x2 body level with the hero, one rock covering both
//                        its rows — the reported bug. The old greedy "step on x,
//                        else step on y" had a single option here (the y step is a
//                        no-op when the hero shares your rows), the rock vetoed it,
//                        and the body stood frozen while the hero shot it for free.
//   * huge-around-wall   a 3x3 body that has to climb over the end of a wall.
//   * single-around-rock regression guard for one-tile foes, which always pathed.
//   * unreachable-hero   hero sealed off: the body must still close as far as it
//                        fits and hold, rather than never moving at all.
// Every reachable case must END IN REACH (footDist <= 1); every case at all must
// report stuck:false — a body that never takes a step is the failure this guards.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : resolve(__dirname, '../../index.html');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };

function startServer(root) {
  return new Promise((res) => {
    const srv = createServer((req, r) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      let fp = join(root, p);
      try { if (existsSync(fp) && statSync(fp).isDirectory()) fp = join(fp, 'index.html'); } catch {}
      if (!existsSync(fp)) { r.writeHead(404); r.end('nf'); return; }
      r.writeHead(200, { 'Content-Type': MIME[extname(fp)] || 'application/octet-stream' });
      r.end(readFileSync(fp));
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

function findExe() {
  for (const c of [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean)) if (existsSync(c)) return c;
  return undefined;
}

// Cases whose hero is actually reachable — these must close all the way.
const MUST_REACH = new Set(['wide-behind-rock', 'huge-around-wall', 'single-around-rock']);

async function main() {
  const server = await startServer(dirname(target));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/${basename(target)}?preview=1`;
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-gpu'] };
  const exe = findExe(); if (exe) launchOpts.executablePath = exe;
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  const failures = [];
  let chase = null;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.__bossChaseTest === 'function', { timeout: 20000 });
    await page.waitForTimeout(700);   // let the preview bootstrap settle onto a real floor

    chase = await page.evaluate(() => window.__bossChaseTest());
    const seen = new Set();
    for (const c of (chase.cases || [])) {
      if (c.err) { failures.push(`${c.label}: threw ${c.err}`); continue; }
      seen.add(c.label);
      if (c.startReach) failures.push(`${c.label}: test not meaningful — body already in reach (start=${c.start})`);
      if (c.stuck) failures.push(`${c.label}: body never moved a single tile (the wedged-behind-cover bug)`);
      if (c.best >= c.start) failures.push(`${c.label}: never got closer (start=${c.start}, best=${c.best})`);
      if (MUST_REACH.has(c.label)) {
        if (!c.reached) failures.push(`${c.label}: never reached the hero (end=${c.end}, start=${c.start}, moves=${c.moves}, trail=${JSON.stringify(c.trail)})`);
      } else if (c.reached) {
        failures.push(`${c.label}: reached a hero that is sealed off — the arena isn't testing what it claims`);
      }
    }
    for (const want of [...MUST_REACH, 'unreachable-hero']) if (!seen.has(want)) failures.push(`missing case: ${want}`);

    if (pageErrors.length) failures.push(`page errors: ${pageErrors.slice(0, 3).join(' | ')}`);
  } finally {
    console.log('boss-pathing: chase', JSON.stringify(chase));
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\nboss-pathing: FAIL');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('\nboss-pathing: PASS — every body routed around cover;',
    (chase.cases || []).map(c => `${c.label} ${c.start}→${c.end} in ${c.moves} steps`).join(', '));
}
main().catch((e) => { console.error(e); process.exit(1); });
