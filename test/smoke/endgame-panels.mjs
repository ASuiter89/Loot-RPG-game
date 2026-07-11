// Endgame smoke — boots the real game and actually OPENS each of the six endgame
// town panels + drives a couple of interactions, asserting no page error is thrown
// and the panel renders non-empty HTML. The main smoke test pins the gameState()/
// gameGuide() shape but never opens these panels, so this covers the runtime paths
// a player hits (renderCovenants, renderWeave, the Mirrorforge bench, the Pantheon
// altar, the Cycles panel, the Hall of Deeds) which a pure unit test can't reach.
import { chromium } from 'playwright';
import { existsSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename, extname } from 'node:path';
import http from 'node:http';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.map': 'application/json' };
function startServer(rootDir) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath = join(rootDir, urlPath === '/' ? 'index.html' : urlPath);
    if (!filePath.startsWith(rootDir)) { res.statusCode = 403; return res.end(); }
    if (!existsSync(filePath)) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
    createReadStream(filePath).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : resolve(__dirname, '../../index.html');
function findExe() { for (const c of [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean)) if (existsSync(c)) return c; return undefined; }

async function main() {
  const server = await startServer(dirname(target));
  const url = `http://127.0.0.1:${server.address().port}/${basename(target)}`;
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-gpu'] };
  const exe = findExe(); if (exe) launchOpts.executablePath = exe;
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  const failures = [];
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
    await page.waitForTimeout(400);

    // Give the hero enough progression that every service is unlocked + reachable,
    // then open each panel and drive a representative action. All handlers are
    // window-bridged, so we can call them directly (same as an inline onclick).
    const out = await page.evaluate(() => {
      const res = { panels: {}, errors: [] };
      const W = window;
      try {
        // Unlock everything: deep max floor, a boss point, Brutal conquered, Endless.
        W.player.maxFloor = 120; W.player.gateFloor = 120; W.player.milestoneFloor = 120;
        W.player.diffCleared = 3; W.player.level = 60;
        W.player.bossFirstKills = { 5: 1, 10: 1, 15: 1, 25: 1, 50: 1, 75: 1 };
        W.inTown = true;
      } catch (e) { res.errors.push('setup: ' + e); }
      const openAndGrab = (fn) => {
        try {
          W[fn]();
          const el = document.getElementById('town-content');
          const html = el ? el.innerHTML : '';
          return { ok: html.length > 40, len: html.length };
        } catch (e) { return { ok: false, err: String(e) }; }
      };
      res.panels.covenants = openAndGrab('openCovenants');
      // toggle a covenant + clear
      try { const c = (W.gameState && true); W.covToggle && W.covToggle('cov_frenzy'); W.covClearAll && W.covClearAll(); } catch (e) { res.errors.push('covToggle: ' + e); }
      res.panels.weave = openAndGrab('openWeave');
      res.panels.mirrorforge = openAndGrab('openMirrorforge');
      res.panels.pantheon = openAndGrab('openPantheon');
      res.panels.cycles = openAndGrab('openCycles');
      res.panels.deeds = openAndGrab('openDeeds');
      // gameState().endgame must be a populated object.
      try {
        const eg = W.gameState().endgame;
        res.endgameKeys = eg ? Object.keys(eg) : null;
      } catch (e) { res.errors.push('gameState.endgame: ' + e); }
      // Each new gameGuide topic resolves to an array.
      try {
        res.guide = ['covenants', 'weave', 'mirrorforge', 'pantheon', 'cycles', 'deeds']
          .map((t) => Array.isArray(W.gameGuide(t)) && W.gameGuide(t).length > 0);
      } catch (e) { res.errors.push('gameGuide: ' + e); }

      // ── Drive the riskiest interactions end-to-end ──
      res.drive = {};
      // Weave: allocate a real band-1 root node (no prereqs), expect the spend to rise.
      try {
        W.openWeave();
        const before = W.player.weaveBoard && W.player.weaveBoard.nodes ? Object.keys(W.player.weaveBoard.nodes).length : 0;
        W.weaveAllocateUI('ferocity_1');   // band-1 root of the Ferocity constellation
        const after = W.player.weaveBoard && W.player.weaveBoard.nodes ? Object.keys(W.player.weaveBoard.nodes).length : 0;
        res.drive.weaveAllocated = after > before;
      } catch (e) { res.errors.push('weave drive: ' + e); }
      // Mirrorforge: give the hero a rare item + materials, open, exalt its first affix.
      try {
        W.player.aether = 5;
        const it = W.generateItem ? W.generateItem(3, 40) : null;
        if (it) { W.inventory.unshift(it); W.openMirrorforge(); W.mfPick(0); W.mfDo('exalt', 0); res.drive.mirrorforge = true; }
      } catch (e) { res.errors.push('mirrorforge drive: ' + e); }
      // Pantheon: hand over shards for the first god, summon it, run a few world ticks.
      try {
        const boss = W.__egBaseBosses ? W.__egBaseBosses()[0] : null;
        // Can't-afford affordance: with an empty purse the first Summon button must be
        // DISABLED but wrapped in a hover-tip explaining the shortfall — so a disabled
        // button reads as "you can't afford this yet", not an unexplained stop-sign.
        W.player.pinnacleShards = {}; W.player.gold = 0;
        W.openPantheon();
        {
          const b = [...document.querySelectorAll('#town-content .act-btn')].filter((x) => /Summon/.test(x.textContent))[0];
          const wrap = b ? b.closest('.ench-tipwrap') : null;
          res.drive.pantheonSummonDisabled = !!(b && b.disabled);
          res.drive.pantheonSummonTip = !!(wrap && wrap.dataset && /Still need/.test(wrap.dataset.tip || ''));
        }
        // pull the first Summon target id from the rendered panel
        const html = document.getElementById('town-content').innerHTML || '';
        const m = /pantheonSummon\('([^']+)'\)/.exec(html);
        const bid = boss ? boss.id : (m ? m[1] : 'thallor');
        if (bid) {
          // give a generous shard wallet keyed by the real full shard ids the recipes use
          W.player.pinnacleShards = { tideheartShard: 200, voidcinderShard: 200, emberscaleShard: 200, thornseedShard: 200, stormglassShard: 200, hollowechoShard: 200 };
          W.player.gold = 9999999;
          try { W.pantheonSummon(bid); } catch (e) { res.errors.push('pantheonSummon: ' + e); }
          // Truth signals via the gameState() contract (inTown/enemies aren't
          // window-bridged, so read the authoritative snapshot): the fight state
          // machine is armed with a boss + phase, a boss is in the live enemy list,
          // and the hero has transitioned into the arena floor (mode 'dungeon').
          let eg = null, gs = null;
          try { gs = W.gameState(); eg = gs.endgame.pantheon; } catch (e) {}
          res.drive.pantheonState = eg;
          // gs.inTown reads the real module flag (unlike window.inTown); false ⇒ the
          // summon transitioned the hero out of town onto the arena floor. gs.floor is
          // the arena's continuous depth. (gs.mode reads 'title' here only because the
          // boot title overlay is never dismissed in this minimal harness.)
          res.drive.pantheonInTown = gs ? gs.inTown : null;
          res.drive.pantheonFloor = gs ? gs.floor : null;
          res.drive.pantheonBossSpawned = !!(eg && eg.active === true)
            && !!(gs && Array.isArray(gs.enemies) && gs.enemies.some((e) => e && e.isBoss));
          // advance the world a few ticks to exercise egPinnacleTick without error
          if (typeof W.worldTick === 'function') { for (let i = 0; i < 5; i++) W.worldTick(); }
          res.drive.pantheonTicked = true;
        }
      } catch (e) { res.errors.push('pantheon drive: ' + e); }
      return res;
    });

    for (const [name, r] of Object.entries(out.panels)) {
      if (!r || !r.ok) failures.push(`panel ${name} did not render (${r && r.err ? r.err : 'empty len=' + (r && r.len)})`);
    }
    const EG = ['covenants', 'weave', 'mirrorforge', 'pantheon', 'cycle', 'deeds'];
    for (const k of EG) if (!out.endgameKeys || !out.endgameKeys.includes(k)) failures.push(`gameState().endgame missing ${k}`);
    if (!out.guide || out.guide.some((ok) => !ok)) failures.push('a gameGuide endgame topic did not resolve to a non-empty array');
    for (const e of out.errors) failures.push('eval error: ' + e);
    if (pageErrors.length) failures.push('page errors:\n  - ' + pageErrors.join('\n  - '));
    // Interaction assertions (soft where data ids are UI-derived, hard on "no error").
    const d = out.drive || {};
    if (d.weaveAllocated === false) failures.push('Weave allocation did not add a node');
    if (d.pantheonSummonDisabled === false) failures.push('Pantheon Summon button was not disabled while unaffordable');
    if (d.pantheonSummonTip === false) failures.push('Pantheon Summon button lacks the shortfall hover-tip when unaffordable (disabled with no explanation)');
    if (d.pantheonBossSpawned === false) failures.push('Pantheon summon did not spawn the apex boss (state=' + JSON.stringify(d.pantheonState) + ')');
    if (d.pantheonInTown !== false) failures.push('Pantheon summon did not move the hero out of town into the arena (inTown=' + d.pantheonInTown + ', floor=' + d.pantheonFloor + ')');

    console.log('endgame-panels: opened', Object.keys(out.panels).length, 'panels; endgame keys =', (out.endgameKeys || []).join(','));
    console.log('endgame-panels: drive =', JSON.stringify(out.drive || {}));
  } catch (e) {
    failures.push('boot/nav failed: ' + String(e));
  } finally {
    await browser.close(); server.close();
  }
  if (failures.length) { console.error('\nENDGAME-PANELS FAILED:'); for (const f of failures) console.error('  ✗ ' + f); process.exit(1); }
  console.log('\nendgame-panels: PASS —', target);
}
main().catch((e) => { console.error('endgame-panels: unexpected', e); process.exit(1); });
