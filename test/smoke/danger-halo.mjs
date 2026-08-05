// Danger-halo smoke test — boots the REAL built game in Chromium and proves the
// status/low-HP halo never freezes as a solid colour wash over an open menu.
//
// The halo (#low-hp-vignette) deliberately sits above every panel at z-index
// 9000 so a warning reads over the HUD. Its colour and opacity are driven per
// frame from animNow() — the WORLD clock, which stops dead while a menu holds
// the world. Poisoned + open the Bag and the bloom froze mid-pulse, painting a
// flat green wash across the whole sheet until the menu was closed.
//
// The test raises a poison halo, checks it pulses during play, opens a
// world-pausing overlay and checks the halo is gone (and stays gone across
// frames rather than sitting at a frozen opacity), then closes it and checks
// the halo comes back.
//
// Usage: node test/smoke/danger-halo.mjs [path-to-html]  (default index.html)

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
if (!existsSync(target)) { console.error(`danger-halo: target not found: ${target}`); process.exit(2); }

// Sample the halo's live opacity a few times so a FROZEN value is visible as
// "never zero and never changing", not mistaken for a legitimate pulse.
const sample = async (page, n = 5) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(await page.evaluate(() => {
      const el = document.getElementById('low-hp-vignette');
      return el ? +(el.style.opacity || getComputedStyle(el).opacity || 0) : -1;
    }));
    await page.waitForTimeout(120);
  }
  return out;
};

// Wait for the halo to actually be up before sampling it. The bloom fades in from
// 0 over ~250ms, so sampling the instant it is raised reads two or three zeros
// before it rises — and on a loaded machine the whole 5×120ms window fits inside
// the fade, failing a halo that works fine. Both bloom steps (poison applied, and
// the halo returning after the menu closes) start from 0 and need this; the
// menu-open step must NOT use it, since there the halo is supposed to be absent.
// A timeout is swallowed on purpose: sampling then reports the zeros and fails as
// before, so this waits out the race without weakening the assertion.
const waitForBloom = (page) => page.waitForFunction(() => {
  const el = document.getElementById('low-hp-vignette');
  return el && +(el.style.opacity || 0) > 0;
}, { timeout: 4000 }).catch(() => {});

async function main() {
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-gpu'] };
  const exe = findExecutable();
  if (exe) launchOpts.executablePath = exe;

  const server = await startServer(dirname(target));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/${basename(target)}?preview=1`;
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  const failures = [];
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.__previewStatus === 'function', { timeout: 20000 });
    await page.evaluate(() => window.__previewFloor(3));
    await page.waitForTimeout(300);

    // 1. Poisoned and playing — the green halo blooms.
    const effects = await page.evaluate(() => window.__previewStatus('poison', 60));
    if (!effects.effects.includes('poison')) throw new Error('poison was not applied to the hero');
    await waitForBloom(page);
    const playing = await sample(page);
    console.log('danger-halo: playing opacities', playing.join(', '));
    if (!playing.some((o) => o > 0)) failures.push(`halo never showed while poisoned in play (${playing.join(', ')})`);

    // 2. Open a world-pausing overlay — the halo must clear, not freeze.
    await page.evaluate(() => window.showVersionHistory());
    await page.waitForTimeout(200);
    const paused = await sample(page);
    console.log('danger-halo: menu-open opacities', paused.join(', '));
    if (paused.some((o) => o > 0)) {
      failures.push(`halo still washes the screen with a menu open (${paused.join(', ')}) — a frozen bloom over the panel`);
    }

    // 3. Close it — the halo comes back, so the warning is not lost for good.
    await page.evaluate(() => window.closeVersion());
    await waitForBloom(page);
    const resumed = await sample(page);
    console.log('danger-halo: resumed opacities', resumed.join(', '));
    if (!resumed.some((o) => o > 0)) failures.push(`halo did not return after closing the menu (${resumed.join(', ')})`);

    if (pageErrors.length) failures.push(`uncaught page errors:\n  - ${pageErrors.join('\n  - ')}`);
  } catch (e) {
    failures.push(`danger-halo check failed: ${String(e).split('\n')[0]}`);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\nDANGER-HALO FAILED:');
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log('\ndanger-halo: PASS —', target);
}
main().catch((e) => { console.error('danger-halo: unexpected error', e); process.exit(1); });
