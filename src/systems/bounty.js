// Pure bounty-contract math: live progress toward a contract's goal, whether it
// is complete, and a one-shot "just completed" edge detector.
//
// Progress is derived from the hero's running totals, which are passed in as a
// plain snapshot (never read from globals) so this stays deterministic and unit-
// testable. The legacy shell builds the snapshot from `player` and injects it.
//
// A `totals` snapshot looks like:
//   { kills, maxFloor, clearedFloors, bossKills, eliteKills, goldEarned }
// and a `bounty` is { kind, need, snap, … } where `snap` is the counter value
// captured when the contract was accepted, so progress is the delta earned since.

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

// How much Core (the scarce mid-tier crafting material) a contract pays out.
// Every bounty rewards Core so the board is a reliable route to it. The amount
// starts at a baseline of 2 and scales up with dungeon depth, so deeper contracts
// pay more; a per-contract `mult` (its relative effort) scales it further. Pure
// and deterministic — the legacy shell passes the hero's depth and each offer's
// weight. Never drops below the baseline, and rounds to a whole material count.
export const BOUNTY_CORE_BASE = 2;        // shallow-floor payout for a light contract
export const BOUNTY_CORE_PER_DEPTH = 0.15; // extra Core per floor of depth
export function bountyCoreReward(depth, mult = 1) {
  const d = Math.max(1, depth || 1);
  const scaled = (BOUNTY_CORE_BASE + (d - 1) * BOUNTY_CORE_PER_DEPTH) * mult;
  return Math.max(BOUNTY_CORE_BASE, Math.round(scaled));
}
