// Behavioral smoke test — loads the REAL game in a real browser (Chromium) and
// asserts it boots and its console API works. This is the characterization
// baseline for "the game still runs": a pure-logic unit test cannot cover canvas
// rendering or the boot sequence, so we drive it end-to-end here.
//
// Usage:
//   node test/smoke/smoke.mjs [path-to-html]   (default: ./index.html)
//
// Exits non-zero on: a boot timeout, an uncaught page exception, or a
// gameState()/gameGuide() shape regression. Chromium is pre-installed in this
// environment (PLAYWRIGHT_BROWSERS_PATH); we never download a browser.

import { chromium } from 'playwright';
import { readFileSync, existsSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename, extname } from 'node:path';
import http from 'node:http';

// A modular Vite build loads its entry as an ES module (`<script type=module
// src=...>`), which a browser refuses to fetch over file:// (CORS). So serve the
// target's directory over HTTP for the smoke run. This also matches how the game
// is actually hosted (static files over HTTP on GitHub Pages).
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.map': 'application/json',
};
function startServer(rootDir) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath = join(rootDir, urlPath === '/' ? 'index.html' : urlPath);
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
  console.error(`smoke: target not found: ${target}`);
  process.exit(2);
}

// Expected top-level shape of the gameState() snapshot and gameGuide() reference.
// These are the AI-play API contract; the refactor must keep them identical.
// Full observed contract at baseline (index.html @ bf3e1b4). Every one of these
// must remain present through the refactor; add to the list only intentionally.
const EXPECTED_STATE_KEYS = [
  'mode', 'canMove', 'blockingOverlay', 'transit', 'inTown', 'floor', 'floorDisplay', 'tier',
  'isBossFloor', 'island', 'modifier', 'floorCleared', 'hostilesLeft', 'stairs', 'player', 'effects',
  'sets', 'skills', 'autoSkill', 'enemies', 'chests', 'coins', 'food', 'vaultKey',
  'carryingKey', 'grave', 'graveSite', 'npcs', 'allies', 'hazards', 'shrines', 'teleporters',
  'quest', 'conquestGate', 'greed', 'menu', 'legend', 'guide', 'map',
];
const EXPECTED_GUIDE_TOPICS = [
  'overview', 'driving', 'controls', 'movement', 'combat', 'healing', 'skills',
  'damage', 'autocast', 'loot', 'autoloot', 'hazards', 'enemies', 'quests', 'progression',
  'character', 'town', 'tips', 'power', 'controller',
];

function findExecutable() {
  // This environment pre-installs Chromium at a fixed path that may not match
  // the version the installed `playwright` package expects, so point directly
  // at the pre-installed binary rather than downloading one.
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/opt/pw-browsers/chromium',
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return undefined; // let Playwright resolve if nothing pre-installed
}

async function main() {
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-gpu'] };
  const exe = findExecutable();
  if (exe) launchOpts.executablePath = exe;

  const server = await startServer(dirname(target));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/${basename(target)}`;

  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const failures = [];

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });

    // The game boots at document end and attaches gameState to window.
    await page.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
    // Give the rAF loop a couple of frames to run.
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const out = { ok: true };
      try {
        const s = window.gameState();
        out.stateKeys = s && typeof s === 'object' ? Object.keys(s) : null;
        out.hasPlayer = !!(s && s.player && typeof s.player === 'object');
        out.legendIsString = typeof (s && s.legend) === 'string';
      } catch (e) {
        out.ok = false;
        out.stateError = String(e);
      }
      try {
        const g = window.gameGuide();
        out.guideTopics = g && g.topics ? g.topics : null;
        // New topics must be reachable via their aliases (returns the topic array,
        // not the {error, topics} object) so an agent can look them up.
        out.aliasTopics = ['transmuter', 'quests', 'greed', 'conquest', 'gambler', 'gamepad']
          .map((t) => Array.isArray(window.gameGuide(t)));
      } catch (e) {
        out.ok = false;
        out.guideError = String(e);
      }
      // The survivability + reach fields an agent reads off player must exist.
      out.playerHasDefense = (() => {
        try {
          const p = window.gameState().player;
          return !!(p && 'defense' in p && 'weaponReach' in p);
        } catch (e) { return false; }
      })();
      out.canvasSized = (() => {
        const c = document.getElementById('canvas');
        return !!(c && c.width > 0 && c.height > 0);
      })();
      // The externalized stylesheet must be applied before game.js's PALETTE
      // snapshot reads getComputedStyle(:root). Confirm the token is a real
      // colour (not the empty/fallback the snapshot would otherwise capture).
      out.goldToken = getComputedStyle(document.documentElement)
        .getPropertyValue('--gold').trim();
      return out;
    });

    if (!result.ok) {
      failures.push(`console API threw: ${result.stateError || ''} ${result.guideError || ''}`);
    }
    if (!result.hasPlayer) failures.push('gameState().player missing');
    if (!result.legendIsString) failures.push('gameState().legend is not a string');
    if (!result.canvasSized) failures.push('#canvas has zero size (render did not size it)');
    if (!/^#|rgb/.test(result.goldToken || '')) {
      failures.push(`--gold token missing/unapplied ("${result.goldToken}") — externalized CSS may not load before PALETTE`);
    }

    for (const k of EXPECTED_STATE_KEYS) {
      if (!result.stateKeys || !result.stateKeys.includes(k)) {
        failures.push(`gameState() missing top-level key: ${k}`);
      }
    }
    for (const t of EXPECTED_GUIDE_TOPICS) {
      if (!result.guideTopics || !result.guideTopics.includes(t)) {
        failures.push(`gameGuide().topics missing: ${t}`);
      }
    }
    if (!result.aliasTopics || result.aliasTopics.some((ok) => !ok)) {
      failures.push('gameGuide alias(es) do not resolve (transmuter/quests/greed/conquest/gambler/gamepad)');
    }
    if (!result.playerHasDefense) {
      failures.push('gameState().player missing defense/weaponReach fields');
    }

    // --- window bridge verification (strangler migration) ---
    // Every inline on*= handler (static markup + JS-generated) resolves its
    // function against window. Assert the whole set is bridged, that live state
    // accessors read through, and that a write (onclick="selectedSkillId=null")
    // reaches the module binding.
    const handlerGlobals = JSON.parse(
      readFileSync(resolve(__dirname, 'handler-globals.json'), 'utf8'),
    );
    const bridge = await page.evaluate((names) => {
      const missing = names.filter((n) => typeof window[n] !== 'function');
      // live read accessors
      const playerOk = window.player && typeof window.player === 'object';
      const stashOk = window.stash && typeof window.stash === 'object';
      // live write accessor round-trip: set via window, read back via window
      const before = window.selectedSkillId;
      window.selectedSkillId = '__smoke_probe__';
      const wroteThrough = window.selectedSkillId === '__smoke_probe__';
      window.selectedSkillId = before; // restore
      return { missing, playerOk, stashOk, wroteThrough };
    }, handlerGlobals);

    if (bridge.missing.length) {
      failures.push(
        `window bridge missing ${bridge.missing.length} handler fn(s): ${bridge.missing.slice(0, 15).join(', ')}${bridge.missing.length > 15 ? ' …' : ''}`,
      );
    }
    if (!bridge.playerOk) failures.push('live accessor window.player did not read through');
    if (!bridge.stashOk) failures.push('live accessor window.stash did not read through');
    if (!bridge.wroteThrough) failures.push('live setter window.selectedSkillId did not write through to the module binding');

    // --- real inline-onclick round trip: click a title button, expect its overlay ---
    try {
      await page.click('#title-cloud', { timeout: 3000 });
      const opened = await page.evaluate(() =>
        document.getElementById('account-overlay')?.classList.contains('open'),
      );
      if (!opened) failures.push('inline onclick="openAccount()" did not open #account-overlay');
      await page.evaluate(() => window.closeAccount && window.closeAccount());
    } catch (e) {
      failures.push(`inline-onclick click test failed: ${String(e).split('\n')[0]}`);
    }

    console.log('smoke: window bridge =', handlerGlobals.length - bridge.missing.length, '/', handlerGlobals.length, 'handler fns present; live accessors', bridge.playerOk && bridge.stashOk && bridge.wroteThrough ? 'ok' : 'FAIL');

    if (pageErrors.length) {
      failures.push(`uncaught page errors:\n  - ${pageErrors.join('\n  - ')}`);
    }

    console.log('smoke: gameState keys =', (result.stateKeys || []).join(', '));
    console.log('smoke: gameGuide topics =', (result.guideTopics || []).length, 'topics');
    console.log('smoke: canvas sized =', result.canvasSized);
    if (consoleErrors.length) {
      console.log(`smoke: (${consoleErrors.length} console.error line(s) — informational, e.g. offline Supabase)`);
    }
  } catch (e) {
    failures.push(`navigation/boot failed: ${String(e)}`);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\nSMOKE FAILED:');
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log('\nsmoke: PASS —', target);
}

main().catch((e) => {
  console.error('smoke: unexpected error', e);
  process.exit(1);
});
