// End-to-end smoke test for the map-portal traversal feature (walk-through-portal
// teleporters). Boots the real game in Chromium, starts a hero, drops into a dungeon,
// regenerates until a teleporter pair exists, steps the hero onto a pad, and
// asserts: (1) transit flips to 'warp' + canMove false + world frozen, (2) the hero
// is at the partner pad with zeroed velocity, (3) after the window the warp clears,
// the world resumes, and the hero sits still at the dest (pathing was cleared —
// a surviving click-to-move route would drag it off), (4) draw() never threw.
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
  let stepped = null, after = null, setup = null, preStep = null;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
    await page.waitForTimeout(400);

    // Start a hero and drop into a dungeon, then find a floor that has a teleporter pair.
    setup = await page.evaluate(() => {
      window.player.name = 'WarpTest';
      window.player.hp = window.player.maxHp = 9999;   // don't die to a foe mid-test
      window.chooseClass('warrior');
      window.enterDungeonAt(1, 1);
      window.closeTitle();                             // drop the title overlay so mode === 'dungeon'
      for (const id of ['name-overlay', 'class-overlay']) {
        const el = document.getElementById(id); if (el) el.classList.remove('open');
      }
      let pads = [];
      for (let i = 0; i < 400; i++) {
        window.generateMap();
        const t = window.gameState().teleporters || [];
        if (t.length >= 1) { pads = t; break; }
      }
      return { mode: window.gameState().mode, padCount: pads.length, pads: pads.slice(0, 2) };
    });
    if (setup.padCount < 1) failures.push('could not generate a floor with a teleporter pad in 400 tries');

    // Let the town-arrival ('in') animation from enterDungeonAt fully clear, so the
    // teleporter warp is observed on its own (in real play you can't reach a pad
    // during that arrival — the world is frozen — so this mirrors reality).
    await page.waitForTimeout(1100);
    preStep = await page.evaluate(() => {
      const s = window.gameState();
      return { transit: s.transit, mode: s.mode, rtPaused: window.rtPaused() };
    });
    if (preStep.transit !== null) failures.push(`town-arrival did not clear before step (transit=${JSON.stringify(preStep.transit)})`);
    if (preStep.mode !== 'dungeon') failures.push(`not in a live dungeon before step (mode=${preStep.mode})`);
    if (preStep.rtPaused !== false) failures.push(`world unexpectedly paused before step (rtPaused=${preStep.rtPaused})`);

    // Step the hero onto a pad, then read the immediate post-step state. Before the
    // step we ARM a real click-to-move route pointing back at the SOURCE pad — exactly
    // the "walked here via click, then warped" case the headline fix targets. If the
    // warp fails to clear it, the hero would path back toward the source after control
    // returns. moveTargetActive proves the route was cancelled synchronously.
    if (setup.padCount >= 1) stepped = await page.evaluate(() => {
      const pad = window.gameState().teleporters[0];
      window.setPlayerCell(pad.x, pad.y);
      const mt = window.moveTarget;
      mt.active = true; mt.hold = false; mt.path = null; mt.pathIdx = 0;
      mt.wx = pad.x + 0.5; mt.wy = pad.y + 0.5;   // route target sits on the SOURCE pad we're leaving
      window.onEnterCell(pad.x, pad.y);   // fires teleportPad → clearHeld() + beginMapWarp
      const s = window.gameState();
      return {
        src: { x: pad.x, y: pad.y }, dest: { x: pad.toX, y: pad.toY },
        transit: s.transit, canMove: s.canMove, rtPaused: window.rtPaused(),
        moveTargetActive: window.moveTarget.active,
        heroX: window.player.x, heroY: window.player.y,
        heroVx: window.player.vx, heroVy: window.player.vy,
      };
    });

    if (stepped) {
      if (stepped.transit !== 'warp') failures.push(`transit not 'warp' right after step (got ${JSON.stringify(stepped.transit)})`);
      if (stepped.canMove !== false) failures.push(`canMove not false during warp (got ${stepped.canMove})`);
      if (stepped.rtPaused !== true) failures.push(`world not frozen during warp (rtPaused=${stepped.rtPaused})`);
      if (stepped.moveTargetActive !== false) failures.push(`click-to-move route not cleared on warp (moveTarget.active=${stepped.moveTargetActive}) — the headline fix`);
      if (stepped.heroX !== stepped.dest.x || stepped.heroY !== stepped.dest.y)
        failures.push(`hero not moved to dest pad: at (${stepped.heroX},${stepped.heroY}), dest (${stepped.dest.x},${stepped.dest.y})`);
      if (stepped.heroVx !== 0 || stepped.heroVy !== 0)
        failures.push(`hero velocity not zeroed on warp (${stepped.heroVx},${stepped.heroVy})`);
    }

    // Let the animation play out (DUR ~0.9s) — the rAF loop advances warpFx and draws
    // the swallow/pan/emerge every frame; any crash there lands in pageErrors. Then the
    // world resumes: with pathing cleared and no input, the hero must sit still at the
    // dest pad (a surviving click-to-move route would steer it away).
    await page.waitForTimeout(1400);
    after = await page.evaluate(() => {
      const s = window.gameState();
      return { transit: s.transit, canMove: s.canMove, rtPaused: window.rtPaused(), heroX: window.player.x, heroY: window.player.y };
    });
    if (stepped) {
      if (after.transit !== null) failures.push(`transit did not clear after the warp (got ${JSON.stringify(after.transit)})`);
      if (after.canMove !== true) failures.push(`canMove did not return to true after the warp (got ${after.canMove})`);
      if (after.rtPaused !== false) failures.push(`world did not resume after the warp (rtPaused=${after.rtPaused})`);
      if (after.heroX !== stepped.dest.x || after.heroY !== stepped.dest.y)
        failures.push(`hero drifted from dest after warp (pathing not cleared?): at (${after.heroX},${after.heroY}), dest (${stepped.dest.x},${stepped.dest.y})`);
    }

    if (pageErrors.length) failures.push(`page errors during warp: ${pageErrors.slice(0, 3).join(' | ')}`);
  } finally {
    console.log('verify-warp: setup', JSON.stringify(setup));
    console.log('verify-warp: preStep', JSON.stringify(preStep));
    console.log('verify-warp: stepped', JSON.stringify(stepped));
    console.log('verify-warp: after', JSON.stringify(after));
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\nverify-warp: FAIL');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('\nverify-warp: PASS');
}
main().catch((e) => { console.error(e); process.exit(1); });
