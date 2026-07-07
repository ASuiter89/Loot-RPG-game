// Boss-point currency accounting — a pure count over the first-clear ledger, with no
// globals/RNG/DOM/clock. Boss points are EARNED by first-clearing boss floors (one
// per distinct floor, tracked in the bossFirstKills ledger) and SPENT on the
// Ascendant Weave (see systems/ascendantWeave.js). The count is DERIVED from the
// ledger — never a stored counter — so it can't drift from the floors actually
// cleared.

// Boss points EARNED = the number of distinct boss floors first-cleared. The ledger
// is keyed by floor, so farming a cleared floor never adds one; a missing / garbage
// ledger ⇒ 0.
export function pointsEarned(bossFirstKills) {
  if (!bossFirstKills || typeof bossFirstKills !== 'object') return 0;
  return Object.keys(bossFirstKills).length;
}
