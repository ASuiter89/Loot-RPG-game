// Behavioural test — the BOUNTY HUD must show completion correctly:
//
//  1) The belt tracker's progress bar must NOT be stranded empty after the skill
//     bar is rebuilt (e.g. walking into town). This guards the memo-cache fix:
//     a belt rebuild resets both the cached element AND its memo key, so a done
//     contract's full green bar repaints on the fresh markup instead of skipping.
//     The repro pins the memo key IDENTICAL across the rebuild (same prog/need/
//     done) while the markup changes (different objective label) — exactly the
//     case the old code skipped.
//
//  2) Crossing a contract's goal fires the one-shot "Bounty complete!" banner
//     (the shared #loot-banner) with a "RETURN TO TOWN TO CLAIM" kicker, exactly
//     once — the `doneNotified` latch keeps later kills from re-firing it.
//
// Runs the REAL built game in Chromium (like smoke.mjs) and drives the actual
// exported functions, reading the HUD straight off the DOM. Deterministic — no RNG.
//
// Usage: node test/smoke/bounty-hud.mjs [path-to-html]   (default: ./index.html)

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
  console.error(`bounty-hud: target not found: ${target}`);
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
      const res = {};
      const p = window.player;

      // ── 1) Belt bar must survive a rebuild without being stranded empty ──────
      // The belt BOUNTY module only appears once the Bounty Board keeper has arrived
      // (wave 3 — three boss floors felled), so unlock it before painting the belt.
      p.bossFirstKills = { 5: 1, 10: 1, 15: 1 };
      // Contract A: a boss bounty, already done (2/2). Paint the belt.
      p.bestiary = {};
      p.bossKills = 2; p.eliteKills = 0; p.goldEarned = 0; p.clearedFloors = {};
      p.bounty = { kind: 'boss', need: 2, snap: 0, gold: 10, mat: null, ilvl: 5, desc: 'Slay 2 bosses' };
      window.renderSkillBar();

      const fillOf = () => document.querySelector('#hud-belt .sb-mod-bounty .sb-bounty-fill');
      const modOf  = () => document.querySelector('#hud-belt .sb-mod-bounty');
      const progOf = () => document.querySelector('#hud-belt .sb-mod-bounty .sb-bounty-prog');
      res.paintedWidth = fillOf() ? fillOf().style.width : '(no fill el)';
      res.paintedDone  = modOf() ? modOf().classList.contains('done') : false;

      // Contract B: a DIFFERENT objective (label changes -> the bar markup is
      // rebuilt) that lands on the SAME memo key (prog 2 / need 2 / done). The old
      // code skipped the repaint here, stranding the fresh bar at 0 width. (Uses an
      // elite contract off eliteKills — a slay contract reads the account-wide
      // bestiaryDex, not player.bestiary, so it's less convenient to pin here.)
      p.bossKills = 0; p.eliteKills = 2;
      p.bounty = { kind: 'elite', need: 2, snap: 0, gold: 10, mat: null, ilvl: 5, desc: 'Slay 2 elites' };
      window.renderSkillBar();
      res.rebuiltWidth = fillOf() ? fillOf().style.width : '(no fill el)';
      res.rebuiltDone  = modOf() ? modOf().classList.contains('done') : false;
      res.rebuiltProg  = progOf() ? progOf().textContent : '(no prog el)';

      // ── 2) Completion banner fires once on the not-done -> done edge ─────────
      const bannerEl = () => document.getElementById('loot-banner');
      const kickerEl = () => document.getElementById('loot-banner-kicker');
      const titleEl  = () => document.getElementById('loot-banner-title');
      function drive(fn) {
        bannerEl().classList.remove('show');
        titleEl().textContent = '__none__';
        kickerEl().textContent = '__none__';
        let threw = null;
        try { fn(); } catch (e) { threw = String(e); }
        // A prior case may have left the queue "showing"; pump once to surface ours.
        if (!bannerEl().classList.contains('show')) window.playNextLootBanner();
        return { show: bannerEl().classList.contains('show'), title: titleEl().textContent, kicker: kickerEl().textContent, threw };
      }

      // Fresh contract, one short of the goal — no banner yet. The completion cue
      // only fires during live dungeon play, so pin dungeon state (not in town, no
      // title overlay) for a deterministic check.
      window.inTown = false;
      const titleOv = document.getElementById('title-overlay');
      if (titleOv) titleOv.classList.remove('open');
      p.bossKills = 0; p.bestiary = {};
      p.bounty = { kind: 'boss', need: 2, snap: 0, gold: 10, mat: null, ilvl: 5, desc: 'Slay 2 bosses' };
      p.bossKills = 1;
      res.beforeDoneNotified = !!p.bounty.doneNotified;
      // Reset the banner but do NOT pump — nothing should surface on its own.
      bannerEl().classList.remove('show'); titleEl().textContent = '__none__'; kickerEl().textContent = '__none__';
      window.updateObjectiveChip();
      res.inProgressBanner = bannerEl().classList.contains('show');

      // Cross the goal — the banner fires and the latch flips.
      p.bossKills = 2;
      res.complete = drive(() => window.updateObjectiveChip());
      res.doneNotifiedAfter = !!p.bounty.doneNotified;

      // Still done on the next event — the latch must keep it quiet.
      bannerEl().classList.remove('show'); titleEl().textContent = '__none__'; kickerEl().textContent = '__none__';
      window.updateObjectiveChip();
      res.reFiredBanner = bannerEl().classList.contains('show');

      // A completing edge while IN TOWN must NOT pop the banner (a bounty is only
      // ever finished in the dungeon; an in-town edge is a resumed prior-session
      // completion). The latch is still consumed so it can't fire later either.
      window.inTown = true;
      p.bossKills = 1; p.bestiary = {};
      p.bounty = { kind: 'boss', need: 2, snap: 0, gold: 10, mat: null, ilvl: 5, desc: 'Slay 2 bosses' };
      bannerEl().classList.remove('show'); titleEl().textContent = '__none__'; kickerEl().textContent = '__none__';
      p.bossKills = 2;
      window.updateObjectiveChip();
      res.inTownBanner = bannerEl().classList.contains('show');
      res.inTownLatched = !!p.bounty.doneNotified;
      window.inTown = false;

      return res;
    });

    // ---- assertions ----
    const pct = (w) => (typeof w === 'string' && /%$/.test(w)) ? parseFloat(w) : NaN;
    if (pct(out.paintedWidth) !== 100) failures.push(`initial done bounty bar not full (width="${out.paintedWidth}")`);
    if (!out.paintedDone) failures.push('initial done bounty module missing .done class');
    if (pct(out.rebuiltWidth) !== 100) failures.push(`STALENESS BUG: belt bar stranded after rebuild (width="${out.rebuiltWidth}", expected 100%)`);
    if (!out.rebuiltDone) failures.push('rebuilt done bounty module missing .done class');
    if (out.rebuiltProg !== '✓') failures.push(`rebuilt done bounty progress text not "✓" (got "${out.rebuiltProg}")`);

    if (out.beforeDoneNotified) failures.push('doneNotified was set before completion');
    if (out.inProgressBanner) failures.push('completion banner fired while still in progress');
    const c = out.complete || {};
    if (!(c.show && c.title === 'Bounty complete!' && c.kicker === 'RETURN TO TOWN TO CLAIM')) {
      failures.push(`completion banner wrong (show=${c.show}, title="${c.title}", kicker="${c.kicker}"${c.threw ? ', threw: ' + c.threw : ''})`);
    }
    if (!out.doneNotifiedAfter) failures.push('doneNotified latch not set after completion');
    if (out.reFiredBanner) failures.push('completion banner RE-FIRED on a later event — the latch failed');
    if (out.inTownBanner) failures.push('completion banner fired IN TOWN — a resumed completion should not pop a "return to town" banner');
    if (!out.inTownLatched) failures.push('in-town completion did not consume the latch — it could fire later at a wrong time');

    if (pageErrors.length) failures.push(`uncaught page errors:\n  - ${pageErrors.join('\n  - ')}`);

    console.log(`bounty-hud: painted=${out.paintedWidth}/${out.paintedDone}, rebuilt=${out.rebuiltWidth}/${out.rebuiltDone}/${out.rebuiltProg}`);
    console.log(`bounty-hud: banner -> kicker="${(out.complete||{}).kicker}", latched=${out.doneNotifiedAfter}, reFired=${out.reFiredBanner}`);
  } catch (e) {
    failures.push(`boot/run failed: ${String(e)}`);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\nBOUNTY-HUD FAILED:');
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log('\nbounty-hud: PASS —', target);
}

main().catch((e) => { console.error('bounty-hud: unexpected error', e); process.exit(1); });
