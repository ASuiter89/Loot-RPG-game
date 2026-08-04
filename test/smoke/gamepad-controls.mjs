// Gamepad-controls smoke test — boots the REAL game in Chromium, injects a SYNTHETIC
// standard-mapping gamepad (by overriding navigator.getGamepads so the game's own
// per-frame poll reads it), and drives the controller layer end-to-end: the pad
// reveals body.pad, the left stick moves the hero, a D-pad press fires a play action,
// the L1 modifier gates the face buttons into skills, a menu is navigable with a
// focus ring + tabs, and the virtual cursor toggles. The mouse/touch smokes never
// enter this layer, so this is the guard that controller support keeps working.
//
// Usage: node test/smoke/gamepad-controls.mjs [path-to-html]   (default ./index.html)

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
function findExecutable() {
  for (const c of [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean)) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

// Standard-mapping button indices (mirrors PAD_BTN in game.js).
const BTN = { CROSS: 0, CIRCLE: 1, SQUARE: 2, TRIANGLE: 3, L1: 4, R1: 5, L2: 6, R2: 7,
              SELECT: 8, START: 9, L3: 10, R3: 11, DUP: 12, DDOWN: 13, DLEFT: 14, DRIGHT: 15 };

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : resolve(__dirname, '../../index.html');
if (!existsSync(target)) { console.error(`gamepad: target not found: ${target}`); process.exit(2); }

async function main() {
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-gpu'] };
  const exe = findExecutable();
  if (exe) launchOpts.executablePath = exe;

  const server = await startServer(dirname(target));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/${basename(target)}`;

  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1200, height: 820 } });   // desktop layout
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  const failures = [];
  // Frame-paced helpers: a poll happens each rAF (~16ms); wait a few frames so an
  // edge (prev=up → curr=down) is seen across polls.
  const settle = (ms = 90) => page.waitForTimeout(ms);
  const down = (i) => page.evaluate((i) => { const b = window.__pad.buttons[i]; b.pressed = true; b.value = 1; window.__pad.timestamp = performance.now(); }, i);
  const up = (i) => page.evaluate((i) => { const b = window.__pad.buttons[i]; b.pressed = false; b.value = 0; window.__pad.timestamp = performance.now(); }, i);
  const tap = async (i) => { await down(i); await settle(); await up(i); await settle(); };
  const setAxis = (ax, v) => page.evaluate(({ ax, v }) => { window.__pad.axes[ax] = v; window.__pad.timestamp = performance.now(); }, { ax, v });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
    await page.waitForTimeout(400);

    // Inject the synthetic pad and route the game's poll at it.
    await page.evaluate(() => {
      const mk = () => ({ pressed: false, touched: false, value: 0 });
      window.__pad = { index: 0, id: 'DualSense Wireless Controller', mapping: 'standard',
                       connected: true, buttons: Array.from({ length: 17 }, mk), axes: [0, 0, 0, 0], timestamp: 0 };
      navigator.getGamepads = () => [window.__pad];
    });

    // Boot into a live dungeon floor (dismiss the title so time flows).
    await page.evaluate(() => {
      window.player.name = window.player.name || 'PadTest';
      window.chooseClass(window.player.class || 'warrior');
      window.enterDungeonAt(1, 1);
      window.closeTitle();
    });
    await page.waitForFunction(() => window.gameState && window.gameState().canMove === true, { timeout: 5000 });

    // 1) A pad input reveals body.pad and flips gameState().input to 'pad'.
    await tap(BTN.CROSS);
    const revealed = await page.evaluate(() => ({ pad: document.body.classList.contains('pad'), input: window.gameState().input }));
    if (!revealed.pad) failures.push('body.pad not set after a gamepad button press');
    if (revealed.input !== 'pad') failures.push(`gameState().input is "${revealed.input}" (expected "pad")`);

    // 2) The left stick moves the hero. Floors are random, so try all four directions
    //    and require movement in at least one, with pad-stick suppressing click-to-move.
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let moved = null, sawSuppressed = true;
    for (let d = 0; d < dirs.length && !moved; d++) {
      const [ax, ay] = dirs[d];
      const start = await page.evaluate(() => ({ fx: window.player.fx, fy: window.player.fy }));
      await setAxis(0, ax); await setAxis(1, ay);
      await settle(480);
      const s = await page.evaluate(() => ({ fx: window.player.fx, fy: window.player.fy, moveActive: !!(window.moveTarget && window.moveTarget.active) }));
      if (s.moveActive) sawSuppressed = false;
      await setAxis(0, 0); await setAxis(1, 0);
      await settle(150);
      if (Math.hypot(s.fx - start.fx, s.fy - start.fy) > 0.3) moved = { ax, ay };
    }
    if (!moved) failures.push('left stick did not move the hero in any of the 4 directions');
    if (!sawSuppressed) failures.push('left stick engaged but a click-to-move target stayed active (should be suppressed)');

    // 3) D-pad Left fires the Health potion (a play-context action → its flask cooldown).
    await page.evaluate(() => { window.player.hp = Math.max(1, window.player.maxHp - 100); window.player.potionCdHp = 0; });
    await tap(BTN.DLEFT);
    const potCd = await page.evaluate(() => window.player.potionCdHp);
    if (!(potCd > 0)) failures.push('D-pad Left did not fire the health potion (cooldown never started)');

    // 4) The L1 modifier gates the face buttons: plain □ toggles the log; L1+□ does NOT
    //    (it is skill slot 3), so the log state is unchanged. Clean, setup-free proof.
    const logState = () => page.evaluate(() => { const r = document.getElementById('bottom-row'); return r ? r.classList.contains('log-collapsed') : null; });
    const before = await logState();
    await tap(BTN.SQUARE);                 // plain □ → toggleLog
    const afterPlain = await logState();
    if (afterPlain === before) failures.push('plain □ (Square) did not toggle the combat log');
    await down(BTN.L1); await settle();     // hold L1…
    await tap(BTN.SQUARE);                  // …then □ → skill slot 3, NOT a log toggle
    await up(BTN.L1);
    const afterMod = await logState();
    if (afterMod !== afterPlain) failures.push('L1+□ still toggled the log — the skill modifier does not gate the face buttons');

    // 5) Options opens Settings; the D-pad navigates it (focus ring shows + moves);
    //    R1 switches tabs; ○ closes it.
    await tap(BTN.START);
    await settle(120);
    const settingsOpen = await page.evaluate(() => document.getElementById('settings-menu').classList.contains('open'));
    if (!settingsOpen) failures.push('Options/Start did not open the Settings menu');
    await settle(80);
    const ringInit = await page.evaluate(() => ({ on: document.getElementById('pad-ring').classList.contains('on'), focus: (document.querySelector('.pad-focused') || {}).outerHTML ? document.querySelector('.pad-focused').className : null }));
    if (!ringInit.on) failures.push('focus ring did not appear when the Settings menu opened');
    await tap(BTN.DDOWN); await tap(BTN.DDOWN);
    const ringMoved = await page.evaluate(() => document.getElementById('pad-ring').classList.contains('on'));
    if (!ringMoved) failures.push('focus ring vanished while navigating the Settings menu');
    const tabBefore = await page.evaluate(() => { const t = document.querySelector('.settings-tab-btn.active'); return t ? t.getAttribute('data-tab') : null; });
    await tap(BTN.R1);
    const tabAfter = await page.evaluate(() => { const t = document.querySelector('.settings-tab-btn.active'); return t ? t.getAttribute('data-tab') : null; });
    if (tabBefore && tabAfter === tabBefore) failures.push('R1 did not switch the Settings tab');
    await tap(BTN.CIRCLE);                  // ○ → back / close
    await settle(120);
    const settingsClosed = await page.evaluate(() => !document.getElementById('settings-menu').classList.contains('open'));
    if (!settingsClosed) failures.push('○ (Circle) did not close the Settings menu');

    // 6) R3 toggles the virtual cursor; the right stick moves it; R3 again hides it.
    await tap(BTN.R3);
    await settle(60);
    await setAxis(2, 1); await settle(120); await setAxis(2, 0);
    const cursorOn = await page.evaluate(() => document.getElementById('pad-cursor').classList.contains('on'));
    if (!cursorOn) failures.push('R3 did not show the virtual cursor');
    await tap(BTN.R3);
    await settle(60);
    const cursorOff = await page.evaluate(() => !document.getElementById('pad-cursor').classList.contains('on'));
    if (!cursorOff) failures.push('R3 did not hide the virtual cursor');

    // 7) The AI-play guide documents the controller scheme.
    const guideOk = await page.evaluate(() => Array.isArray(window.gameGuide('gamepad')) && window.gameGuide('gamepad').join(' ').length > 100);
    if (!guideOk) failures.push('gameGuide("gamepad") did not return the controller topic');

    if (pageErrors.length) failures.push(`uncaught page errors:\n  - ${pageErrors.join('\n  - ')}`);

    console.log('gamepad: reveal', revealed, '| moved', moved, '| suppressed', sawSuppressed,
      '| potCd', potCd, '| logGate', { before, afterPlain, afterMod },
      '| settings', { settingsOpen, ringInit: ringInit.on, tabBefore, tabAfter, settingsClosed },
      '| cursor', { cursorOn, cursorOff }, '| guide', guideOk);
  } catch (e) {
    failures.push(`gamepad drive failed: ${String(e).split('\n')[0]}`);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\nGAMEPAD SMOKE FAILED:');
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log('\ngamepad-controls: PASS —', target);
}
main().catch((e) => { console.error('gamepad: unexpected error', e); process.exit(1); });
