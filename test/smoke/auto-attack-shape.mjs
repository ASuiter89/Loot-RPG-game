// Behavioural test — the AUTO-ATTACK SHAPE (pierce · ricochet · multishot · rebound).
//
// The pure targeting/damage math is unit-tested (test/systems/autoAttackMods.test.js);
// what only the real game can prove is the WIRING: that a granted shape actually
// reaches the aggregator, that one swing then lands on the extra foes, and that a hero
// with NO shape still hits exactly one foe (the whole block must stay inert for the
// overwhelming majority of builds).
//
// Runs the REAL built game in Chromium and drives the exported functions, laying foes
// out by hand so the geometry is deterministic:
//
//        M   T   .   P            hero H at (px,py), swinging RIGHT at T
//        H   .   .   .            T  target        (px+1, py)
//        .   .   .   .            P  pierced       (px+3, py)  — on the line, past T
//        .   R   .   .            M  multishot     (px-1, py)  — in melee reach of H
//                                 R  ricochet      (px+1, py+3) — 3 tiles from T
//
// Only R is placed adjacent to nothing, and P/M sit 2+ tiles from T, so no incidental
// Cleave splash can be mistaken for a shape hit. A melee style is used deliberately:
// pierce is pure geometry and melee multishot needs no line of sight, so the check
// never depends on where the generated floor happens to put its walls. The rebound
// grant makes the ricochet hop line-of-sight-free for the same reason.
//
// Usage: node test/smoke/auto-attack-shape.mjs [path-to-html]   (default: ./index.html)

import { chromium } from 'playwright';
import { existsSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename, extname } from 'node:path';
import http from 'node:http';

const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.map':'application/json' };
function startServer(rootDir) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const filePath = join(rootDir, urlPath === '/' ? 'index.html' : urlPath);
    if (!filePath.startsWith(rootDir)) { res.statusCode = 403; return res.end(); }
    if (!existsSync(filePath)) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
    createReadStream(filePath).pipe(res);
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server)));
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(__dirname, '../../index.html');

if (!existsSync(target)) {
  console.error(`auto-attack-shape: target not found: ${target}`);
  process.exit(2);
}

const exe = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find(p => p && existsSync(p));

async function main() {
  const server = await startServer(dirname(target));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/${basename(target)}`;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-gpu'], ...(exe ? { executablePath: exe } : {}) });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));

  const failures = [];
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
    await page.waitForTimeout(300);

    const out = await page.evaluate(() => {
      const res = { threw: null };
      try {
        // A real Warrior on a real generated floor — the shape nodes used below
        // (Cleaving Force / Titanic Might) live in the Warrior tree.
        window.player.name = window.player.name || 'ShapeTest';
        window.chooseClass('warrior');

        // Live foe objects, reached by tile through the bridged lookup (gameState
        // hands back snapshots, not references). Floor population is random, so walk
        // down until a floor holds the four bodies the layout needs.
        let foes = [];
        for (const floor of [5, 8, 11, 14, 17, 20, 23]) {
          window.enterDungeonAt(1, floor);
          foes = (window.gameState().enemies || []).map(e => window.getEnemyAt(e.x, e.y)).filter(Boolean);
          res.floor = floor;
          if (foes.length >= 4) break;
        }
        res.foeCount = foes.length;
        if (foes.length < 4) return res;   // asserted below

        const px = window.player.x, py = window.player.y;
        const [T, P, M, R] = foes;
        // Park every OTHER foe far away so nothing wanders into the geometry.
        for (const f of foes.slice(4)) { f.x = px + 40; f.y = py + 40; }
        const place = (f, x, y) => { f.x = x; f.y = y; f.fx = x + 0.5; f.fy = y + 0.5; f.size = 1; };
        // Fat, unkillable foes: a death would fire loot/quest paths and muddy the read.
        const arm = (f) => { f.maxHp = 1e7; f.hp = 1e7; f.dead = false; f.shieldT = 0; };
        const layout = () => {
          place(T, px + 1, py); place(P, px + 3, py);
          place(M, px - 1, py); place(R, px + 1, py + 3);
          [T, P, M, R].forEach(arm);
        };

        // Deterministic swing: rng 0 always lands the accuracy roll and always takes
        // the low end of every damage range. Restored before returning.
        const realRandom = Math.random;
        const hpOf = () => [T, P, M, R].map(f => f.hp);
        const swing = () => {
          layout();
          const before = hpOf();
          Math.random = () => 0;
          try { window.attackEnemy(T, { ranged: false, style: 'slash' }); }
          finally { Math.random = realRandom; }
          const after = hpOf();
          return before.map((h, i) => h - after[i]);   // damage per foe, in T/P/M/R order
        };

        // ── 1) NO shape — the block must stay inert: only the mark is struck ──
        window.player.skills = {};
        window.bumpLoadout();
        res.bareMods = window.autoAttackMods();
        res.bareApi = window.gameState().player.offense.autoAttack;
        res.bareDmg = swing();

        // ── 2) Shape granted by ranked passives — pierce + multishot, plus a
        // rebound so the ricochet hop needs no line of sight through a real floor.
        window.player.skills = { w_p12: 5, w_p42: 7 };
        window.bumpLoadout();
        res.passiveMods = window.autoAttackMods();
        // A rank BELOW the threshold must grant nothing.
        window.player.skills = { w_p12: 4 };
        window.bumpLoadout();
        res.underRankMods = window.autoAttackMods();

        // ── 3) Shape granted by a worn signature power (a special weapon) ──
        // A real generated weapon, so the equip gate, active-slot resolve and power
        // lookup all run exactly as they would on a dropped artifact.
        if (!window.equipped.weapon) {
          const w = window.generateItem(1, 1, 'junk', 'weapon');
          w.tutorialGift = true;          // never gated out of the active slots
          window.equipped.weapon = w;
        }
        const wpn = window.equipped.weapon;
        res.hadWeapon = !!wpn;
        if (wpn) {
          res.wpnPowersBefore = (wpn.powers || (wpn.power ? [wpn.power] : [])).slice();
          wpn.powers = ['piercing', 'volleying', 'rebounding'];
          wpn.power = 'piercing';
        }
        window.player.skills = {};
        window.bumpLoadout();
        res.powerMods = window.autoAttackMods();
        res.powerApi = window.gameState().player.offense.autoAttack;
        res.shapedDmg = swing();

        // ── 4) Both sources stack, and the caps hold ──
        window.player.skills = { w_p12: 5, w_p42: 7 };
        window.bumpLoadout();
        res.stackedMods = window.autoAttackMods();

        if (wpn && res.wpnPowersBefore) {
          wpn.powers = res.wpnPowersBefore;
          wpn.power = res.wpnPowersBefore[0] || null;
        }
        window.player.skills = {};
        window.bumpLoadout();
      } catch (e) {
        res.threw = String(e && e.stack ? e.stack : e);
      }
      return res;
    });

    // ---- assertions ----
    if (out.threw) failures.push(`drive threw: ${out.threw}`);
    if (!(out.foeCount >= 4)) failures.push(`floor spawned only ${out.foeCount} foes — need 4 for the layout`);

    const bare = out.bareMods || {};
    if (bare.any !== false) failures.push(`a hero with no power/passive already has a shape: ${JSON.stringify(bare)}`);
    for (const k of ['pierce', 'ricochet', 'multishot', 'bounce']) {
      if ((out.bareApi || {})[k] !== 0) failures.push(`gameState offense.autoAttack.${k} is ${(out.bareApi || {})[k]}, expected 0 with no shape`);
    }
    const bd = out.bareDmg || [];
    if (!(bd[0] > 0)) failures.push(`the mark took no damage on a plain swing (${JSON.stringify(bd)})`);
    if (bd[1] || bd[2] || bd[3]) failures.push(`a shapeless swing spilled onto other foes: ${JSON.stringify(bd)}`);

    const pm = out.passiveMods || {};
    if (pm.pierce !== 1) failures.push(`Cleaving Force at its threshold granted pierce=${pm.pierce}, expected 1`);
    if (pm.multishot !== 1) failures.push(`Titanic Might at its threshold granted multishot=${pm.multishot}, expected 1`);
    if ((out.underRankMods || {}).any !== false) failures.push(`a node BELOW its rank threshold granted a shape: ${JSON.stringify(out.underRankMods)}`);

    if (!out.hadWeapon) failures.push('hero had no weapon equipped — could not test a signature power grant');
    const pw = out.powerMods || {};
    if (pw.pierce !== 1) failures.push(`Piercing power granted pierce=${pw.pierce}, expected 1`);
    if (pw.multishot !== 1) failures.push(`Volleying power granted multishot=${pw.multishot}, expected 1`);
    if (pw.bounce !== 1) failures.push(`Rebounding power granted bounce=${pw.bounce}, expected 1`);
    if (pw.ricochet !== 1) failures.push(`Rebounding did not imply a ricochet to bend (got ${pw.ricochet})`);
    if ((out.powerApi || {}).pierce !== 1) failures.push('gameState offense.autoAttack did not report the worn shape');

    const sd = out.shapedDmg || [];
    if (!(sd[0] > 0)) failures.push(`the mark took no damage on a shaped swing (${JSON.stringify(sd)})`);
    if (!(sd[1] > 0)) failures.push(`PIERCE did not carry into the foe behind the mark (${JSON.stringify(sd)})`);
    if (!(sd[2] > 0)) failures.push(`MULTISHOT did not strike the second foe in reach (${JSON.stringify(sd)})`);
    if (!(sd[3] > 0)) failures.push(`RICOCHET did not carom on to the third foe (${JSON.stringify(sd)})`);
    // Extra hits taper — none may out-damage the blow that spawned them.
    for (const [i, name] of [[1, 'pierce'], [2, 'multishot'], [3, 'ricochet']]) {
      if (sd[i] >= sd[0]) failures.push(`${name} hit for ${sd[i]} — not weaker than the mark's ${sd[0]}`);
    }

    const st = out.stackedMods || {};
    if (st.pierce !== 2) failures.push(`power + passive pierce did not stack (got ${st.pierce}, expected 2)`);
    if (st.multishot !== 2) failures.push(`power + passive multishot did not stack (got ${st.multishot}, expected 2)`);

    if (pageErrors.length) failures.push(`uncaught page errors:\n  - ${pageErrors.join('\n  - ')}`);

    console.log('auto-attack-shape: bare      =', JSON.stringify(out.bareMods), 'dmg', JSON.stringify(out.bareDmg));
    console.log('auto-attack-shape: passives  =', JSON.stringify(out.passiveMods), 'under-rank', JSON.stringify(out.underRankMods));
    console.log('auto-attack-shape: power     =', JSON.stringify(out.powerMods), 'dmg T/P/M/R', JSON.stringify(out.shapedDmg));
    console.log('auto-attack-shape: stacked   =', JSON.stringify(out.stackedMods));
  } catch (e) {
    failures.push(`boot/run failed: ${String(e)}`);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\nAUTO-ATTACK-SHAPE FAILED:');
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log('\nauto-attack-shape: PASS —', target);
}

main().catch((e) => { console.error('auto-attack-shape: unexpected error', e); process.exit(1); });
