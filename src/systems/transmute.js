// Transmuter logic — the "cast N pieces into the crucible, draw out one of the
// next rarity up" recipe. Kept out of the render/DOM/state layers so the recipe
// (what's eligible, how many a fuse takes, what it costs, exactly which bag pieces
// it consumes) is unit-testable: callers pass in the bag array, the rarity ladder
// and the depth; nothing here reads game state, the DOM or RNG.
import { TRANSMUTE_COUNTS } from '../data/transmuteRecipe.js';

// How many pieces of `tier` one fuse consumes (and therefore requires). Data-
// driven and escalating up the ladder; a tier with no recipe entry (the top
// rarity) returns 0 and can't be fused.
export function fuseCount(tier) { return TRANSMUTE_COUNTS[tier] || 0; }

// A bag piece can go in the crucible only if it's real gear (has an equip slot),
// is unlocked (locked keepers are shielded), and is the rarity being fused. This
// is the single source of truth for "fusable" — both grouping and resolving use it.
export function isFusable(it, tier) {
  return !!(it && it.slot && !it.locked && it.tier === tier);
}

// Depth- and rarity-scaled gold cost to fuse pieces into one of `nextTier`.
// `tierOrder` is the rarity ladder (junk → … → unique) so rarer results cost more.
export function transmuteCost(nextTier, maxFloor, tierOrder) {
  return Math.round((40 + (maxFloor || 1) * 8) * (1 + tierOrder.indexOf(nextTier) * 0.4));
}

// Group the bag's fusable pieces by rarity → { tier: [bagIndex, …] }. A tier only
// appears if it has ≥1 fusable piece; callers gate the actual fuse on having at
// least fuseCount(tier).
export function fusableByTier(inventory) {
  const byTier = {};
  for (let i = 0; i < inventory.length; i++) {
    const it = inventory[i];
    if (it && it.slot && !it.locked) (byTier[it.tier] = byTier[it.tier] || []).push(i);
  }
  return byTier;
}

// Decide which bag indices a fuse consumes.
//   • ids given  → the player's explicit pick (from the town UI): it must be
//     exactly fuseCount(tier) distinct, still-fusable pieces of `tier`.
//   • ids empty  → fall back to auto-picking the fuseCount(tier) lowest-value
//     fusable pieces of `tier`, so window.transmute(tier) / AI play still work
//     without a UI selection.
// Returns { ok, indices, reason }: `indices` are the bag positions to splice
// (caller removes highest-first); `reason` explains a failure ('selection' — the
// pick wasn't a clean set, 'notEnough' — fewer fusable pieces than the recipe
// needs, or the tier can't be fused at all).
export function resolveTransmute(inventory, tier, ids) {
  const need = fuseCount(tier);
  if (!need) return { ok: false, indices: [], reason: 'notEnough' };
  if (Array.isArray(ids) && ids.length) {
    const seen = new Set();
    const indices = [];
    for (const id of ids) {
      const i = inventory.findIndex(it => it && it.id == id);
      if (i < 0 || seen.has(i) || !isFusable(inventory[i], tier)) continue;
      seen.add(i);
      indices.push(i);
    }
    if (indices.length !== need) return { ok: false, indices: [], reason: 'selection' };
    return { ok: true, indices };
  }
  const pool = [];
  for (let i = 0; i < inventory.length; i++) if (isFusable(inventory[i], tier)) pool.push(i);
  if (pool.length < need) return { ok: false, indices: [], reason: 'notEnough' };
  pool.sort((a, b) => (inventory[a].value || 0) - (inventory[b].value || 0));
  return { ok: true, indices: pool.slice(0, need) };
}
