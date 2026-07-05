// Dungeon-Gate WARP checkpoints — which floors "Warp to Dungeon" lets you drop onto.
//
// Warping in is gated to every WARP_STEP-th floor starting at 1 (1, 6, 11, 16,
// 21, …). "Return to Last Floor" is the exact-floor path (restores the held
// stage); Warp only ever lands you on a checkpoint. A death never holds a floor,
// so getting back means warping to the checkpoint at or below your deepest and
// walking the last few floors down naturally — that natural setback replaces the
// old "deeper floors re-lock on death" restriction.
//
// These are pure helpers over plain floor numbers. Because WARP_STEP (5) divides
// both a tier's length (25) and the finite-depth boundary (75), checkpoints line
// up on tier floor 1 everywhere — so the same math is valid whether you pass a
// per-tier DISPLAY floor (1-based within a tier) or a CONTINUOUS depth, and a
// snapped floor can never cross down into an easier tier.

export const WARP_STEP = 5;

// True when `floor` is a warp checkpoint (1, 6, 11, 16, 21, …).
export function isWarpCheckpoint(floor) {
  const f = Math.floor(floor);
  return f >= 1 && (f - 1) % WARP_STEP === 0;
}

// Snap a floor DOWN to the checkpoint you'd actually warp onto: floor 24 → 21,
// floor 21 → 21, anything below 1 → 1. Valid on display or continuous floors.
export function warpFloorFor(floor) {
  const f = Math.max(1, Math.floor(floor) || 1);
  return f - ((f - 1) % WARP_STEP);
}

// Every warp checkpoint in [from, deepest], ascending — the tiles the Gate shows
// for a tier. `deepest` and `from` are per-tier display floors (1-based); `from`
// lets a deep Endless tier list only its most recent window instead of thousands.
export function warpCheckpoints(deepest, from = 1) {
  const cap = Math.max(1, Math.floor(deepest) || 1);
  const lo = Math.max(1, Math.floor(from) || 1);
  const out = [];
  for (let f = 1; f <= cap; f += WARP_STEP) if (f >= lo) out.push(f);
  return out;
}
