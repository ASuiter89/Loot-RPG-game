// End-to-end smoke test for warp-checkpoint unlock on floor clear.
//
// A floor's boss falling unseals the down-stairs, which opens the NEXT floor at
// the town Gate — so you can warp there before ever descending. This guards that
// contract two ways, driving the REAL built game in Chromium:
//
//   1. A hero who has beaten the floor-5 boss (clearedFloors[5]) but whose stored
//      depth predates the "a clear runs the tracker a floor ahead" rule still gets
//      floor 6 offered at the Gate after a load+migration — no re-descent needed.
//      (This is the regression the fix targets: pre-feature saves banked the clear
//      without advancing maxFloor, so the checkpoint their boss kill earned was
//      stranded until they physically set foot on the next floor.)
//   2. The frontier a clear-set earns never crosses a finite tier boundary
//      (clearing floor 25 conquers a tier; it must not gate-unlock continuous
//      floor 26 — that's the difficulty gate, tracked separately).
//
// Uses only the public window bridge (player / activeSlot / saveGame / loadGame /
// gateDiff / openGate) — no debug hooks.
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
  let wrote = null, loaded = null, tier = null;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.saveGame === 'function' && typeof window.loadGame === 'function', { timeout: 20000 });
    await page.waitForTimeout(400);

    // --- Write a pre-feature hero: beat the floor-5 boss (clearedFloors 1..5) but
    // depth trackers only at 5, and NO milestoneFloor (predates it). ---
    wrote = await page.evaluate((serializeFn) => {
      window.activeSlot = 1;
      const p = window.player;
      p.class = 'warrior'; p.name = 'GateMigrate'; p.level = 8;
      p.clearedFloors = { 1: true, 2: true, 3: true, 4: true, 5: true };
      p.maxFloor = 5; p.gateFloor = 5;
      delete p.milestoneFloor;
      window.saveGame();
      return { maxFloor: p.maxFloor, gateFloor: p.gateFloor };
    });

    // --- Fresh boot, then load that save (migration runs) and read the Gate. ---
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.loadGame === 'function', { timeout: 20000 });
    await page.waitForTimeout(400);

    loaded = await page.evaluate(() => {
      window.activeSlot = 1;
      const ok = window.loadGame();
      // Render the real Gate for Normal and scrape the floor tiles it offers.
      window.gateDiff = 1;
      window.openGate();
      const buttons = [...document.querySelectorAll('.gate-floor')].map((b) => b.textContent.replace(/[^0-9]/g, ''));
      return {
        ok, maxFloor: window.player.maxFloor, gateFloor: window.player.gateFloor,
        milestone: window.player.milestoneFloor, buttons,
      };
    });

    if (!loaded.ok) failures.push('loadGame() did not load the crafted save');
    if (!loaded.buttons.includes('6'))
      failures.push(`Gate did not offer floor 6 after a floor-5 clear (buttons=${JSON.stringify(loaded.buttons)}) — the migration regression`);
    if (loaded.maxFloor < 6) failures.push(`maxFloor not backfilled from cleared floors (got ${loaded.maxFloor}, want >= 6)`);
    if (loaded.gateFloor < 6) failures.push(`gateFloor not backfilled from cleared floors (got ${loaded.gateFloor}, want >= 6)`);
    // Milestone tracks the physically-reached floor, NOT the clear frontier.
    if (loaded.milestone !== 5) failures.push(`milestoneFloor mis-seeded (got ${loaded.milestone}, want 5 — the physically-reached floor)`);

    // --- Tier-boundary guard: a hero who cleared floor 25 (conquered Normal) must
    // NOT get continuous floor 26 gate-unlocked by the clear backfill. ---
    tier = await page.evaluate(() => {
      window.activeSlot = 2;
      const p = window.player;
      p.class = 'warrior'; p.name = 'TierEdge'; p.level = 20;
      p.clearedFloors = { 24: true, 25: true };
      p.maxFloor = 25; p.gateFloor = 25; p.milestoneFloor = 25;
      p.diffCleared = 1;   // conquered Normal
      window.saveGame();
      window.loadGame();
      return { maxFloor: window.player.maxFloor, gateFloor: window.player.gateFloor };
    });
    if (tier.maxFloor > 25) failures.push(`clear backfill crossed the tier boundary: maxFloor=${tier.maxFloor} (floor-25 clear must not reach continuous 26)`);

    if (pageErrors.length) failures.push(`page errors: ${pageErrors.slice(0, 3).join(' | ')}`);
  } finally {
    console.log('warp-unlock: wrote', JSON.stringify(wrote));
    console.log('warp-unlock: loaded', JSON.stringify(loaded));
    console.log('warp-unlock: tier-edge', JSON.stringify(tier));
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\nwarp-unlock: FAIL');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('\nwarp-unlock: PASS');
}
main().catch((e) => { console.error(e); process.exit(1); });
