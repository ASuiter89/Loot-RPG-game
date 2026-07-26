// Behavioral smoke test — the run modifiers a hero OPTS INTO must actually apply.
//
// Regression guard for a whole family of "advertised but never wired" bugs: the
// seasonal Cycle's headline rule (XP, bounty payout, loot tier shift, enemy affix)
// and the Dread Covenant's healing debuff / rarity + boss-point sweeteners were all
// resolved into live numbers that no call site ever read — the town panels promised
// them and the game applied none of them. It also pins the two skill-cost fixes that
// shipped alongside: Mana Cost Reduction reaching the skill bar, and the auto-cast
// slot holding a health reserve for a blood-caster.
//
// Usage:
//   node test/smoke/run-modifiers.mjs [path-to-html]   (default: ./index.html)
//
// Exits non-zero on any unapplied modifier or page exception.

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

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(__dirname, '../../index.html');
if (!existsSync(target)) { console.error(`run-modifiers: target not found: ${target}`); process.exit(2); }

function findExecutable() {
  for (const c of [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean)) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

async function main() {
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-gpu'] };
  const exe = findExecutable();
  if (exe) launchOpts.executablePath = exe;

  const server = await startServer(dirname(target));
  const url = `http://127.0.0.1:${server.address().port}/${basename(target)}`;
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  const failures = [];

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
    await page.waitForTimeout(400);

    // ── 1. The seasonal Cycle's headline rule ────────────────────────────────
    const season = await page.evaluate(() => {
      const fail = [];
      const out = {};
      const cyc = (window.gameState().endgame || {}).cycle || {};
      out.phase = cyc.phase;
      out.cycleId = cyc.cycleId;
      out.rule = cyc.rule ? cyc.rule.id : null;

      // Un-enrolled is ALWAYS neutral, live season or not — the season must never
      // leak onto a hero who didn't join it.
      window.player.cycleId = null;
      const neutral = window.egCycleMod();
      out.neutral = neutral;
      if (window.egCycleXp(1000) !== 1000) fail.push('un-enrolled hero had their XP scaled');
      if (window.egCyclePayout(1000) !== 1000) fail.push('un-enrolled hero had a payout scaled');
      if (window.egCycleTierShift() !== 0) fail.push('un-enrolled hero had their loot tier shifted');
      if (window.egCycleEnemyAffix() !== null) fail.push('un-enrolled hero met a season affix');
      if (window.egSeasonAtkSpeed() !== 1 || window.egSeasonArmorAdd() !== 0) {
        fail.push('un-enrolled hero met season-affixed foes');
      }

      // With a live season, enrolling must move every knob the rule actually sets.
      if (cyc.phase === 'live' && cyc.cycleId) {
        window.player.cycleId = cyc.cycleId;
        const p = window.egCycleMod();
        out.applied = p;
        const xp = window.grantXp(1000);
        out.xp = xp;
        if (xp !== Math.floor(1000 * p.xpMult)) fail.push(`XP rule not applied: granted ${xp}, want ${Math.floor(1000 * p.xpMult)}`);
        const pay = window.egCyclePayout(1000);
        out.payout = pay;
        if (pay !== Math.floor(1000 * p.bountyPayoutMult)) fail.push(`payout rule not applied: ${pay}`);
        out.tierShift = window.egCycleTierShift();
        if (out.tierShift !== p.lootTierShift) fail.push(`loot tier shift not applied: ${out.tierShift}`);
        out.affix = window.egCycleEnemyAffix();
        if (out.affix !== p.enemyAffix) fail.push(`enemy affix not applied: ${out.affix}`);
        // A named affix must resolve to real numbers at the foe-facing call sites.
        if (p.enemyAffix) {
          const sped = window.egSeasonAtkSpeed(), armor = window.egSeasonArmorAdd();
          out.affixEffects = { atkSpeed: sped, armorAdd: armor };
          if (sped === 1 && armor === 0 && !window.gameState().endgame.cycle.applied.enemyAffixName) {
            fail.push(`season affix "${p.enemyAffix}" resolved to nothing at every call site`);
          }
        }
        window.player.cycleId = null;
      }
      return { fail, out };
    });
    failures.push(...season.fail);

    // ── 2. Dread Covenant difficulty ↔ reward bargain ────────────────────────
    const cov = await page.evaluate(() => {
      const fail = [];
      const out = {};
      window.player.covenantsActive = [];
      window.egDeriveCovenantRun();
      out.baseHeal = window.egCovHeal(100);
      out.baseRarity = window.egCovRarityMult();
      window.player.hp = 1; window.player.maxHp = 1000;
      out.healedUnsworn = window.applyHeal(100, { instant: true });

      // Famine/Starvation carry the healing debuff; the Dread curve carries rarity
      // and the boss-point sweetener.
      window.player.covenantsActive = ['cov_frenzy', 'cov_carapace', 'cov_horde', 'cov_famine'];
      window.egDeriveCovenantRun();
      out.swornHealMult = window.egCovHeal(100) / 100;
      out.swornRarity = window.egCovRarityMult();
      out.swornBossPoint = window.egCovBossPointMult();
      window.player.hp = 1;
      out.healedSworn = window.applyHeal(100, { instant: true });

      if (!(out.swornHealMult < 1)) fail.push('covenant healing debuff did not resolve');
      if (!(out.healedSworn < out.healedUnsworn)) {
        fail.push(`covenant healing debuff not APPLIED: healed ${out.healedSworn} sworn vs ${out.healedUnsworn} un-sworn`);
      }
      if (!(out.swornRarity > 1)) fail.push('covenant rarity sweetener did not resolve');
      if (!(out.swornBossPoint > 1)) fail.push('covenant boss-point sweetener did not resolve');

      // The boss-point sweetener banks a fraction per first clear and pays out a
      // WHOLE point once it crosses 1 (points are derived per boss floor, so the
      // multiplier has nowhere else to go).
      window.player.dreadBossPoints = 0;
      const poolBefore = window.bossPointsPool();
      let paid = 0;
      for (let i = 0; i < 40; i++) paid += window.egCovBankBossPoint();
      out.bankedOver40Clears = paid;
      out.poolGrew = window.bossPointsPool() - poolBefore;
      if (paid < 1) fail.push('covenant boss-point bank never paid out a whole point');
      if (out.poolGrew !== paid) fail.push('banked boss points did not reach the spendable pool');

      // Un-swearing must return every knob to neutral.
      window.player.covenantsActive = [];
      window.egDeriveCovenantRun();
      if (window.egCovHeal(100) !== 100) fail.push('healing stayed docked after un-swearing');
      if (window.egCovRarityMult() !== 1) fail.push('rarity stayed boosted after un-swearing');
      return { fail, out };
    });
    failures.push(...cov.fail);

    // ── 3. Mana Cost Reduction reaches the bar and the printed price ─────────
    const mcr = await page.evaluate(() => {
      const fail = [];
      const out = {};
      window.titlePlay(); window.chooseClass('mage'); window.pickSex('female');
      const el = document.getElementById('name-input'); if (el) el.value = 'Mcr';
      window.submitName();
      window.player.level = 30; window.player.skillPoints = 20;
      // Big attributes so the test ring's gate is met — an ignored ("red") piece
      // lends no stats, and its gate is rolled from a random base word.
      window.player.attributes = { might: 200, agility: 200, vitality: 200, spirit: 200, luck: 200 };
      window.recomputeMaxStats();
      const root = (window.classTrees().active || []).find((n) => n.root);
      window.buySkill(root.id);
      window.bumpLoadout();

      const sk = window.activeSkillList().find((s) => s.id === root.id);
      out.base = sk.mp;
      out.costNoMcr = window.skillCastCost(sk.mp);
      if (out.costNoMcr !== sk.mp) fail.push(`no-MCR cost drifted from the base: ${out.costNoMcr} vs ${sk.mp}`);

      // 100% MCR halves the price (cost = base / (1 + MCR/100)).
      const ring = window.generateItem(1, 20, 'rare', 'ring');
      ring.stats = Object.assign({}, ring.stats, { MCR: 100 });
      window.equipped = Object.assign({}, window.equipped, { ring });
      window.bumpLoadout();
      out.mcr = window.totalStat('MCR');
      out.costWithMcr = window.skillCastCost(sk.mp);
      if (!(out.mcr >= 100)) { fail.push(`test ring did not grant MCR (got ${out.mcr})`); return { fail, out }; }
      if (out.costWithMcr >= out.costNoMcr) fail.push(`MCR did not cut the cast cost (${out.costWithMcr} vs ${out.costNoMcr})`);

      // THE BUG: with mana between the discounted and the undiscounted price, the
      // hero can cast — so the bar must not grey the skill out, and the tooltip must
      // quote the discounted number.
      window.player.mp = out.costNoMcr - 1;
      out.affordable = window.canAffordSkill(sk.mp);
      out.label = window.skillCostText(sk.mp);
      if (!out.affordable) fail.push('a castable skill still reads as unaffordable with MCR gear on');
      if (out.label !== `${out.costWithMcr} MP`) fail.push(`tooltip quotes "${out.label}", charges ${out.costWithMcr} MP`);
      // gameState() reports only SLOTTED skills — the manual row plus the dedicated
      // auto-cast slot, which is reported separately as gameState().autoSkill.
      window.setAutoSkill(root.id);
      const st = window.gameState();
      const snap = (st.autoSkill && st.autoSkill.id === root.id)
        ? st.autoSkill : (st.skills || []).find((s) => s.id === root.id);
      out.stateMp = snap && snap.mp;
      out.stateReady = snap && snap.ready;
      if (!snap) fail.push('gameState() did not report the auto-cast skill');
      else if (out.stateMp !== out.costWithMcr) fail.push(`gameState reports ${out.stateMp} MP, cast charges ${out.costWithMcr}`);
      return { fail, out };
    });
    failures.push(...mcr.fail);

    // ── 4. A blood-caster's auto-cast holds a health reserve ─────────────────
    await page.evaluate(() => {
      window.titlePlay(); window.chooseClass('bloodletter'); window.pickSex('male');
      const el = document.getElementById('name-input'); if (el) el.value = 'Blood';
      window.submitName();
      window.player.level = 30; window.player.skillPoints = 40;
      window.player.attributes = { might: 40, agility: 20, vitality: 40, spirit: 40, luck: 20 };
      window.recomputeMaxStats();
      const root = (window.classTrees().active || []).find((n) => n.root && n.cast && n.cast.shape === 'self');
      window.buySkill(root.id);
      window.setAutoSkill(root.id);
      window.enterDungeonAt(1, 1);
    });
    await page.waitForTimeout(2600);   // the town→floor transit blocks casting

    const blood = await page.evaluate(() => {
      const fail = [];
      const out = {};
      const root = (window.classTrees().active || []).find((n) => n.root && n.cast && n.cast.shape === 'self');
      window.player.hp = window.player.maxHp;
      let fired = 0;
      for (let i = 0; i < 60; i++) {
        window.player.skillCds = {};                       // pretend the cooldown elapsed
        if (window.castSkillById(root.id, { silent: true, auto: true })) fired++;
      }
      out.autoCasts = fired;
      out.hpLeftPct = Math.round((window.player.hp / window.player.maxHp) * 100);
      if (fired === 0) fail.push('auto-cast never fired at full health');
      if (out.hpLeftPct < 45) fail.push(`auto-cast bled the hero to ${out.hpLeftPct}% — the reserve did not hold`);

      // A MANUAL cast is untouched: the player may still spend past the reserve.
      window.player.skillCds = {};
      const before = window.player.hp;
      out.manualFired = window.castSkillById(root.id, { silent: true });
      out.manualSpent = before - window.player.hp;
      if (!out.manualFired || out.manualSpent <= 0) fail.push('a manual blood-cast was blocked by the auto-cast reserve');

      // The price a blood-caster reads is blood, not a mana number they have no pool for.
      const sk = window.activeSkillList().find((s) => s.id === root.id);
      out.label = window.skillCostText(sk.mp);
      if (!/HP$/.test(out.label)) fail.push(`blood-caster tooltip quotes "${out.label}" instead of a health price`);
      return { fail, out };
    });
    failures.push(...blood.fail);

    console.log('run-modifiers: season =', JSON.stringify(season.out));
    console.log('run-modifiers: covenant =', JSON.stringify(cov.out));
    console.log('run-modifiers: mcr =', JSON.stringify(mcr.out));
    console.log('run-modifiers: blood =', JSON.stringify(blood.out));
  } catch (err) {
    failures.push(`exception: ${String(err)}`);
  } finally {
    await browser.close();
    server.close();
  }

  if (pageErrors.length) failures.push(...pageErrors.map((e) => `page error: ${e}`));
  if (failures.length) {
    console.error('\nrun-modifiers: FAIL');
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log('\nrun-modifiers: PASS —', target);
}

main().catch((e) => { console.error('run-modifiers: unexpected', e); process.exit(1); });
