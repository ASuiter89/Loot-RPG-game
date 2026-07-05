// End-to-end smoke test for the "objects never block a path" map-build guarantee.
// Boots the real game in Chromium (?preview=1 exposes the audit hooks) and:
//   1) __pathBlockTest() — deterministically seals a 1-wide corridor with (a) solid
//      decor and (b) a shop NPC, then proves clearObjectBlockedPaths() reopens it.
//   2) A sweep over many REAL generated floors (natural mix + forced furniture-dense
//      interiors); __connCheck() must report 0 object-walled-off tiles on EVERY one.
// __connCheck floods the whole map treating solid decor/furniture AND the two shop
// NPCs as walls, so bad:0 means nothing a floor-build placed can strand the hero.
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
  const url = `http://127.0.0.1:${port}/${basename(target)}?preview=1`;
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-gpu'] };
  const exe = findExe(); if (exe) launchOpts.executablePath = exe;
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  const failures = [];
  let heal = null, sweep = null, churn = null;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    // The audit hooks are installed by the ?preview=1 branch (after a 400ms bootstrap).
    await page.waitForFunction(() => typeof window.__connCheck === 'function'
      && typeof window.__pathBlockTest === 'function'
      && typeof window.__previewFloor === 'function'
      && typeof window.__previewIndoor === 'function'
      && typeof window.__decorPlugCheck === 'function', { timeout: 20000 });
    await page.waitForTimeout(700);   // let the preview bootstrap settle onto a real floor

    // 1) Deterministic heal proof — a sealed corridor must be reopened, and the
    //    offending object stripped (decor) / moved (NPC).
    heal = await page.evaluate(() => window.__pathBlockTest());
    for (const c of (heal.cases || [])) {
      if (c.err) { failures.push(`__pathBlockTest ${c.kind} threw: ${c.err}`); continue; }
      if (c.kind === 'decor' || c.kind === 'npc') {
        if (!(c.before > 0)) failures.push(`${c.kind}: seal was not detected before repair (before=${c.before}, expected >0)`);
        if (c.after !== 0) failures.push(`${c.kind}: path still blocked after repair (after=${c.after}, expected 0)`);
      }
      if (c.kind === 'decor' && (!c.freed || !c.anchorGone)) failures.push(`decor: sealing piece not fully removed (freed=${c.freed}, anchorGone=${c.anchorGone})`);
      if (c.kind === 'npc' && !c.moved) failures.push('npc: blocking shop NPC was not relocated off the corridor');
      if (c.kind === 'terminal') {
        // Region behind a terminal-stair join, sealed by an object: foot-unreachable
        // before, reopened by clearing the object after (the Finding B regression).
        if (c.rightBefore !== false) failures.push(`terminal: right region should be foot-unreachable while sealed (rightBefore=${c.rightBefore})`);
        if (c.rightAfter !== true) failures.push(`terminal: right region still unreachable after repair (rightAfter=${c.rightAfter}) — terminal-stair strand not healed`);
        if (!c.freed) failures.push('terminal: sealing object was not cleared');
      }
    }

    // 2) Real-floor sweep — natural mix (varied depths) + forced furniture-dense
    //    interiors. Every floor must be fully walkable with objects in place.
    sweep = await page.evaluate(() => {
      const res = { floors: 0, worstBad: 0, badFloors: [], solidSeen: 0, npcSeen: 0, floorsWithSolids: 0, indoorSeen: 0,
        indoorChecked: 0, plugOutside: 0, plugCorridor: 0, plugFloors: [] };
      const check = (label, indoor) => {
        res.floors++;
        const cc = window.__connCheck();
        if (cc.bad > res.worstBad) res.worstBad = cc.bad;
        if (cc.bad > 0 && res.badFloors.length < 6) res.badFloors.push({ label, bad: cc.bad, detail: cc.detail });
        res.solidSeen += cc.furniture;
        res.npcSeen += cc.npcs;
        if (cc.solids > 0) res.floorsWithSolids++;
        // Interiors only: a wide solid piece (bed/table) must sit inside a room and
        // never straddle a through-corridor tile — the "bed in the hallway" bug.
        // (Outdoor caves aren't room-gated, so only assert this on built interiors.)
        if (indoor) {
          res.indoorChecked++;
          const pc = window.__decorPlugCheck();
          res.plugOutside += pc.outside;
          res.plugCorridor += pc.corridor;
          if ((pc.outside > 0 || pc.corridor > 0) && res.plugFloors.length < 6) res.plugFloors.push({ label, ...pc });
        }
      };
      // A) natural theme mix across many depths (~28% indoor at random)
      for (let lvl = 1; lvl <= 80; lvl++) {
        const info = window.__previewFloor(lvl);
        if (info && info.err) { res.badFloors.push({ label: 'floor' + lvl, err: info.err }); continue; }
        const indoor = !!(info && info.indoor);
        if (indoor) res.indoorSeen++;
        check('floor' + lvl, indoor);
      }
      // B) forced built interiors, cycling every theme
      for (let idx = 0; idx < 8; idx++) {
        for (let rep = 0; rep < 12; rep++) {
          const info = window.__previewIndoor(idx);
          if (info && info.err) { res.badFloors.push({ label: 'indoor' + idx + '.' + rep, err: info.err }); continue; }
          res.indoorSeen++;
          check('indoor' + idx + '.' + rep, true);
        }
      }
      return res;
    });

    // 3) No-churn: on a floor where nothing is actually sealed, re-running the
    //    guarantee must be a no-op — it must NOT strip decor or move a shop NPC. (A
    //    regression here means the repair is "rescuing" an object's own tile.)
    churn = await page.evaluate(() => {
      const res = { checked: 0, furnitureChanged: 0, merchantMoved: 0 };
      for (let lvl = 2; lvl <= 60 && res.checked < 12; lvl++) {
        window.__previewFloor(lvl);
        const cc = window.__connCheck();
        if (cc.solids === 0) continue;               // need objects present to be meaningful
        res.checked++;
        const furnBefore = cc.furniture;
        const mBefore = window.merchant ? window.merchant.x + ',' + window.merchant.y : null;
        window.clearObjectBlockedPaths();            // a clean floor → must change nothing
        const cc2 = window.__connCheck();
        const mAfter = window.merchant ? window.merchant.x + ',' + window.merchant.y : null;
        if (cc2.furniture !== furnBefore) res.furnitureChanged++;
        if (mBefore !== null && mAfter !== null && mBefore !== mAfter) res.merchantMoved++;
      }
      return res;
    });
    if (churn.checked < 5) failures.push(`no-churn check not meaningful: only ${churn.checked} floors with objects`);
    if (churn.furnitureChanged > 0) failures.push(`repair stripped decor on a clean floor (${churn.furnitureChanged} floors) — false-positive strand`);
    if (churn.merchantMoved > 0) failures.push(`repair relocated a merchant on a clean floor (${churn.merchantMoved} floors) — false-positive strand`);

    if (sweep.worstBad !== 0) failures.push(`some floors had object-blocked paths (worstBad=${sweep.worstBad}) — ${JSON.stringify(sweep.badFloors)}`);
    // A wide solid piece plugging a corridor/doorway (a bed in the hallway) — no
    // tile is stranded so __connCheck stays clean, so this is asserted separately.
    if (sweep.plugOutside !== 0 || sweep.plugCorridor !== 0) failures.push(`interior furniture plugged a passage (outsideRoom=${sweep.plugOutside}, throughCorridor=${sweep.plugCorridor}) — ${JSON.stringify(sweep.plugFloors)}`);
    if (sweep.indoorChecked < 50) failures.push(`corridor-plug check not meaningful: only ${sweep.indoorChecked} interiors inspected`);
    // Meaningfulness: the sweep must actually have placed solid objects to reason
    // about — hundreds of solid decor tiles (trees/cacti) plus some shop NPCs.
    if (sweep.solidSeen < 50) failures.push(`test not meaningful: too few solid decor tiles across the sweep (solidSeen=${sweep.solidSeen})`);
    if (sweep.npcSeen < 1) failures.push(`test not meaningful: no shop NPCs appeared across the sweep (npcSeen=${sweep.npcSeen})`);
    if (sweep.floors < 150) failures.push(`swept too few floors (${sweep.floors})`);

    if (pageErrors.length) failures.push(`page errors: ${pageErrors.slice(0, 3).join(' | ')}`);
  } finally {
    console.log('path-connectivity: heal', JSON.stringify(heal));
    console.log('path-connectivity: churn', JSON.stringify(churn));
    console.log('path-connectivity: sweep', JSON.stringify(sweep && { ...sweep, badFloors: sweep.badFloors.slice(0, 3) }));
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\npath-connectivity: FAIL');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('\npath-connectivity: PASS — no object ever blocks a path across',
    sweep.floors, 'floors (' + sweep.solidSeen, 'solid pieces,', sweep.indoorSeen, 'interiors);',
    'no furniture plugged a corridor across', sweep.indoorChecked, 'inspected interiors');
}
main().catch((e) => { console.error(e); process.exit(1); });
