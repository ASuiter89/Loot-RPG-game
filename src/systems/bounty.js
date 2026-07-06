// Pure bounty-contract math: live progress toward a contract's goal, whether it
// is complete, and a one-shot "just completed" edge detector, plus the payout math
// for each reward type a contract can hand out.
//
// Progress is derived from the hero's running totals, which are passed in as a
// plain snapshot (never read from globals) so this stays deterministic and unit-
// testable. The legacy shell builds the snapshot from `player` and injects it.
//
// A `totals` snapshot looks like:
//   { kills, maxFloor, clearedFloors, bossKills, eliteKills, goldEarned }
// and a `bounty` is { kind, need, snap, … } where `snap` is the counter value
// captured when the contract was accepted, so progress is the delta earned since.
import { BOUNTY_MAT_TUNING, BOUNTY_XP_BASE, BOUNTY_XP_PER_DEPTH } from '../data/bountyRewards.js';

// Live progress toward the contract's goal. A 'delve' contract tracks the
// absolute depth reached (snap is unused); every other kind measures the gain
// since accept.
export function bountyProgress(bounty, totals) {
  if (!bounty) return 0;
  const t = totals || {};
  const snap = bounty.snap || 0;
  switch (bounty.kind) {
    case 'slay':  return Math.max(0, (t.kills || 0) - snap);
    case 'delve': return Math.max(0, t.maxFloor || 1);
    case 'clear': return Math.max(0, (t.clearedFloors || 0) - snap);
    case 'boss':  return Math.max(0, (t.bossKills || 0) - snap);
    case 'elite': return Math.max(0, (t.eliteKills || 0) - snap);
    case 'gold':  return Math.max(0, (t.goldEarned || 0) - snap);
    default:      return 0;
  }
}

// A contract is done once live progress reaches (or passes) its goal.
export function bountyDone(bounty, totals) {
  return !!bounty && bountyProgress(bounty, totals) >= bounty.need;
}

// One-shot edge detector: returns true exactly the first time a contract's live
// progress reaches its goal, flipping the bounty's `doneNotified` latch so the
// "bounty complete" cue fires once — not on every kill afterwards. Re-arms if
// progress ever falls back below the goal (e.g. a counter reset), so a genuine
// re-completion cues again.
export function bountyNewlyComplete(bounty, totals) {
  if (!bounty) return false;
  if (bountyDone(bounty, totals)) {
    if (bounty.doneNotified) return false;
    bounty.doneNotified = true;
    return true;
  }
  if (bounty.doneNotified) bounty.doneNotified = false;
  return false;
}

// How much of a crafting material a contract pays out. A bounty can reward any of
// the four mats (scrap/glimmer/core/chaos), not just Core; the amount starts at
// that material's baseline (scarcer material → smaller count) and scales up with
// dungeon depth, so deeper contracts pay more, with a per-contract `mult` (relative
// effort) scaling it further. Pure and deterministic — the legacy shell passes the
// hero's depth and each offer's weight. Never drops below the material's baseline,
// and rounds to a whole material count. An unknown key falls back to Core's tuning.
export function bountyMaterialReward(matKey, depth, mult = 1) {
  const tune = BOUNTY_MAT_TUNING[matKey] || BOUNTY_MAT_TUNING.core;
  const d = Math.max(1, depth || 1);
  const scaled = (tune.base + (d - 1) * tune.perDepth) * mult;
  return Math.max(tune.base, Math.round(scaled));
}
// Core's tuning, re-exported so older callers/tests keep their names. Core is still
// the reference material; bountyCoreReward is a thin alias over the general fn.
export const BOUNTY_CORE_BASE = BOUNTY_MAT_TUNING.core.base;
export const BOUNTY_CORE_PER_DEPTH = BOUNTY_MAT_TUNING.core.perDepth;
export function bountyCoreReward(depth, mult = 1) {
  return bountyMaterialReward('core', depth, mult);
}

// XP lump a contract can pay: a depth-scaled baseline times the contract's weight.
// Same shape as the material payout — floors at the baseline, whole number out.
export function bountyXpReward(depth, mult = 1) {
  const d = Math.max(1, depth || 1);
  const scaled = (BOUNTY_XP_BASE + (d - 1) * BOUNTY_XP_PER_DEPTH) * mult;
  return Math.max(BOUNTY_XP_BASE, Math.round(scaled));
}
