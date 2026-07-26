// Behavioral smoke test — the three later classes must actually be playable in the
// REAL built shell, not merely present in the data tables. Guards, per class:
//   • the class picker offers it, and choosing it boots a hero with its walk art;
//   • its skill tree renders (roots learnable, branch tabs populated);
//   • the Fortune-Seeker's skills scale off LUCK and the hybrids off BOTH attributes;
//   • the Bloodletter has NO mana pool — bar and flask hidden — and casting a skill
//     spends HEALTH, without ever being able to kill the hero.
//
// Usage:
//   node test/smoke/new-classes.mjs [path-to-html]   (default: ./index.html)

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
if (!existsSync(target)) { console.error(`new-classes: target not found: ${target}`); process.exit(2); }

function findExecutable() {
  const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  return undefined;
}

const NEW_CLASSES = ['fortune', 'windblade', 'bloodletter'];

async function main() {
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-gpu'] };
  const exe = findExecutable();
  if (exe) launchOpts.executablePath = exe;

  const server = await startServer(dirname(target));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/${basename(target)}`;
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  const failures = [];

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
    await page.waitForTimeout(400);

    // Start a real run first. While the title overlay is up the game is halted and
    // guardAction refuses every guarded handler — castSkillById included — so a cast
    // tested from the title screen silently does nothing.
    await page.evaluate(async () => {
      window.player.name = window.player.name || 'ClassTest';
      window.titlePlay();
      await new Promise((r) => setTimeout(r, 700));
    });
    await page.waitForTimeout(300);

    const res = await page.evaluate((classes) => {
      const fail = [];
      const out = { picker: null, perClass: {} };

      // --- the class picker must offer all seven ---
      window.showClassPick();
      const cards = [...document.querySelectorAll('#class-cards .class-card')];
      const offered = cards.map((c) => {
        const m = /chooseClass\('([a-z]+)'\)/.exec(c.getAttribute('onclick') || '');
        return m ? m[1] : null;
      }).filter(Boolean);
      out.picker = offered;
      for (const cls of classes) {
        if (!offered.includes(cls)) fail.push(`class picker does not offer ${cls}`);
      }
      const emptyCard = cards.find((c) => !c.textContent.trim());
      if (emptyCard) fail.push('a class card rendered empty');

      const setup = (cls) => {
        window.player.sex = 'male';   // deliberately wrong for the female class
        window.chooseClass(cls);
        window.player.level = 30;
        window.player.attributes = { might: 40, agility: 40, vitality: 40, spirit: 40, luck: 40 };
        window.player.skillPoints = 40;
        window.recomputeMaxStats();
        window.player.hp = window.player.maxHp;
        window.player.mp = window.player.maxMp;
        window.updateBars();
      };

      for (const cls of classes) {
        setup(cls);
        const info = { cls };
        const st = window.gameState();

        info.class = st.player.class;
        info.maxMp = st.player.maxMp;
        info.skillAttrs = st.player.skillAttrs;
        info.skillResource = st.player.skillResource;
        if (info.class !== cls) fail.push(`${cls}: gameState reports class ${info.class}`);

        // --- walk art: the class must draw as a real sprite, not the atlas fallback ---
        info.hasWalkArt = !!window.heroHasWalkArt(cls);
        if (!info.hasWalkArt) fail.push(`${cls}: no hero walk art registered`);
        info.faceIcon = (window.heroFaceIcon(cls, 'male', 32) || '').slice(0, 5);
        if (!info.faceIcon) fail.push(`${cls}: heroFaceIcon returned nothing`);

        // --- single-sex classes: the body type is fixed and the picker is hidden ---
        info.fixedSex = window.classFixedSex(cls);
        if (!info.fixedSex) fail.push(`${cls}: expected a fixed body type`);
        if (window.player.sex !== info.fixedSex) {
          fail.push(`${cls}: player.sex is ${window.player.sex}, expected ${info.fixedSex}`);
        }
        // Asking for the WRONG body type must still resolve to the one sheet it has.
        const other = info.fixedSex === 'female' ? 'male' : 'female';
        const a = window.heroWalkSheet(cls, info.fixedSex);
        const b = window.heroWalkSheet(cls, other);
        if (!a) fail.push(`${cls}: no walk sheet for its own body type`);
        if (a !== b) fail.push(`${cls}: asking for '${other}' returned a different sheet`);
        // The sheet must be a full 4-direction sheet (4 rows of 48px), not a strip.
        info.sheet = a ? { w: a.naturalWidth, h: a.naturalHeight } : null;
        if (a && a.naturalHeight && a.naturalHeight !== a.naturalWidth) {
          fail.push(`${cls}: walk sheet is ${a.naturalWidth}x${a.naturalHeight}, expected a square 4x4 sheet`);
        }

        // --- the skill tree must render with learnable roots on every branch ---
        const trees = window.classTrees();
        info.passives = (trees.passive || []).length;
        info.actives = (trees.active || []).length;
        if (info.passives !== 30 || info.actives !== 30) {
          fail.push(`${cls}: tree is ${info.passives}p/${info.actives}a, expected 30/30`);
        }
        const roots = (trees.active || []).filter((n) => n.root);
        info.roots = roots.length;
        if (roots.length !== 5) fail.push(`${cls}: ${roots.length} active roots, expected 5`);

        // Learn one root per branch and confirm the points actually spend.
        const before = window.player.skillPoints;
        for (const r of roots) window.buySkill(r.id);
        info.learned = before - window.player.skillPoints;
        if (info.learned !== roots.length) {
          fail.push(`${cls}: learned ${info.learned} of ${roots.length} roots`);
        }

        // The SKILLS panel must render for this class (branch tables present).
        window.switchTab('skills');
        const branchTabs = document.querySelectorAll('#panel-content .sk-btab');
        info.branchTabs = branchTabs.length;
        if (!branchTabs.length) fail.push(`${cls}: SKILLS panel rendered no branch tabs`);

        info.after = {};
        out.perClass[cls] = info;
      }

      // --- Fortune-Seeker: Luck is the skill lane, and it is the ONLY class using it ---
      const f = out.perClass.fortune;
      if (f && (f.skillAttrs || []).join(',') !== 'luck') {
        fail.push(`fortune: skillAttrs = ${JSON.stringify(f.skillAttrs)}, expected ["luck"]`);
      }
      // Raising Luck must raise the Fortune-Seeker's skill damage.
      window.chooseClass('fortune');
      window.player.level = 30;
      window.player.attributes = { might: 20, agility: 20, vitality: 20, spirit: 20, luck: 20 };
      window.recomputeMaxStats();
      const luckBase = window.skillAttrDamage();
      window.player.attributes.luck += 50;
      window.bumpLoadout();
      const luckUp = window.skillAttrDamage();
      if (!(luckUp > luckBase)) fail.push('fortune: +50 Luck did not raise skill damage');
      out.fortuneLuckGain = Math.round(luckUp - luckBase);

      // --- Windblade: BOTH hybrid attributes must pay into the same lane, equally ---
      window.chooseClass('windblade');
      window.player.level = 30;
      window.player.attributes = { might: 20, agility: 20, vitality: 20, spirit: 20, luck: 20 };
      window.bumpLoadout();
      const hBase = window.skillAttrDamage();
      window.player.attributes.agility += 20; window.bumpLoadout();
      const hAgi = window.skillAttrDamage() - hBase;
      window.player.attributes.agility -= 20; window.player.attributes.spirit += 20; window.bumpLoadout();
      const hSpi = window.skillAttrDamage() - hBase;
      out.windbladeGains = { agility: Math.round(hAgi), spirit: Math.round(hSpi) };
      if (!(hAgi > 0) || !(hSpi > 0)) fail.push('windblade: a hybrid attribute paid nothing into skills');
      if (Math.abs(hAgi - hSpi) > 0.001) fail.push('windblade: hybrid attributes pay unequally');

      // --- Bloodletter: no mana at all, and skills cost HEALTH ---
      window.chooseClass('bloodletter');
      window.player.level = 30;
      window.player.attributes = { might: 40, agility: 20, vitality: 40, spirit: 40, luck: 20 };
      window.player.skillPoints = 40;
      window.recomputeMaxStats();
      window.player.hp = window.player.maxHp;
      window.updateBars();

      const bl = { maxMp: window.player.maxMp, mp: window.player.mp };
      if (bl.maxMp !== 0) fail.push(`bloodletter: maxMp is ${bl.maxMp}, expected 0`);

      // Spirit must not conjure a pool for it.
      window.player.attributes.spirit = 200; window.recomputeMaxStats();
      bl.maxMpWithSpirit = window.player.maxMp;
      if (bl.maxMpWithSpirit !== 0) fail.push('bloodletter: Spirit granted it a mana pool');

      // Both MP rows must be OUT of the HUD, and the mana flask gone from the bar.
      const disp = (id) => { const e = document.getElementById(id); return e ? getComputedStyle(e).display : 'missing'; };
      bl.mpBar = disp('mp-stat-bar');
      bl.dhMpBar = disp('dh-mp-vital');
      if (bl.mpBar !== 'none') fail.push(`bloodletter: #mp-stat-bar display is ${bl.mpBar}, expected none`);
      if (bl.dhMpBar !== 'none') fail.push(`bloodletter: #dh-mp-vital display is ${bl.dhMpBar}, expected none`);
      window.renderSkillBar && window.renderSkillBar();
      bl.manaFlask = !!document.querySelector('.skillbar-btn.potion.mana');
      if (bl.manaFlask) fail.push('bloodletter: mana flask still rendered in the skill bar');

      // Skills are refused in town, so drop into a real floor through the real entry
      // point (inTown is a module binding — writing window.inTown does nothing). The
      // arrival animation blocks casting, so the cast itself is a second pass below.
      window.player.skillPoints = 40;
      const root = (window.classTrees().active || []).find((n) => n.root && n.cast && n.cast.shape === 'self');
      if (!root) fail.push('bloodletter: no self-cast root to test with');
      else window.buySkill(root.id);
      bl.rootId = root ? root.id : null;
      window.enterDungeonAt(1, 1);

      out.bloodletter = bl;
      return { fail, out };
    }, NEW_CLASSES);

    failures.push(...res.fail);
    const o = res.out;

    // --- second pass: the town->floor transit animation has to clear before any
    // cast is accepted, so the Bloodletter's life-cost checks run here.
    await page.waitForTimeout(2500);
    const cast = await page.evaluate(() => {
      const fail = [];
      const st = window.gameState();
      const id = window.player._blRoot || null;
      const root = (window.classTrees().active || []).find((n) => n.root && n.cast && n.cast.shape === 'self');
      const out = { inTown: st.inTown, blocking: st.blockingOverlay, transit: st.transit, id: root && root.id };
      if (st.inTown) fail.push('bloodletter: still in town, cannot test casting');
      if (!root) { fail.push('bloodletter: no self-cast root found'); return { fail, out }; }

      // Casting must spend HEALTH.
      window.player.hp = window.player.maxHp;
      window.player.skillCds = {};
      const hpBefore = window.player.hp;
      const fired = window.castSkillById(root.id, { silent: true });
      out.fired = fired;
      out.hpBefore = hpBefore;
      out.hpAfter = window.player.hp;
      out.spent = hpBefore - window.player.hp;
      if (!fired) fail.push(`bloodletter: ${root.id} refused to fire`);
      if (!(out.spent > 0)) fail.push('bloodletter: casting spent no health');
      // The toll is a SHARE of max HP, not a flat number: the same skill on a hero
      // with four times the health must cost about four times as much.
      window.player.skillCds = {};
      const baseSpent = out.spent;
      const baseMaxHp = window.player.maxHp;
      window.player.attributes.vitality += 400;
      window.recomputeMaxStats();
      window.player.hp = window.player.maxHp;
      const bigBefore = window.player.hp;
      window.castSkillById(root.id, { silent: true });
      out.bigMaxHp = window.player.maxHp;
      out.spentAtBigHp = bigBefore - window.player.hp;
      const ratio = (out.spentAtBigHp / baseSpent) / (window.player.maxHp / baseMaxHp);
      out.costScaleRatio = Math.round(ratio * 100) / 100;
      if (!(ratio > 0.9 && ratio < 1.1)) {
        fail.push(`bloodletter: life cost does not track max HP (ratio ${out.costScaleRatio}, want ~1)`);
      }

      // A life cost must NEVER be lethal: at 1 HP the cast is refused, not fatal.
      window.player.hp = 1;
      window.player.skillCds = {};
      const firedAtOne = window.castSkillById(root.id, { silent: true });
      out.firedAtOneHp = firedAtOne;
      out.hpAtOneAfterCast = window.player.hp;
      if (window.player.hp < 1) fail.push(`bloodletter: a life cast dropped HP to ${window.player.hp} — it must never kill`);
      if (firedAtOne) fail.push('bloodletter: a cast fired that the hero could not pay for');
      return { fail, out };
    });
    failures.push(...cast.fail);
    o.bloodletterCast = cast.out;
    console.log('new-classes: picker offers =', o.picker.join(','));
    for (const cls of NEW_CLASSES) {
      const i = o.perClass[cls];
      if (i) {
        console.log(`new-classes: ${cls} = ${JSON.stringify({
          maxMp: i.maxMp, skillAttrs: i.skillAttrs, resource: i.skillResource,
          tree: `${i.passives}p/${i.actives}a`, roots: i.roots, branchTabs: i.branchTabs,
          sex: i.fixedSex, sheet: i.sheet && `${i.sheet.w}x${i.sheet.h}`,
        })}`);
      }
    }
    console.log('new-classes: fortune luck gain =', o.fortuneLuckGain);
    console.log('new-classes: windblade hybrid gains =', JSON.stringify(o.windbladeGains));
    console.log('new-classes: bloodletter =', JSON.stringify(o.bloodletter));
    console.log('new-classes: bloodletter cast =', JSON.stringify(o.bloodletterCast));
  } catch (err) {
    failures.push(`exception: ${String(err)}`);
  } finally {
    await browser.close();
    server.close();
  }

  if (pageErrors.length) failures.push(...pageErrors.map((e) => `page error: ${e}`));
  if (failures.length) {
    console.error('\nnew-classes: FAIL');
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log('\nnew-classes: PASS');
}

main();
