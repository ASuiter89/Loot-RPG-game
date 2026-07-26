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
//   4. DYING on the shore respawns there, cost-free — a town revive would stamp the
//      hero graduated and skip the tutorial just as surely as the reload bug did;
//   5. the shore's world-pausing HEAL lesson waits for a real wound (Health at or
//      under 75%) instead of firing on the first scratch;
//   6. a hero who has left for the dungeon stops recording the shore; and
//   7. a save predating the flag is stamped graduated, never dragged back to it.
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
  let fresh = null, resumed = null, slotRow = null, shoreDeath = null, healBeat = null, descended = null, legacyBoot = null;
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

    // ── 4. A death on the shore is a RETRY, not a run cut short ──
    //       A town revive ends the tutorial as surely as the reload bug did: a save
    //       taken in town never comes back to the beach, so the cave, the starter
    //       weapon and the shore level-up would all be skipped. Fell one foe first so
    //       the hero is actually carrying the gift a town death would bury in a grave.
    shoreDeath = await page.evaluate(() => {
      const first = window.gameState().enemies[0];
      window.onEnemyDefeated(window.getEnemyAt(first.x, first.y));   // → hands over the starter weapon
      const bagBefore = (window.gameState().menu.inventory || []).length;
      window.player.gold = 250;               // a purse an ordinary death would halve
      window.player.lastStandReady = false;   // spend the free save, so the blow is lethal
      window.player.hp = 0;
      window.handleDeath();
      const gs = window.gameState();
      const d = JSON.parse(localStorage.getItem('dungeonLoot_save_v1'));
      return {
        bagBefore,
        inTown: gs.inTown, shore: gs.shore, floor: gs.floor,
        gold: gs.player.gold, hp: gs.player.hp, maxHp: gs.player.maxHp,
        level: gs.player.level, tutorialDone: !!window.player.tutorialDone,
        bag: (d.inventory || []).length, grave: !!d.graveSite,
        savedTutorial: d.tutorial, savedInTown: d.inTown,
        foes: gs.enemies.map((e) => ({ name: e.name, isElite: e.isElite })),
        sub: ((document.getElementById('death-sub') || {}).textContent || '').trim(),
        button: ((document.getElementById('death-continue') || {}).textContent || '').trim(),
      };
    });
    if (shoreDeath.inTown) failures.push('a death on the shore revived the hero in TOWN — the tutorial is skipped from there');
    if (!shoreDeath.shore) failures.push('gameState().shore is false after a shore death — the hero left the beach');
    if (shoreDeath.savedTutorial !== true || shoreDeath.savedInTown) failures.push(`the post-death save does not record the shore (tutorial=${JSON.stringify(shoreDeath.savedTutorial)}, inTown=${JSON.stringify(shoreDeath.savedInTown)})`);
    if (shoreDeath.tutorialDone) failures.push('a shore death stamped the hero as having graduated the tutorial');
    if (!isShore(shoreDeath.foes)) failures.push(`the shore was not rebuilt after a death — ${JSON.stringify(shapeOf(shoreDeath.foes))}`);
    if (shoreDeath.bagBefore < 1) failures.push('felling the first shore foe did not hand over the starter weapon');
    if (shoreDeath.bag !== shoreDeath.bagBefore) failures.push(`the bag was not kept through a shore death (${shoreDeath.bagBefore} → ${shoreDeath.bag})`);
    if (shoreDeath.grave) failures.push('a shore death dropped the bag as a grave — the starter weapon would be stranded on a floor the hero has never seen');
    if (shoreDeath.gold !== 250) failures.push(`a shore death took gold (250 → ${shoreDeath.gold})`);
    if (shoreDeath.hp !== shoreDeath.maxHp) failures.push(`the hero did not wake at full Health (${shoreDeath.hp}/${shoreDeath.maxHp})`);
    if (/Town/.test(shoreDeath.sub) || /Town/.test(shoreDeath.button)) failures.push(`the death screen still says Town on the shore: "${shoreDeath.sub}" / "${shoreDeath.button}"`);

    // ── 5. The heal lesson waits for a wound worth healing ──
    //       The gate PAUSES the world, so firing it on the first scratch interrupted the
    //       opening exchange over ~7% of a Health bar. It now arms at 75% Health.
    //       (The hero is back on a freshly rebuilt shore from step 4, so the once-per-
    //       shore latch is re-armed and full Health is the honest starting point.)
    healBeat = await page.evaluate(async () => {
      window.closeDeath();                        // dismiss the death card from step 4
      // Wear the step-4 starter weapon first: its own equip gate would otherwise sit
      // in front of the heal beat, exactly as it does in play (equip, then fight).
      if ((window.gameState().menu.inventory || []).length) window.quickEquip(0);
      const gateKind = () => (window.gameState().tutorial || {}).kind || null;
      const foeAt = () => {
        const f = window.gameState().enemies[0];
        return window.getEnemyAt(f.x, f.y);
      };
      window.doDash();                            // any action ends the arrival grace that eats hits
      window.player.hp = window.player.maxHp;
      // A single bite off a full bar is a scratch — the gate must stay shut.
      const scratched = foeAt();
      scratched.atkCd = 0;
      window.enemyAttackPlayer(scratched);
      const afterScratch = { hp: window.player.hp, maxHp: window.player.maxHp, gate: gateKind() };
      // Now wounded past the line: the next landed blow raises the gate. Retry a few
      // times so a dodged swing (no damage, no teach) can't flake the run.
      window.player.hp = Math.floor(window.player.maxHp * 0.7);
      window.player.shield = 0;
      for (let i = 0; i < 5 && gateKind() !== 'potion'; i++) {
        const e = foeAt(); e.atkCd = 0; window.enemyAttackPlayer(e);
      }
      await new Promise((r) => setTimeout(r, 100));
      const gs = window.gameState();
      return {
        afterScratch,
        woundedHp: gs.player.hp,
        gate: gateKind(),
        mode: gs.mode,
        act: (gs.tutorial || {}).act || null,
        banner: ((document.querySelector('#tg-msg .tg-msg-text') || {}).textContent || '').trim(),
      };
    });
    if (healBeat.afterScratch.gate === 'potion') failures.push(`the heal gate fired on a scratch (${healBeat.afterScratch.hp}/${healBeat.afterScratch.maxHp} Health) — it must wait for a real wound`);
    if (healBeat.gate !== 'potion') failures.push(`the heal gate did not raise once Health fell past 75% (gate=${JSON.stringify(healBeat.gate)}, hp=${healBeat.woundedHp})`);
    if (healBeat.gate === 'potion' && healBeat.act !== 'useHealthPotion()') failures.push(`the heal gate names the wrong action for an agent: ${JSON.stringify(healBeat.act)}`);

    // ── 6. Off the shore and into the dungeon — the save must stop claiming it ──
    descended = await page.evaluate(() => {
      window.enterDungeonAt(1, 1);
      window.saveGame();
      const d = JSON.parse(localStorage.getItem('dungeonLoot_save_v1'));
      return { savedTutorial: d.tutorial, savedFloor: d.dungeonLevel };
    });
    if (descended.savedTutorial !== false) failures.push(`a hero in the dungeon still records tutorial=${JSON.stringify(descended.savedTutorial)}`);

    // ── 7. A save that predates the flag carries no `tutorial` field and no
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
    console.log('tutorial-resume: shoreDeath', JSON.stringify(shoreDeath && {
      ...shapeOf(shoreDeath.foes), inTown: shoreDeath.inTown, shore: shoreDeath.shore,
      gold: shoreDeath.gold, bag: `${shoreDeath.bagBefore}→${shoreDeath.bag}`, grave: shoreDeath.grave,
      hp: `${shoreDeath.hp}/${shoreDeath.maxHp}`, button: shoreDeath.button,
    }));
    console.log('tutorial-resume: healBeat  ', JSON.stringify(healBeat && {
      scratch: `${healBeat.afterScratch.hp}/${healBeat.afterScratch.maxHp} gate=${healBeat.afterScratch.gate}`,
      wounded: `${healBeat.woundedHp} gate=${healBeat.gate}`, mode: healBeat.mode,
    }));
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
