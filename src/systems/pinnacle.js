// ── THE PANTHEON OF THE DEEP · SUMMON / LOOT / GATING MATH ───────────────────
// Pure functions over the authored roster in src/data/pinnacle.js. This module
// answers the four questions the shell asks around a Pantheon fight:
//   • can I afford to forge this god's Effigy, and what does it cost?  (summon)
//   • what can this god drop, and did this kill drop one?              (loot)
//   • has this kill's dry-streak earned a guaranteed Mythic?           (pity)
//   • is this Uber unlocked yet?                                       (gating)
//
// Every function is pure: state / numbers in, numbers / booleans out — no DOM, no
// fetch, no localStorage, no Math.random, no Date.now. The per-kill drop roll takes
// an injected `rng` (() => number in [0,1)), so a seeded stream reproduces the
// outcome (leaderboard-auditable, unit-testable). Per-boss bad-luck protection is
// NOT reimplemented here — it delegates to the shared collection-targeting module
// (src/systems/collectionTargeting.js) with a per-boss tuning object, so the
// Pantheon, the Mirrorforge and the Dread Covenants all share one pity curve.
//
// The legacy shell owns the live wallet, the per-hero clear ledger and the per-boss
// pity counters (all persisted); it calls these to decide costs, resolve a kill and
// show/hide the Uber summon. This module never touches that state directly.
import { PANTHEON } from '../data/pinnacle.js';
import { isPityGuaranteed, nextPity } from './collectionTargeting.js';

// ── Roster lookups ────────────────────────────────────────────────────────────

// The god with this stable id, or null. `data` defaults to the live roster but is
// injectable so tests can drive a bespoke, minimal Pantheon.
export function bossById(id, data = PANTHEON) {
  if (!id || !Array.isArray(data)) return null;
  for (const b of data) if (b && b.id === id) return b;
  return null;
}

// Every BASE-tier god (the six always-summonable capstones). Ubers are surfaced
// separately once their gate opens (see uberUnlocked).
export function baseBosses(data = PANTHEON) {
  if (!Array.isArray(data)) return [];
  return data.filter((b) => b && b.tier === 'base');
}

// The Uber variant that ascends from a given Base id, or null (a Base with no Uber,
// or an unknown id, yields null). Lets the shell show a "⇧ Uber available" affordance
// on the Base's summon card once the gate opens.
export function uberFor(baseId, data = PANTHEON) {
  if (!baseId || !Array.isArray(data)) return null;
  for (const b of data) if (b && b.tier === 'uber' && b.uberOf === baseId) return b;
  return null;
}

// ── Summoning ──────────────────────────────────────────────────────────────────

// The Effigy recipe for a god — its `summon` block ({ shards:{type,count}, gold,
// chaos? }). Returns null for an unknown id so the caller can guard. Pure passthrough
// (the recipe is authored data), exposed so the shell never reaches into the def.
export function summonCost(bossId, data = PANTHEON) {
  const b = bossById(bossId, data);
  return b && b.summon ? b.summon : null;
}

// Whether a wallet can afford a summon recipe. `wallet` is the hero's live purse:
//   { gold, scrap, glimmer, core, chaos, shards: { <shardType>: count, … } }
// A recipe demands gold, an optional chaos cost, and a count of ONE shard type.
// Every field is treated defensively: a missing wallet, missing shard bag, or
// garbage (NaN / negative / non-number) reads as zero owned, so a corrupt save can
// never report "affordable" by accident. Returns a plain boolean.
export function canSummon(recipe, wallet) {
  if (!recipe || typeof recipe !== 'object') return false;
  const w = (wallet && typeof wallet === 'object') ? wallet : {};
  const owned = (v) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0);
  const need = (v) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0);

  // Gold.
  if (owned(w.gold) < need(recipe.gold)) return false;
  // Chaos (optional — a recipe without a chaos cost never blocks on it).
  if (need(recipe.chaos) > 0 && owned(w.chaos) < need(recipe.chaos)) return false;
  // Shards — one named currency, looked up in the wallet's shard bag.
  const sh = recipe.shards;
  if (sh && sh.type && need(sh.count) > 0) {
    const bag = (w.shards && typeof w.shards === 'object') ? w.shards : {};
    if (owned(bag[sh.type]) < need(sh.count)) return false;
  }
  return true;
}

// ── Loot ────────────────────────────────────────────────────────────────────────

// The exclusive Mythic pool a god can drop, plus its pity threshold — the preview
// the shell shows on the summon card and in the codex. Missing / malformed loot
// yields an empty pool with an unreachable threshold so nothing crashes and no
// phantom guarantee fires.
export function previewLootPool(bossId, data = PANTHEON) {
  const b = bossById(bossId, data);
  const loot = b && b.loot;
  return {
    pool: Array.isArray(loot && loot.pool) ? loot.pool.slice() : [],
    pityThreshold: Math.max(1, Math.floor((loot && loot.pityThreshold) || 1)),
  };
}

// Resolve ONE Pantheon kill's Mythic drop. Model:
//   • Bad-luck protection: once the per-boss pity counter has reached the boss's
//     pityThreshold, the drop is GUARANTEED (delegated to the shared module's
//     isPityGuaranteed with a per-boss T = { guaranteeAt: boss.loot.pityThreshold }).
//   • Otherwise it's a straight roll against boss.loot.dropChance on the injected rng.
//   • If the kill drops, a second rng draw picks WHICH Mythic from `pool` (uniform).
// Returns { itemId, guaranteed }: itemId is the chosen Mythic id, or null on a dry
// kill; guaranteed flags whether pity (not luck) forced the drop — for the "pity!"
// UI and to keep the pity advance honest. Deterministic under a seeded rng.
//
// `pool` is passed explicitly (the caller may pre-filter to still-missing Mythics
// for a completionist bias); `pity` is the boss's live counter; `boss` supplies the
// threshold + dropChance. All inputs are guarded against garbage.
export function rollPinnacleDrop(pool, pity, rng, boss) {
  const list = Array.isArray(pool) ? pool.filter((x) => x != null) : [];
  const threshold = Math.max(1, Math.floor((boss && boss.loot && boss.loot.pityThreshold) || 1));
  const dropChance = clamp01((boss && boss.loot && boss.loot.dropChance));
  const draw = (typeof rng === 'function') ? rng : () => 0;

  const guaranteed = isPityGuaranteed(pity, { guaranteeAt: threshold });
  // A dry pool can't hand out an item even under a guarantee — report no drop.
  if (!list.length) return { itemId: null, guaranteed: false };

  const dropped = guaranteed || (draw() < dropChance);
  if (!dropped) return { itemId: null, guaranteed: false };

  // Pick the specific Mythic uniformly from the pool.
  const idx = Math.min(list.length - 1, Math.max(0, Math.floor(draw() * list.length)));
  return { itemId: list[idx], guaranteed };
}

// Advance a boss's pity counter after a kill resolves. `gotDrop` (did this kill hand
// out a Mythic) resets it to 0; a dry kill ticks it up by one — bounded by the shared
// module's nextPity, using this boss's own guarantee threshold. Clamps garbage to a
// clean non-negative integer, so a corrupt save self-heals.
export function nextBossPity(pity, gotDrop, boss) {
  const threshold = Math.max(1, Math.floor((boss && boss.loot && boss.loot.pityThreshold) || 1));
  return nextPity(pity, gotDrop, { guaranteeAt: threshold, perRunPity: 1 });
}

// The one-time reward for a god's FIRST clear (gold / bonus shards / chaos). Returns
// a normalized object with safe zero defaults so the shell can always destructure it,
// even for a def that authored no bonus.
export function firstClearReward(boss) {
  const fc = (boss && boss.firstClearBonus && typeof boss.firstClearBonus === 'object')
    ? boss.firstClearBonus : {};
  return {
    gold: num(fc.gold),
    chaos: num(fc.chaos),
    shards: (fc.shards && fc.shards.type)
      ? { type: fc.shards.type, count: Math.max(0, Math.floor(num(fc.shards.count))) }
      : null,
    bossPoints: num(boss && boss.bossPointPayout),
  };
}

// ── Uber gating ──────────────────────────────────────────────────────────────────

// Whether an Uber god is unlocked and summonable. An Uber gates on TWO conditions:
//   1. its Base form has been cleared at least once (`baseCleared`, a bool the shell
//      derives from the hero's clear ledger), AND
//   2. the hero has reached the Uber's `uberMinEndlessDepth` in Endless (`endlessDepth`).
// A non-Uber def is always "unlocked" (the concept doesn't apply) — returns true so
// the shell can gate uniformly. Garbage depth reads as 0 (locked, never unlocked by
// a NaN). Pure boolean.
export function uberUnlocked(bossDef, baseCleared, endlessDepth) {
  if (!bossDef || typeof bossDef !== 'object') return false;
  if (bossDef.tier !== 'uber') return true;             // only Ubers gate
  if (!baseCleared) return false;                       // must beat the Base first
  const need = Math.max(0, Math.floor(num(bossDef.uberMinEndlessDepth)));
  const depth = Math.max(0, Math.floor(num(endlessDepth)));
  return depth >= need;
}

// ── tiny local guards (kept private; no data/util dependency needed) ─────────────
function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
function clamp01(v) {
  const n = num(v);
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
