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
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

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
  'mode', 'canMove', 'blockingOverlay', 'inTown', 'floor', 'floorDisplay', 'tier',
  'isBossFloor', 'floorCleared', 'hostilesLeft', 'stairs', 'player', 'effects',
  'sets', 'skills', 'autoSkill', 'enemies', 'chests', 'coins', 'food', 'vaultKey',
  'carryingKey', 'grave', 'npcs', 'allies', 'hazards', 'shrines', 'teleporters',
  'menu', 'legend', 'guide', 'devTuning', 'map',
];
const EXPECTED_GUIDE_TOPICS = [
  'overview', 'driving', 'controls', 'movement', 'combat', 'healing', 'skills',
  'damage', 'autocast', 'loot', 'autoloot', 'hazards', 'enemies', 'progression',
  'character', 'town', 'tips', 'dev',
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
    await page.goto(pathToFileURL(target).href, { waitUntil: 'load', timeout: 30000 });

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
      } catch (e) {
        out.ok = false;
        out.guideError = String(e);
      }
      out.canvasSized = (() => {
        const c = document.getElementById('canvas');
        return !!(c && c.width > 0 && c.height > 0);
      })();
      return out;
    });

    if (!result.ok) {
      failures.push(`console API threw: ${result.stateError || ''} ${result.guideError || ''}`);
    }
    if (!result.hasPlayer) failures.push('gameState().player missing');
    if (!result.legendIsString) failures.push('gameState().legend is not a string');
    if (!result.canvasSized) failures.push('#canvas has zero size (render did not size it)');

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
