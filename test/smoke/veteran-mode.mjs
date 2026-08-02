// End-to-end smoke test for the VETERAN game mode on the new-hero name screen.
//
// Regression guard for a two-part bug: the row shipped without a sync handler and
// without a palette of its own, so tapping it flipped the visually-hidden checkbox
// and changed NOTHING on screen — no checkmark, no lit border — which players read
// as "veteran mode can't be selected". And even when it did arm, it only muted the
// teaching layer: boot builds the beach for every fresh hero BEFORE the name screen
// is shown, so the Veteran was still dropped on the shore to fight the scripted
// pack — the label promises "skip the tutorials".
//
// Asserts, driving the row by real taps the way a player does:
//   1. tapping VETERAN arms the checkbox AND lights the row (.on + a ✓ glyph);
//   2. tapping again disarms it, visuals included;
//   3. the row wears its own palette, not Hardcore's crimson;
//   4. the pick survives backing out to the class list and returning;
//   5. submitting with it armed opens on REAL floor 1 — off the shore, graduated,
//      with the teaching layer off and the whole opening kit the beach would have
//      handed over: the starter weapon worn (a fresh hero owns no gear, so skipping
//      the beach must not mean bare fists) and the graduation LEVEL with its stat +
//      skill points (none are granted at spawn — clearing the pack IS the first
//      level-up, so without it a Veteran starts a level down with nothing to spend);
//   6. that kit matches, point for point, what a Guided hero holds after the beach;
//      and
//   7. leaving it alone still starts a Guided hero on the shore.
//
// Usage:
//   node test/smoke/veteran-mode.mjs [path-to-html]   (default: ./index.html)
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
      const fp0 = join(root, decodeURIComponent(req.url.split('?')[0]));
      let fp = fp0;
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

// What the player can actually SEE of a toggle row: armed state, the ✓ glyph the
// .on rule paints into ::after, and the border/background it lights up with.
const readRow = ([rowId, cbId]) => {
  const row = document.getElementById(rowId);
  const cb = document.getElementById(cbId);
  const box = row.querySelector('.hc-tog-box');
  return {
    checked: !!(cb && cb.checked),
    on: row.classList.contains('on'),
    glyph: getComputedStyle(box, '::after').content,
    border: getComputedStyle(row).borderColor,
    bg: getComputedStyle(row).backgroundColor,
    boxBg: getComputedStyle(box).backgroundColor,
  };
};

async function main() {
  const server = await startServer(dirname(target));
  const url = `http://127.0.0.1:${server.address().port}/${basename(target)}`;
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-gpu'] };
  const exe = findExe(); if (exe) launchOpts.executablePath = exe;
  const browser = await chromium.launch(launchOpts);
  // A touch viewport, because that is where the bug was reported: on a phone the
  // hidden checkbox is the ONLY affordance, so silent arming is invisible.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  const failures = [];
  const out = {};

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
    await page.waitForTimeout(400);

    // Walk onboarding the real way: title → class → name screen.
    await page.evaluate(() => { window.titlePlay(); window.chooseClass('warrior'); });
    await page.waitForTimeout(200);

    out.idle = await page.evaluate(readRow, ['classic-toggle', 'classic-checkbox']);
    if (out.idle.checked || out.idle.on) failures.push('VETERAN started armed on a fresh hero');

    // ── 1. A tap must arm it AND say so on screen ────────────────────────────
    await page.locator('#classic-toggle .hc-tog-text').tap();
    await page.waitForTimeout(80);
    out.armed = await page.evaluate(readRow, ['classic-toggle', 'classic-checkbox']);
    if (!out.armed.checked) failures.push('tapping VETERAN did not arm the checkbox');
    if (!out.armed.on) failures.push('VETERAN armed without lighting the row (no .on) — the player sees nothing');
    if (!/✓/.test(out.armed.glyph)) failures.push(`VETERAN armed without a checkmark (::after content = ${out.armed.glyph})`);
    if (out.armed.border === out.idle.border && out.armed.bg === out.idle.bg) {
      failures.push('VETERAN armed with no visible change to the row at all');
    }

    // ── 2. Tapping again must disarm it, visuals included ────────────────────
    await page.locator('#classic-toggle .hc-tog-text').tap();
    await page.waitForTimeout(80);
    const off = await page.evaluate(readRow, ['classic-toggle', 'classic-checkbox']);
    out.disarmed = off;
    if (off.checked || off.on) failures.push('tapping an armed VETERAN did not turn it back off');
    if (/✓/.test(off.glyph)) failures.push('the checkmark survived disarming VETERAN');

    // ── 3. Its own palette — skipping tutorials is not a danger mode ─────────
    await page.locator('#classic-toggle .hc-tog-text').tap();
    await page.locator('#hc-toggle .hc-tog-text').tap();
    await page.waitForTimeout(80);
    const vet = await page.evaluate(readRow, ['classic-toggle', 'classic-checkbox']);
    const hc = await page.evaluate(readRow, ['hc-toggle', 'hc-checkbox']);
    out.palette = { veteran: vet.border, hardcore: hc.border, veteranBox: vet.boxBg, hardcoreBox: hc.boxBg };
    if (vet.border === hc.border && vet.bg === hc.bg) {
      failures.push('VETERAN wears Hardcore\'s crimson — it reads as a third danger mode');
    }
    await page.locator('#hc-toggle .hc-tog-text').tap();   // back off Hardcore; VETERAN stays armed

    // ── 4. The pick survives backing out to the class list and returning ─────
    await page.evaluate(() => { window.nameBack(); window.chooseClass('warrior'); });
    await page.waitForTimeout(150);
    out.afterBack = await page.evaluate(readRow, ['classic-toggle', 'classic-checkbox']);
    if (!out.afterBack.checked || !out.afterBack.on) {
      failures.push('the VETERAN pick was lost backing out to the class list and returning');
    }

    // ── 5. Submitting armed must actually skip the shore ─────────────────────
    await page.evaluate(() => {
      document.getElementById('name-input').value = 'Vet';
      window.submitName();
    });
    await page.waitForTimeout(500);
    out.veteranRun = await page.evaluate(() => {
      const s = window.gameState();
      const w = window.equipped && window.equipped.weapon;
      const p = window.player;
      return { shore: s.shore, floor: s.floor, guided: s.ramp && s.ramp.guided,
               tutorialDone: !!p.tutorialDone, inTown: s.inTown,
               weapon: w ? w.name : null, weaponTier: w ? w.tier : null,
               level: p.level, attrPoints: p.attrPoints || 0, skillPoints: p.skillPoints || 0 };
    });
    if (out.veteranRun.shore) failures.push('a VETERAN hero still woke on the beach tutorial');
    if (!out.veteranRun.tutorialDone) failures.push('a VETERAN hero was not stamped past the tutorial — it can come back');
    if (out.veteranRun.guided !== false) failures.push('a VETERAN hero still carries the guided teaching layer');
    if (out.veteranRun.floor !== 1) failures.push(`a VETERAN hero opened on floor ${out.veteranRun.floor}, want real floor 1`);
    if (!out.veteranRun.weapon) failures.push('a VETERAN hero landed on floor 1 bare-fisted — the shore\'s starter weapon was never handed over');
    // Grey, like the shore's gift: colour is withheld until the first boss falls.
    if (out.veteranRun.weapon && out.veteranRun.weaponTier !== 'junk') {
      failures.push(`the VETERAN starter weapon rolled "${out.veteranRun.weaponTier}", want the shore's grey (junk) gift`);
    }
    if (out.veteranRun.level < 2) {
      failures.push(`a VETERAN hero opened at level ${out.veteranRun.level} — the beach's graduation level was skipped with it`);
    }
    if (!out.veteranRun.skillPoints) failures.push('a VETERAN hero opened with no skill point to spend');
    if (!out.veteranRun.attrPoints) failures.push('a VETERAN hero opened with no attribute points to spend');

    // ── 6. The default is untouched: a Guided hero still gets the shore ──────
    const page2 = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    page2.on('pageerror', (e) => pageErrors.push(String(e)));
    await page2.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page2.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
    await page2.waitForTimeout(400);
    await page2.evaluate(() => {
      window.titlePlay(); window.chooseClass('warrior');
      document.getElementById('name-input').value = 'Guide';
      window.submitName();
    });
    await page2.waitForTimeout(400);
    out.guidedRun = await page2.evaluate(() => {
      const s = window.gameState();
      return { shore: s.shore, guided: s.ramp && s.ramp.guided, foes: (s.enemies || []).length };
    });
    // Graduate the shore the way clearing the pack does (grantBeachLevelUp's exact
    // two lines) and compare kits: the Veteran's head start must be the SAME single
    // level and the SAME point pools, never a richer or poorer opening.
    out.guidedGraduated = await page2.evaluate(() => {
      window.player.xp += window.xpForLevel(window.player.level);
      window.checkLevelUp();
      const p = window.player;
      return { level: p.level, attrPoints: p.attrPoints || 0, skillPoints: p.skillPoints || 0 };
    });
    if (!out.guidedRun.shore) failures.push('a default (Guided) hero no longer starts on the shore — the tutorial was lost for everyone');
    if (out.guidedRun.guided !== true) failures.push('a default hero is no longer Guided');
    for (const k of ['level', 'attrPoints', 'skillPoints']) {
      if (out.veteranRun[k] !== out.guidedGraduated[k]) {
        failures.push(`Veteran ${k} is ${out.veteranRun[k]}, a graduated Guided hero has ${out.guidedGraduated[k]} — the skip changed the opening kit`);
      }
    }
    await page2.close();

    console.log('veteran-mode: idle      =', JSON.stringify(out.idle));
    console.log('veteran-mode: armed     =', JSON.stringify(out.armed));
    console.log('veteran-mode: palette   =', JSON.stringify(out.palette));
    console.log('veteran-mode: veteran   =', JSON.stringify(out.veteranRun));
    console.log('veteran-mode: guided    =', JSON.stringify(out.guidedRun));
    console.log('veteran-mode: gradKit   =', JSON.stringify(out.guidedGraduated));
  } catch (err) {
    failures.push(`exception: ${String(err)}`);
  } finally {
    await browser.close();
    server.close();
  }

  if (pageErrors.length) failures.push(...pageErrors.map((e) => `page error: ${e}`));
  if (failures.length) {
    console.error('\nveteran-mode: FAIL');
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log('\nveteran-mode: PASS —', target);
}

main().catch((e) => { console.error('veteran-mode: unexpected', e); process.exit(1); });
