// Behavioural test — the hero must ALWAYS portal into the dungeon facing DOWN.
//
// Guards the fix for "re-entering the dungeon keeps the last-faced direction":
// player.faceDir only updates as the hero moves, so entering through the Gate /
// town portal (enterDungeonAt) used to leave the hero facing whatever way it faced
// when it last left. enterDungeonAt now resets the walk facing (and dash-aim
// vector) to 'down' on every entry.
//
// Runs the REAL built game in Chromium (like smoke.mjs) and drives the actual
// exported functions: pick a class, then enter the dungeon after pointing the hero
// each other way and assert it always lands facing down.
//
// Usage: node test/smoke/dungeon-facing.mjs [path-to-html]   (default: ./index.html)

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
  console.error(`dungeon-facing: target not found: ${target}`);
  process.exit(2);
}

const exe = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find(p => p && existsSync(p));

async function main() {
  const server = await startServer(dirname(target));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/${basename(target)}`;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-gpu'], ...(exe ? { executablePath: exe } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));

  const failures = [];
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
    await page.waitForTimeout(300);

    const out = await page.evaluate(() => {
      const res = { entries: [], threw: null };
      try {
        // A minimal playable hero so enterDungeonAt can build a real floor.
        window.player.name = window.player.name || 'FacingTest';
        window.chooseClass(window.player.class || 'warrior');

        // From each non-down facing, entering the dungeon must snap the hero to
        // 'down'. Cover the gate portal (default) and the conquest portal path
        // (opts.noPortalFx) — both funnel through enterDungeonAt.
        const cases = [
          { from: 'up',    opts: undefined },
          { from: 'left',  opts: undefined },
          { from: 'right', opts: undefined },
          { from: 'up',    opts: { noPortalFx: true } },
        ];
        for (const c of cases) {
          window.player.faceDir = c.from;
          window.player.faceDx = c.from === 'left' ? -1 : c.from === 'right' ? 1 : 0;
          window.player.faceDy = c.from === 'up' ? -1 : 0;
          window.enterDungeonAt(1, 1, c.opts);
          const p = window.gameState().player;
          res.entries.push({
            from: c.from,
            noPortalFx: !!(c.opts && c.opts.noPortalFx),
            faceDir: p.faceDir,
            faceDx: window.player.faceDx,
            faceDy: window.player.faceDy,
          });
        }
      } catch (e) {
        res.threw = String(e);
      }
      return res;
    });

    if (out.threw) failures.push(`drive threw: ${out.threw}`);
    if (out.entries.length !== 4) failures.push(`expected 4 entry cases, got ${out.entries.length}`);
    for (const e of out.entries) {
      const tag = `${e.from}${e.noPortalFx ? ' (conquest portal)' : ' (gate portal)'}`;
      if (e.faceDir !== 'down') failures.push(`entered dungeon from ${tag} but faceDir="${e.faceDir}" (expected "down")`);
      if (!(e.faceDx === 0 && e.faceDy === 1)) failures.push(`entered dungeon from ${tag} but dash-aim=(${e.faceDx},${e.faceDy}) (expected (0,1))`);
    }
    if (pageErrors.length) failures.push(`uncaught page errors:\n  - ${pageErrors.join('\n  - ')}`);

    console.log(`dungeon-facing: ${out.entries.length} entry cases ->`, out.entries.map(e => `${e.from}=>${e.faceDir}`).join(', '));
  } catch (e) {
    failures.push(`boot/run failed: ${String(e)}`);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\nDUNGEON-FACING FAILED:');
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log('\ndungeon-facing: PASS —', target);
}

main().catch((e) => { console.error('dungeon-facing: unexpected error', e); process.exit(1); });
