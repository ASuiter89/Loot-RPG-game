// Behavioural test — the legendary/unique loot BANNER must fire for every gear
// type AND from every source that grants a top-tier piece, not just kills/chests.
// It ALSO guards the first-of-rarity MILESTONE: the first green/blue/purple a hero
// picks up earns that same banner once, then reverts to a quiet chime.
//
// This guards the fix for "toasts only show for daggers": the banner (#loot-banner)
// keys purely on rarity, and the surprise-reward sources (gambler jackpot, bounty
// & escort payoff, transmuter fuse) now route their legendary/unique results
// through lootReveal() the same way an organic drop does.
//
// Runs the REAL built game in Chromium (like smoke.mjs) and drives the actual
// exported functions. Deterministic: it forces top-tier results by pinning
// Math.random only around each call (affix rolls are bounded loops, so a constant
// RNG can't hang), and reads the banner straight off the DOM.
//
// Usage: node test/smoke/reward-banner.mjs [path-to-html]   (default: ./index.html)

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
  console.error(`reward-banner: target not found: ${target}`);
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

    // Everything runs in ONE synchronous evaluate so no banner timer (2.4s) ever
    // fires mid-run: within a single evaluate the event loop never yields, so the
    // reveal queue is pumped by hand instead of waited on.
    const out = await page.evaluate(() => {
      const el = () => document.getElementById('loot-banner');
      const titleEl = () => document.getElementById('loot-banner-title');
      const kickerEl = () => document.getElementById('loot-banner-kicker');

      // Show `fn()`'s enqueued banner synchronously and read it. Resets the DOM,
      // runs fn (which calls lootReveal -> showLootBanner), then — because a prior
      // case left the queue "showing" — pumps playNextLootBanner once to surface it.
      function drive(fn) {
        el().classList.remove('show');
        titleEl().textContent = '__none__';
        kickerEl().textContent = '__none__';
        let threw = null;
        try { fn(); } catch (e) { threw = String(e); }
        if (!el().classList.contains('show')) window.playNextLootBanner();
        return { show: el().classList.contains('show'), title: titleEl().textContent, kicker: kickerEl().textContent, threw };
      }

      const res = { slots: [], gating: [], predicate: {}, sources: {} };

      const SLOTS = ['weapon','chest','head','hands','legs','ring','amulet','offhand'];
      // 1) lootReveal banners a legendary AND a unique of every slot (no gear gating).
      for (const slot of SLOTS) {
        for (const tier of ['legendary','unique']) {
          const item = window.generateItem(1, 12, tier, slot);
          const r = drive(() => window.lootReveal(item));
          res.slots.push({ slot, tier, name: item.name, ok: r.show && r.title === item.name, ...r });
        }
      }

      // 2) First-of-rarity MILESTONE gating. The FIRST green/blue/purple pickup pops
      // the same banner as a legendary (a one-time celebration as a new colour enters
      // the bag); a SECOND of that colour does NOT; normal/junk are the baseline and
      // never milestone. Reset the ledger so this section starts fresh regardless of
      // what the slot-reveals above left behind.
      window.player.rarityFirsts = {};
      for (const tier of ['uncommon','rare','epic']) {
        const item1 = window.generateItem(1, 12, tier, 'chest');
        const first = drive(() => window.lootReveal(item1));
        const item2 = window.generateItem(1, 12, tier, 'chest');
        const second = drive(() => window.lootReveal(item2));
        res.gating.push({ tier, firstBannered: first.show, firstTitle: first.title, name: item1.name, secondBannered: second.show });
      }
      // The baseline tiers every hero starts swimming in never earn a milestone.
      for (const tier of ['normal','junk']) {
        window.player.rarityFirsts = {};
        const item = window.generateItem(1, 12, tier, 'chest');
        const r = drive(() => window.lootReveal(item));
        res.gating.push({ tier, baseline: true, firstBannered: r.show });
      }

      // 3) isTopTierItem predicate truth table.
      res.predicate = {
        legendary: window.isTopTierItem(window.generateItem(1, 5, 'legendary', 'ring')),
        unique:    window.isTopTierItem(window.generateItem(1, 5, 'unique', 'ring')),
        epic:      window.isTopTierItem(window.generateItem(1, 5, 'epic', 'ring')),
        rareItem:  window.isTopTierItem(window.generateItem(1, 5, 'rare', 'ring')),
        nullItem:  window.isTopTierItem(null),
      };

      // 4) Reward SOURCES that used to skip the banner now fire it for a top-tier.
      const realRandom = Math.random;

      // Gambler: pin RNG high so weighted(GAMBLE_TIER_WEIGHTS) lands on the last key
      // ('unique'); gambleSlot defaults to null (blind pull).
      window.player.gold = 1e9;
      res.sources.gambler = drive(() => {
        Math.random = () => 0.9999;
        try { window.gambleRoll(); } finally { Math.random = realRandom; }
      });

      // Bounty: a trivially-complete slay contract; RNG=0 makes rollTier() return
      // the first check ('unique'). rollTier now gates colour behind the early
      // bosses (systems/rarityGate.js), so mark the first two guardians beaten
      // (floors 5 & 10) — otherwise every coloured tier is locked and RNG=0 would
      // fall through to a plain normal.
      window.player.gold = 1e9;
      window.player.bossFirstKills = Object.assign({}, window.player.bossFirstKills, { '5': 1, '10': 1 });
      window.player.bounty = { kind: 'slay', need: 0, snap: 0, gold: 5, mat: null, ilvl: 6, desc: 'test' };
      res.sources.bounty = drive(() => {
        Math.random = () => 0;
        try { window.claimBounty(); } finally { Math.random = realRandom; }
      });

      // Transmuter: fuse five legendary pieces -> one unique (forced tier, no RNG).
      // A legendary fuse takes 5 (the recipe count climbs with rarity).
      window.player.gold = 1e9;
      for (let i = 0; i < 5; i++) window.inventory.push(window.generateItem(1, 10, 'legendary', 'chest'));
      res.sources.transmuter = drive(() => window.transmute('legendary'));

      return res;
    });

    // ---- assertions ----
    for (const s of out.slots) {
      if (!s.ok) failures.push(`banner did NOT fire for ${s.tier} ${s.slot} (show=${s.show}, title="${s.title}", expected "${s.name}"${s.threw ? ', threw: ' + s.threw : ''})`);
    }
    for (const g of out.gating) {
      if (g.baseline) {
        if (g.firstBannered) failures.push(`banner fired for a ${g.tier} item — baseline tiers must never milestone`);
        continue;
      }
      if (!g.firstBannered || g.firstTitle !== g.name) failures.push(`first ${g.tier} did NOT pop the milestone banner (show=${g.firstBannered}, title="${g.firstTitle}", expected "${g.name}")`);
      if (g.secondBannered) failures.push(`second ${g.tier} popped a banner — the milestone must fire only once per colour`);
    }
    const p = out.predicate;
    if (!(p.legendary && p.unique && !p.epic && !p.rareItem && !p.nullItem)) {
      failures.push(`isTopTierItem truth table wrong: ${JSON.stringify(p)}`);
    }
    for (const [name, r] of Object.entries(out.sources)) {
      const looksTop = /UNIQUE DROP|LEGENDARY DROP|SET PIECE/.test(r.kicker || '');
      if (!(r.show && r.title && r.title !== '__none__' && looksTop)) {
        failures.push(`${name} reward did NOT fire the loot banner for a top-tier result (show=${r.show}, kicker="${r.kicker}", title="${r.title}"${r.threw ? ', threw: ' + r.threw : ''})`);
      }
    }
    if (pageErrors.length) failures.push(`uncaught page errors:\n  - ${pageErrors.join('\n  - ')}`);

    console.log(`reward-banner: ${out.slots.length} slot×tier reveals, ${out.gating.length} gate checks, ${Object.keys(out.sources).length} reward sources`);
    console.log('reward-banner: sources ->', Object.entries(out.sources).map(([k, v]) => `${k}:${v.kicker}`).join(', '));
  } catch (e) {
    failures.push(`boot/run failed: ${String(e)}`);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\nREWARD-BANNER FAILED:');
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log('\nreward-banner: PASS —', target);
}

main().catch((e) => { console.error('reward-banner: unexpected error', e); process.exit(1); });
