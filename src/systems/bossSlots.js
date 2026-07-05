// Boss-point gear-slot math — pure functions over plain state. Numbers/objects in,
// numbers/objects out; no globals, no RNG, no DOM, no clock. The legacy adapter
// (src/legacy/game.js) owns the live player state and the loadout aggregation; this
// module only turns a slot's level into a stat multiplier and does the point
// accounting (earned vs spent, per set) so both stay unit-testable.
//
// Model: boss points EARNED = the number of distinct boss floors first-cleared.
// Each gear SET spends from that pool INDEPENDENTLY (spending in Set 1 never
// depletes Set 2), so both loadouts can be fully invested. A slot at level N scales
// everything the gear worn there contributes by ×(1 + perLevel·N), linear/uncapped.
import { BOSS_SLOTS } from '../data/bossSlots.js';

// The stat multiplier a gear slot at `level` applies to everything the gear worn
// there contributes: linear and uncapped, ×(1 + perLevel·level). A missing / zero /
// negative level ⇒ 1 (no-op), so an un-invested slot changes nothing.
export function slotMultiplier(level, T = BOSS_SLOTS) {
  const n = Math.max(0, Math.floor(level || 0));
  return 1 + T.perLevel * n;
}

// Boss points EARNED = the number of distinct boss floors first-cleared. The ledger
// is keyed by floor (see bossFirstKills), so farming a cleared floor never adds one.
export function pointsEarned(bossFirstKills) {
  if (!bossFirstKills || typeof bossFirstKills !== 'object') return 0;
  return Object.keys(bossFirstKills).length;
}

// Points SPENT in one gear set = the sum of its slot levels.
export function pointsSpent(setLevels) {
  if (!setLevels || typeof setLevels !== 'object') return 0;
  let n = 0;
  for (const k in setLevels) {
    const v = setLevels[k];
    if (typeof v === 'number' && v > 0) n += Math.floor(v);
  }
  return n;
}

// Points still AVAILABLE to a set = earned − spent-in-that-set. Each set draws the
// full earned pool independently, so spending in one never depletes the other.
export function pointsAvailable(bossFirstKills, setLevels) {
  return Math.max(0, pointsEarned(bossFirstKills) - pointsSpent(setLevels));
}

// Total levels invested across BOTH sets — drives the respec price.
export function totalLevelsInvested(slotLevels) {
  if (!Array.isArray(slotLevels)) return 0;
  return slotLevels.reduce((n, s) => n + pointsSpent(s), 0);
}

// Gold to reset every slot level (both sets) back to unspent. Steep by design.
export function respecCost(slotLevels, T = BOSS_SLOTS) {
  return T.respecBase + T.respecPerLevel * totalLevelsInvested(slotLevels);
}

// Normalize a loaded slot-levels blob to exactly [{…slotKeys}, {…slotKeys}] with
// non-negative integer levels and no unknown keys. Missing / garbage ⇒ two empty
// sets, so old saves (no slotLevels) and corrupt data both load cleanly.
export function sanitizeSlotLevels(raw, slotKeys) {
  const keys = Array.isArray(slotKeys) ? slotKeys : [];
  const cleanSet = (s) => {
    const out = {};
    for (const k of keys) {
      const v = s && s[k];
      out[k] = (typeof v === 'number' && v > 0) ? Math.floor(v) : 0;
    }
    return out;
  };
  const arr = Array.isArray(raw) ? raw : [];
  return [cleanSet(arr[0]), cleanSet(arr[1])];
}
