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

    // 1) A real touch pointerdown reveals the touch UI.
    await fireTouch(page, '#canvas', 'pointerdown', px, py);
    const revealed = await page.evaluate(() => ({
      touch: document.body.classList.contains('touch'),
      hudShown: getComputedStyle(document.getElementById('touch-hud')).display !== 'none',
    }));
    if (!revealed.touch) failures.push('body.touch not set after a touch pointerdown');
    if (!revealed.hudShown) failures.push('#touch-hud still display:none after touch reveal');

    // 2) Drag right past the tap slop → the joystick engages and drives the hero.
    const startFx = await page.evaluate(() => window.player.fx);
    await fireTouch(page, '#canvas', 'pointermove', px + 90, py);   // strong rightward push
    await page.waitForTimeout(500);                                  // let the world tick move the hero
    const mid = await page.evaluate(() => ({
      vx: window.player.vx, fx: window.player.fx, joyOn: document.body.classList.contains('joy-on'),
      moveActive: !!(window.moveTarget && window.moveTarget.active),
    }));
    if (!(mid.vx > 0.2)) failures.push(`joystick did not drive rightward velocity (vx=${mid.vx})`);
    if (!(mid.fx > startFx)) failures.push(`hero did not move right under the joystick (fx ${startFx} -> ${mid.fx})`);
    if (!mid.joyOn) failures.push('body.joy-on not set while the stick is engaged');
    if (mid.moveActive) failures.push('joystick engaged but a click-to-move target is also active (should be suppressed)');

    // 3) Release → the stick clears and the hero eases to a stop.
    await fireTouch(page, '#canvas', 'pointerup', px + 90, py);
    await page.waitForTimeout(500);
    const rest = await page.evaluate(() => ({
      vx: window.player.vx, joyOn: document.body.classList.contains('joy-on'),
    }));
    if (rest.joyOn) failures.push('body.joy-on still set after releasing the stick');
    if (!(Math.abs(rest.vx) < Math.abs(mid.vx))) failures.push(`hero did not decelerate after release (vx ${mid.vx} -> ${rest.vx})`);

    // 4) A tap (no drag) still routes through tap-to-move.
    await page.evaluate(() => { if (window.moveTarget) window.moveTarget.active = false; });
    const tx = Math.round(canvasBox.left + canvasBox.w * 0.7);
    const ty = Math.round(canvasBox.top + canvasBox.h * 0.4);
    await fireTouch(page, '#canvas', 'pointerdown', tx, ty, 2);
    await fireTouch(page, '#canvas', 'pointerup', tx, ty, 2);
    await page.waitForTimeout(120);
    const tapped = await page.evaluate(() => !!(window.moveTarget && window.moveTarget.active));
    if (!tapped) failures.push('a tap on the map did not arm tap-to-move (moveTarget.active still false)');

    if (pageErrors.length) failures.push(`uncaught page errors:\n  - ${pageErrors.join('\n  - ')}`);

    console.log('touch: reveal', revealed, '| drag', mid, '| release', rest, '| tap', tapped);
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
