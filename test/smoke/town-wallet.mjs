// Behavioral smoke test — a transaction must refresh EVERY on-screen copy of the
// gold / material counts, not just the panel it happened in. Regression guard for
// the bug where selling / salvaging at the merchant left the town-menu header
// (and the merchant's own material strip) stale until you changed menus.
//
// Usage:
//   node test/smoke/town-wallet.mjs [path-to-html]   (default: ./index.html)
//
// Loads the REAL built shell in Chromium, drives the merchant + forge, and asserts
// the persistent readouts (town header gold+mats, bottom HUD gold, LOOT-tab mats,
// merchant mats) all move. Exits non-zero on any stale display or page exception.

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

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(__dirname, '../../index.html');
if (!existsSync(target)) { console.error(`town-wallet: target not found: ${target}`); process.exit(2); }

function findExecutable() {
  const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  return undefined;
}

async function main() {
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-gpu'] };
  const exe = findExecutable();
  if (exe) launchOpts.executablePath = exe;

  const server = await startServer(dirname(target));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/${basename(target)}`;
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  const failures = [];

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.gameState === 'function', { timeout: 20000 });
    await page.waitForTimeout(400);

    const res = await page.evaluate(() => {
      const txt = (id) => { const e = document.getElementById(id); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
      const sel = (s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
      const fail = [];

      // Deterministic-ish setup: real gear, known gold + material baseline.
      window.player.gold = 100;
      window.player.level = 20;
      window.player.maxFloor = 15;
      // Crafting materials are an account-wide shared wallet (in the stash) now, not
      // on the hero — seed a known baseline through the real gain path.
      for (const k of Object.keys(window.freshMaterials())) window.gainMaterial(k, 5);
      window.inventory = [];
      for (let i = 0; i < 10; i++) { const it = window.generateItem(1, 12); if (it) { it.locked = false; window.inventory.push(it); } }
      window.currentTab = 'inv';
      window.renderPanel();
      window.updateBars();

      window.openTownHub();
      window.openTownService('merchant');
      window.shopTab('sell');

      const snap = () => ({
        dhGold: txt('dh-gold-num'),
        hudGold: txt('gold-count'),
        townGold: txt('town-gold-count'),
        townMats: txt('town-mats'),
        lootMats: sel('#panel-content .mat-strip'),
        shopMats: txt('shop-mats'),
        shopGold: txt('shop-gold-count'),
      });

      // The merchant must expose a material strip at all (else salvage is invisible).
      if (!document.getElementById('shop-mats')) fail.push('merchant has no #shop-mats element');

      // --- SCRAP at the merchant: every material readout must move ---
      let before = snap();
      const sIdx = window.inventory.findIndex((it) => !it.locked && it.slot && window.TIERS[it.tier]);
      if (sIdx < 0) { fail.push('setup: no scrappable item generated'); }
      else {
        window.shopScrap(sIdx);
        const after = snap();
        for (const k of ['townMats', 'lootMats', 'shopMats']) {
          if (before[k] === after[k]) fail.push(`scrap at merchant left ${k} stale ("${before[k]}")`);
        }
      }

      // --- SELL at the merchant: every gold readout must move ---
      before = snap();
      const gIdx = window.inventory.findIndex((it) => !it.locked);
      if (gIdx < 0) { fail.push('setup: no sellable item'); }
      else {
        window.shopSell(gIdx);
        const after = snap();
        for (const k of ['dhGold', 'townGold', 'shopGold']) {
          if (before[k] === after[k]) fail.push(`sell at merchant left ${k} stale ("${before[k]}")`);
        }
      }

      // --- A town-overlay service that spends gold + materials (Forge) ---
      // The Craftsman reveals one step at a time (pick item type -> base -> rarity),
      // and craftItem() no-ops until both a slot and a base are chosen, so drive the
      // bench like a player: pick a non-weapon slot, then click the first base the
      // bench reveals.
      window.closeShop();
      window.openTownService('forge');
      const slot = (window.SLOT_KEYS || []).find((s) => s !== 'weapon') || 'head';
      window.forgeSelectSlot(slot);
      const baseBtn = document.querySelector('#town-content .forge-bases .forge-opt');
      if (!baseBtn) {
        fail.push('forge: base list did not open after picking an item type');
      } else {
        baseBtn.click(); // -> forgeSelectBase(...) via the inline handler bridge
        window.forgeSelectTier('normal');
        // Guarantee the craft is affordable (scrap yields are random). Gold AND
        // materials are kept under 1000 so the abbreviator shows exact digits — a
        // small craft cost would otherwise round to the same "Nk" and read as
        // unchanged. Materials start near zero at this point, so +500 stays under 1000.
        window.player.gold = 999;
        for (const k of Object.keys(window.freshMaterials())) window.gainMaterial(k, 500);
        window.updateBars(); // paint the pre-craft gold/material totals
        before = snap();
        window.craftItem();
        const afterForge = snap();
        for (const k of ['townGold', 'townMats', 'lootMats']) {
          if (before[k] === afterForge[k]) fail.push(`forge left ${k} stale ("${before[k]}")`);
        }
      }

      return { fail };
    });

    for (const f of res.fail) failures.push(f);
    if (pageErrors.length) failures.push(`uncaught page errors:\n  - ${pageErrors.join('\n  - ')}`);
  } catch (e) {
    failures.push(`navigation/boot failed: ${String(e)}`);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\nTOWN-WALLET SMOKE FAILED:');
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log('town-wallet: PASS — gold + material readouts refresh on every transaction');
}

main().catch((e) => { console.error('town-wallet: unexpected error', e); process.exit(1); });
