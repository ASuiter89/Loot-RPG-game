// End-to-end smoke test for QUITTING MID-TUTORIAL and coming back.
//
// The opening beach runs at dungeonLevel 1 — the SAME number as the real floor 1 —
// so a save taken on the shore is indistinguishable from a floor-1 save by depth
// alone. Boot used to skip the tutorial whenever ANY save existed, and a brand-new
// hero is saved the moment they pick a class, so returning to the title and loading
// that slot (which reloads the page) dropped the hero into dungeon floor 1 with no
// starter weapon and no shore level-up — the tutorial silently skipped, for good.
//
// This suite boots the real built game and asserts:
//   1. a fresh hero starts on the shore, and the save records it;
//   2. reloading that save comes back to the SHORE — its pack of four identical foes
//      plus one elite — not a generated dungeon floor;
//   3. the slot list labels that hero "The Shore", not "Floor 1";
//   4. a hero who has left for the dungeon stops recording the shore; and
//   5. a save predating the flag is stamped graduated, never dragged back to it.
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

// The shore's signature (see buildTutorialMap): a pack of FOUR foes that are all one
// species, plus exactly one elite that rolled its own type. A generated dungeon floor
// mixes species and never lays out that exact shape.
function isShore(foes) {
  const pack = foes.filter((e) => !e.isElite);
  const species = new Set(pack.map((e) => e.name));
  return foes.length === 5 && pack.length === 4 && species.size === 1;
}
const shapeOf = (foes) => ({ foes: foes.length, elites: foes.filter((e) => e.isElite).length, names: [...new Set(foes.map((e) => e.name))] });

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
  let fresh = null, resumed = null, slotRow = null, descended = null, legacyBoot = null;
  try {
    // ── 1. A brand-new hero begins on the shore, and the save records it ──
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
    await page.waitForTimeout(400);
    fresh = await page.evaluate(() => {
      window.player.name = 'ShoreTest';
      window.chooseClass('warrior');
      window.closeTitle();
      for (const id of ['name-overlay', 'class-overlay']) {
        const el = document.getElementById(id); if (el) el.classList.remove('open');
      }
      window.saveGame();
      const d = JSON.parse(localStorage.getItem('dungeonLoot_save_v1'));
      const gs = window.gameState();
      return {
        foes: gs.enemies.map((e) => ({ name: e.name, isElite: e.isElite })),
        savedTutorial: d && d.tutorial,
        savedFloor: d && d.dungeonLevel,
        level: window.player.level,
      };
    });
    if (fresh.savedTutorial !== true) failures.push(`saveGame() did not record the shore (tutorial=${JSON.stringify(fresh.savedTutorial)})`);
    if (!isShore(fresh.foes)) failures.push(`a fresh hero did not start on the shore — ${JSON.stringify(shapeOf(fresh.foes))}`);

    // ── 2. Reload — exactly what the slot list's Load button does (activateSlot
    //       saves, points ACTIVE_SLOT_KEY at the slot, then reloads the page).
    pageErrors.length = 0; consoleErrors.length = 0;
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
    await page.waitForTimeout(600);
    resumed = await page.evaluate(async () => {
      window.titlePlay();
      await new Promise((r) => setTimeout(r, 900));
      const gs = window.gameState();
      return {
        foes: gs.enemies.map((e) => ({ name: e.name, isElite: e.isElite })),
        floor: gs.floor,
        tutorialDone: !!window.player.tutorialDone,
        level: window.player.level,
        stillTutorial: JSON.parse(localStorage.getItem('dungeonLoot_save_v1')).tutorial,
      };
    });
    const bootErr = consoleErrors.find((t) => t.includes('[boot]'));
    if (bootErr) failures.push(`shore reload tripped the guarded-boot recovery: ${bootErr.slice(0, 300)}`);
    if (pageErrors.length) failures.push(`page errors on shore reload: ${pageErrors.slice(0, 3).join(' | ')}`);
    // THE REGRESSION: this is where a generated dungeon floor 1 used to show up.
    if (!isShore(resumed.foes)) failures.push(`reload did not resume on the shore — ${JSON.stringify(shapeOf(resumed.foes))}, expected a 4-foe single-species pack + 1 elite`);
    if (resumed.tutorialDone) failures.push('resuming the shore wrongly stamped the hero as having graduated');
    if (resumed.level !== 1) failures.push(`resumed hero is level ${resumed.level} — the shore's level-up is earned by clearing it, not by loading`);
    if (resumed.stillTutorial !== true) failures.push('the resumed shore stopped recording itself in the save');

    // ── 3. The slot list must say where that hero actually is ──
    slotRow = await page.evaluate(() => {
      window.openSlots();
      const txt = (document.getElementById('slot-list') || {}).textContent || '';
      window.closeSlots();
      return txt.replace(/\s+/g, ' ').trim();
    });
    if (!/The Shore/.test(slotRow)) failures.push(`slot list does not label the mid-tutorial hero "The Shore" (got: ${slotRow.slice(0, 160)})`);

    // ── 4. Off the shore and into the dungeon — the save must stop claiming it ──
    descended = await page.evaluate(() => {
      window.enterDungeonAt(1, 1);
      window.saveGame();
      const d = JSON.parse(localStorage.getItem('dungeonLoot_save_v1'));
      return { savedTutorial: d.tutorial, savedFloor: d.dungeonLevel };
    });
    if (descended.savedTutorial !== false) failures.push(`a hero in the dungeon still records tutorial=${JSON.stringify(descended.savedTutorial)}`);

    // ── 5. A save that predates the flag carries no `tutorial` field and no
    //       tutorialDone — a hero from before the shore shipped, or one the bug
    //       already carried into the dungeon. Boot must leave them there AND stamp
    //       them graduated, so the post-shore lessons (maybeTeachFirstSpell) stop
    //       being gated off forever. Munge from a game-free page on the same origin,
    //       so no autosave races the write.
    await page.goto(`http://127.0.0.1:${port}/package.json`, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('dungeonLoot_save_v1'));
      delete d.tutorial;
      delete d.player.tutorialDone;
      d.dungeonLevel = 1;   // the ambiguous depth: exactly where the shore also sits
      localStorage.setItem('dungeonLoot_save_v1', JSON.stringify(d));
    });
    pageErrors.length = 0; consoleErrors.length = 0;
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
    await page.waitForTimeout(600);
    legacyBoot = await page.evaluate(async () => {
      window.titlePlay();
      await new Promise((r) => setTimeout(r, 900));
      const gs = window.gameState();
      return { tutorialDone: !!window.player.tutorialDone, floor: gs.floor,
        foes: gs.enemies.map((e) => ({ name: e.name, isElite: e.isElite })) };
    });
    const legacyErr = consoleErrors.find((t) => t.includes('[boot]'));
    if (legacyErr) failures.push(`pre-flag save tripped the guarded-boot recovery: ${legacyErr.slice(0, 300)}`);
    if (!legacyBoot.tutorialDone) failures.push('a save predating the flag was not stamped as having finished the shore');
    if (isShore(legacyBoot.foes)) failures.push('a save predating the flag was dragged back onto the shore');
    if (pageErrors.length) failures.push(`page errors on pre-flag save boot: ${pageErrors.slice(0, 3).join(' | ')}`);
  } finally {
    console.log('tutorial-resume: fresh     ', JSON.stringify(fresh && { ...shapeOf(fresh.foes), savedTutorial: fresh.savedTutorial, savedFloor: fresh.savedFloor }));
    console.log('tutorial-resume: resumed   ', JSON.stringify(resumed && { ...shapeOf(resumed.foes), floor: resumed.floor, level: resumed.level, tutorialDone: resumed.tutorialDone }));
    console.log('tutorial-resume: slotRow   ', JSON.stringify((slotRow || '').slice(0, 120)));
    console.log('tutorial-resume: descended ', JSON.stringify(descended));
    console.log('tutorial-resume: legacyBoot', JSON.stringify(legacyBoot && { ...shapeOf(legacyBoot.foes), floor: legacyBoot.floor, tutorialDone: legacyBoot.tutorialDone }));
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\ntutorial-resume: FAIL');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('\ntutorial-resume: PASS');
}
main().catch((e) => { console.error(e); process.exit(1); });
