// End-to-end smoke test for the RETURNING-PLAYER boot path: save → reload → CONTINUE.
// Every other suite boots on fresh storage, which takes the tutorial branch and
// skips generateMap() at boot — the exact blind spot that let a module-evaluation
// TDZ crash (endgame `let` state declared below the boot block) black-screen every
// player with a save while all tests stayed green. This suite boots the real game,
// creates a hero, saves, RELOADS with that storage, and asserts: (1) boot completes
// without tripping the guarded-boot recovery or any page error, (2) CONTINUE drops
// into the dungeon, and (3) the map canvas actually paints non-black pixels.
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
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  const failures = [];
  let saved = null, reboot = null, resumed = null, townBoot = null;
  try {
    // ── Boot fresh and create a real saved hero on a dungeon floor ──
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
    await page.waitForTimeout(400);
    saved = await page.evaluate(() => {
      window.player.name = 'ReloadTest';
      window.chooseClass('warrior');
      window.enterDungeonAt(1, 1);
      window.closeTitle();
      for (const id of ['name-overlay', 'class-overlay']) {
        const el = document.getElementById(id); if (el) el.classList.remove('open');
      }
      window.saveGame();
      return { floor: window.gameState().floor, mode: window.gameState().mode, hasSave: !!localStorage.getItem('dungeonLoot_save_v1') };
    });
    if (!saved.hasSave) failures.push('saveGame() left no dungeonLoot_save_v1 in localStorage');

    // ── Reload: THIS is the returning-player boot (hadSave → generateMap at boot) ──
    pageErrors.length = 0; consoleErrors.length = 0;
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
    await page.waitForTimeout(600);
    reboot = await page.evaluate(() => ({ mode: window.gameState().mode, floor: window.gameState().floor }));
    const bootErr = consoleErrors.find((t) => t.includes('[boot]'));
    if (bootErr) failures.push(`reload boot tripped the guarded-boot recovery: ${bootErr.slice(0, 300)}`);
    const drawErr = consoleErrors.find((t) => t.includes('draw failed'));
    if (drawErr) failures.push(`draw() failing after reload: ${drawErr.slice(0, 300)}`);
    if (pageErrors.length) failures.push(`page errors on reload boot: ${pageErrors.slice(0, 3).join(' | ')}`);

    // ── CONTINUE like a returning player, then prove the world actually draws ──
    resumed = await page.evaluate(async () => {
      window.titlePlay();
      await new Promise((r) => setTimeout(r, 900));
      const cs = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height);
      const c = cs[0];
      let lit = 0;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < d.length; i += 64) if (d[i] > 16 || d[i + 1] > 16 || d[i + 2] > 16) lit++;
      return { mode: window.gameState().mode, floor: window.gameState().floor, lit, w: c.width, h: c.height };
    });
    if (resumed.mode !== 'dungeon') failures.push(`CONTINUE did not resume into the dungeon (mode=${resumed.mode})`);
    if (resumed.floor !== saved.floor) failures.push(`resumed on the wrong floor (saved ${saved.floor}, resumed ${resumed.floor})`);
    // A drawn floor lights thousands of sampled pixels; a black canvas lights ~0.
    if (!(resumed.lit > 500)) failures.push(`map canvas is (near-)black after CONTINUE (${resumed.lit} lit samples of a drawn-floor baseline >500)`);
    if (pageErrors.length) failures.push(`page errors after CONTINUE: ${pageErrors.slice(0, 3).join(' | ')}`);

    // ── A save that quit IN TOWN boots through buildTown()/openTownHub() — a
    // different boot branch than generateMap(); cover it too. Munge the save from
    // a game-free page on the same origin (munging while the game runs loses the
    // race to the next autosave, which writes inTown back to false).
    await page.goto(`http://127.0.0.1:${port}/package.json`, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('dungeonLoot_save_v1'));
      d.inTown = true;
      localStorage.setItem('dungeonLoot_save_v1', JSON.stringify(d));
    });
    pageErrors.length = 0; consoleErrors.length = 0;
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
    await page.waitForTimeout(600);
    townBoot = await page.evaluate(async () => {
      const inTown = window.gameState().inTown;
      window.titlePlay();
      await new Promise((r) => setTimeout(r, 900));
      const cs = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height);
      const c = cs[0];
      let lit = 0;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < d.length; i += 64) if (d[i] > 16 || d[i + 1] > 16 || d[i + 2] > 16) lit++;
      return { inTown, lit };
    });
    const townBootErr = consoleErrors.find((t) => t.includes('[boot]'));
    if (townBootErr) failures.push(`town-save reload tripped the guarded-boot recovery: ${townBootErr.slice(0, 300)}`);
    if (townBoot.inTown !== true) failures.push(`town save did not resume in town (inTown=${townBoot.inTown})`);
    if (!(townBoot.lit > 500)) failures.push(`town canvas is (near-)black after CONTINUE (${townBoot.lit} lit samples, expected >500)`);
    if (pageErrors.length) failures.push(`page errors on town-save boot: ${pageErrors.slice(0, 3).join(' | ')}`);
  } finally {
    console.log('continue-save: saved', JSON.stringify(saved));
    console.log('continue-save: reboot', JSON.stringify(reboot));
    console.log('continue-save: resumed', JSON.stringify(resumed));
    console.log('continue-save: townBoot', JSON.stringify(townBoot));
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\ncontinue-save: FAIL');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('\ncontinue-save: PASS');
}
main().catch((e) => { console.error(e); process.exit(1); });
