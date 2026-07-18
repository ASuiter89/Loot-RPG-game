// End-to-end smoke test for the one-time TOWN WELCOME hint.
//
// The first time the hero climbs into town (after the Floor 5 guardian falls) a
// small, non-blocking greeting appears in the tutorial-hint chip — telling the
// player town is a safe haven they can teleport back to via the Town button. It's
// a glanceable banner, NOT a world-pausing modal. This drives the REAL built game
// in Chromium and guards the whole contract through the public window bridge:
//
//   1. showTownWelcome() shows the #tutorial-hint chip with the right copy
//      (safe haven + teleport + the Town button) and a "Learn more ›" affordance.
//   2. It does NOT open a blocking overlay — gameState().mode is never 'townWelcome'
//      (the old modal is gone), so it never freezes town movement.
//   3. It's LATCHED (player.townWelcomed) — once shown, a second call is a no-op,
//      so the greeting can never replay (even after the chip auto-hides).
//   4. No page errors.
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
      const p = decodeURIComponent(req.url.split('?')[0]);
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

async function main() {
  const server = await startServer(dirname(target));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/${basename(target)}`;
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-gpu'] };
  const exe = findExe(); if (exe) launchOpts.executablePath = exe;
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  const failures = [];
  let r = null;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.showTownWelcome === 'function' && typeof window.gameState === 'function', { timeout: 20000 });
    await page.waitForTimeout(400);

    r = await page.evaluate(() => {
      const out = {};
      const chip = document.getElementById('tutorial-hint');
      out.chipExists = !!chip;
      out.noOverlay = !document.getElementById('town-welcome-overlay');   // old modal fully removed

      // First arrival: not yet welcomed → showTownWelcome() shows the chip.
      window.player.townWelcomed = false;
      chip.classList.remove('show');
      window.showTownWelcome();
      out.shownAfterCall = chip.classList.contains('show');
      out.latchedOnShow = window.player.townWelcomed === true;
      out.chipText = (chip.textContent || '').replace(/\s+/g, ' ').trim();
      out.hasLearnMore = !!chip.querySelector('.th-more');
      out.mode = window.gameState().mode;   // must NOT be a blocking 'townWelcome' overlay

      // Latch: hide it (as the auto-timer would), then a second call must NOT re-show.
      chip.classList.remove('show');
      window.showTownWelcome();
      out.stayedHidden = !chip.classList.contains('show');
      return out;
    });

    if (!r.chipExists) failures.push('#tutorial-hint chip missing from markup');
    if (!r.noOverlay) failures.push('old #town-welcome-overlay modal still present — should be removed');
    if (!r.shownAfterCall) failures.push('showTownWelcome() did not show the tutorial-hint chip');
    if (!r.latchedOnShow) failures.push('showTownWelcome() did not latch player.townWelcomed');
    if (!/safe haven/i.test(r.chipText)) failures.push(`welcome copy missing "safe haven": ${JSON.stringify(r.chipText)}`);
    if (!/teleport/i.test(r.chipText)) failures.push(`welcome copy missing "teleport": ${JSON.stringify(r.chipText)}`);
    if (!/\bTown\b/.test(r.chipText)) failures.push(`welcome copy missing the Town button reference: ${JSON.stringify(r.chipText)}`);
    if (!r.hasLearnMore) failures.push('welcome chip missing the "Learn more ›" affordance');
    if (r.mode === 'townWelcome') failures.push('gameState().mode is a blocking \'townWelcome\' overlay — the greeting must be a non-blocking chip, not a modal');
    if (!r.stayedHidden) failures.push('chip re-showed on a second showTownWelcome() — the once-ever latch failed');

    if (pageErrors.length) failures.push(`page errors: ${pageErrors.slice(0, 3).join(' | ')}`);
  } finally {
    console.log('town-welcome: result', JSON.stringify(r));
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\ntown-welcome: FAIL');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('\ntown-welcome: PASS');
}
main().catch((e) => { console.error(e); process.exit(1); });
