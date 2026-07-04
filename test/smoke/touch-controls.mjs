// Touch-controls smoke test — boots the REAL game in a touch-emulated Chromium
// context and asserts the mobile layer works end-to-end: the touch UI reveals on
// a real touch pointer, the floating joystick moves the hero, releasing it stops
// the hero, and a tap still routes through tap-to-move. The mouse-only smoke.mjs
// never enters this layer, so this is the guard that the touch UI keeps working.
//
// Usage: node test/smoke/touch-controls.mjs [path-to-html]   (default ./index.html)

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

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(__dirname, '../../index.html');
if (!existsSync(target)) { console.error(`touch: target not found: ${target}`); process.exit(2); }

// Dispatch a PointerEvent of pointerType 'touch' on an element in the page.
function fireTouch(page, sel, type, x, y, pointerId = 1) {
  return page.evaluate(({ sel, type, x, y, pointerId }) => {
    const el = document.querySelector(sel);
    el.dispatchEvent(new PointerEvent(type, {
      pointerId, pointerType: 'touch', clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true,
    }));
  }, { sel, type, x, y, pointerId });
}

async function main() {
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-gpu'] };
  const exe = findExecutable();
  if (exe) launchOpts.executablePath = exe;

  const server = await startServer(dirname(target));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/${basename(target)}`;

  const browser = await chromium.launch(launchOpts);
  // Emulate a phone: touch-capable, portrait-ish viewport.
  const page = await browser.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  const failures = [];
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
    await page.waitForTimeout(400);

    // Boot into a live, unpaused dungeon floor (dismiss the title so time flows).
    await page.evaluate(() => {
      window.player.name = window.player.name || 'TouchTest';
      window.chooseClass(window.player.class || 'warrior');
      window.enterDungeonAt(1, 1);
      window.closeTitle();
    });
    await page.waitForFunction(() => window.gameState && window.gameState().canMove === true, { timeout: 5000 });

    const canvasBox = await page.evaluate(() => {
      const c = document.getElementById('canvas');
      const r = c.getBoundingClientRect();
      return { left: r.left, top: r.top, w: r.width, h: r.height };
    });
    // A point on the open map, low-left (a natural joystick spot).
    const px = Math.round(canvasBox.left + canvasBox.w * 0.3);
    const py = Math.round(canvasBox.top + canvasBox.h * 0.6);

    // 1) A real touch tap reveals the touch UI.
    await fireTouch(page, '#canvas', 'pointerdown', px, py);
    await fireTouch(page, '#canvas', 'pointerup', px, py);
    const revealed = await page.evaluate(() => ({
      touch: document.body.classList.contains('touch'),
      hudShown: getComputedStyle(document.getElementById('touch-hud')).display !== 'none',
    }));
    if (!revealed.touch) failures.push('body.touch not set after a touch pointerdown');
    if (!revealed.hudShown) failures.push('#touch-hud still display:none after touch reveal');

    // 2) The joystick drives the hero. Floors are randomly generated, so the hero
    // can be walled on any given side — try all four directions and require it to
    // move in at least one, with the stick engaged and click-to-move suppressed.
    const cx = Math.round(canvasBox.left + canvasBox.w * 0.5);
    const cy = Math.round(canvasBox.top + canvasBox.h * 0.55);
    const dirs = [[90, 0], [-90, 0], [0, 90], [0, -90]];
    let moved = null, sawJoyOn = false, sawSuppressed = true;
    for (let d = 0; d < dirs.length && !moved; d++) {
      const [dx, dy] = dirs[d];
      const start = await page.evaluate(() => ({ fx: window.player.fx, fy: window.player.fy }));
      await fireTouch(page, '#canvas', 'pointerdown', cx, cy, 10 + d);
      await fireTouch(page, '#canvas', 'pointermove', cx + dx, cy + dy, 10 + d);
      await page.waitForTimeout(480);                                 // let the world tick move the hero
      const s = await page.evaluate(() => ({
        fx: window.player.fx, fy: window.player.fy,
        joyOn: document.body.classList.contains('joy-on'),
        moveActive: !!(window.moveTarget && window.moveTarget.active),
      }));
      if (s.joyOn) sawJoyOn = true;
      if (s.moveActive) sawSuppressed = false;                        // stick must suppress click-to-move
      const dist = Math.hypot(s.fx - start.fx, s.fy - start.fy);
      await fireTouch(page, '#canvas', 'pointerup', cx + dx, cy + dy, 10 + d);
      await page.waitForTimeout(200);
      if (dist > 0.3) moved = { dir: [dx, dy], dist };
    }
    if (!moved) failures.push('joystick did not move the hero in any of the 4 directions');
    if (!sawJoyOn) failures.push('body.joy-on never set while the stick was engaged');
    if (!sawSuppressed) failures.push('joystick engaged but a click-to-move target stayed active (should be suppressed)');

    // 3) Every pointer is released now → the stick is cleared.
    const rest = await page.evaluate(() => ({ joyOn: document.body.classList.contains('joy-on') }));
    if (rest.joyOn) failures.push('body.joy-on still set after releasing the stick');

    // 4) A tap (no drag) still routes through tap-to-move.
    await page.evaluate(() => { if (window.moveTarget) window.moveTarget.active = false; });
    const tx = Math.round(canvasBox.left + canvasBox.w * 0.7);
    const ty = Math.round(canvasBox.top + canvasBox.h * 0.4);
    await fireTouch(page, '#canvas', 'pointerdown', tx, ty, 2);
    await fireTouch(page, '#canvas', 'pointerup', tx, ty, 2);
    await page.waitForTimeout(120);
    const tapped = await page.evaluate(() => !!(window.moveTarget && window.moveTarget.active));
    if (!tapped) failures.push('a tap on the map did not arm tap-to-move (moveTarget.active still false)');

    // 5) Footer action buttons: a quick TAP fires the button and does NOT pop the
    //    hover tip; a long-press (hold) pops the tip WITHOUT firing the button. The
    //    health potion is always in the bar and safe to drive (a sip just starts its
    //    shared cooldown), so we use it as the probe. This is the guard for the
    //    "tapping a skill buried the game under a tooltip" fix.
    const POT_SEL = '#skill-bar .skillbar-btn.potion:not(.mana)';
    // A live, off-cooldown potion with room to heal, and no tip on screen.
    const armPotion = () => page.evaluate(() => {
      window.player.hp = Math.max(1, window.player.maxHp - 100);
      window.player.potionCd = 0;
      document.getElementById('hovertip').style.display = 'none';
      if (typeof window.renderSkillBar === 'function') window.renderSkillBar();
    });
    await armPotion();
    const potBox = await page.evaluate((sel) => {
      const b = document.querySelector(sel);
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }, POT_SEL);
    let tapCast = null, tapTip = null, holdTip = null, holdCast = null;
    if (!potBox) failures.push(`no health-potion button found in the touch skill bar (${POT_SEL})`);
    else {
      // Quick tap → the potion fires (cooldown starts) and the tip stays hidden.
      await fireTouch(page, POT_SEL, 'pointerdown', potBox.x, potBox.y, 3);
      await fireTouch(page, POT_SEL, 'pointerup', potBox.x, potBox.y, 3);
      await page.evaluate((sel) => document.querySelector(sel).click(), POT_SEL);   // the click a real tap ends on
      await page.waitForTimeout(60);
      const afterTap = await page.evaluate(() => ({
        tip: getComputedStyle(document.getElementById('hovertip')).display,
        cd: window.player.potionCd,
      }));
      tapTip = afterTap.tip; tapCast = afterTap.cd > 0;
      if (afterTap.tip !== 'none') failures.push('a quick tap on the potion button popped the hover tip (it should only fire the action)');
      if (!(afterTap.cd > 0)) failures.push('a quick tap on the potion button did not fire its action (potion cooldown never started)');

      // Reset, then long-press → the tip pops and the action does NOT fire.
      await armPotion();
      await fireTouch(page, POT_SEL, 'pointerdown', potBox.x, potBox.y, 4);
      await page.waitForTimeout(600);                                               // past the ~450ms hold threshold
      holdTip = await page.evaluate(() => getComputedStyle(document.getElementById('hovertip')).display);
      await fireTouch(page, POT_SEL, 'pointerup', potBox.x, potBox.y, 4);
      await page.evaluate((sel) => document.querySelector(sel).click(), POT_SEL);   // a hold still ends on a click — must be swallowed
      await page.waitForTimeout(60);
      const cdAfterHold = await page.evaluate(() => window.player.potionCd);
      holdCast = cdAfterHold > 0;
      if (holdTip === 'none') failures.push('a long-press on the potion button did not pop the hover tip');
      if (holdCast) failures.push('a long-press on the potion button fired its action (a hold should only inspect)');
    }

    if (pageErrors.length) failures.push(`uncaught page errors:\n  - ${pageErrors.join('\n  - ')}`);

    console.log('touch: reveal', revealed, '| moved', moved, '| joyCleared', !rest.joyOn, '| tap', tapped,
      '| tapCast', tapCast, 'tapTip', tapTip, '| holdTip', holdTip, 'holdCast', holdCast);
  } catch (e) {
    failures.push(`touch drive failed: ${String(e).split('\n')[0]}`);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\nTOUCH SMOKE FAILED:');
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log('\ntouch-controls: PASS —', target);
}
main().catch((e) => { console.error('touch: unexpected error', e); process.exit(1); });
