// ── CURSED-ITEM ROLL MATH ──
// A cursed drop pairs a big BOOST on one property with an equally big DRAWBACK on
// another. The size of each swing is computed here — kept pure so it can be
// unit-tested and, crucially, so the boost and the penalty use the SAME sizing (an
// equally strong upside and downside).
//
// A swing is sized RELATIVE TO THE STAT it lands on: a curse moves a stat by a
// MULTIPLE of that stat's own normal top-end roll, so it's strong for whatever it
// hits — a big Attack Speed %, a big HP pool — and never out of proportion to the
// stat. The multiple GRADUATES WITH RARITY (see CURSE_TIER_MULT): a curse on a
// legendary is far stronger than on an uncommon.

// How many times a stat's normal ceiling a cursed swing is worth, by rarity tier.
// Ramps 2.2× (uncommon) → 5× (legendary), so rarer cursed gear swings harder in
// both directions. Uniques are fixed artifacts and never cursed, so they're absent.
export const CURSE_TIER_MULT = { uncommon: 2.2, rare: 2.9, epic: 3.8, legendary: 5.0 };

// The curse multiplier for a tier (falls back to the gentlest tier for anything not
// listed — only uncommon..legendary can ever be cursed).
export function curseTierMult(tier) {
  return CURSE_TIER_MULT[tier] || CURSE_TIER_MULT.uncommon;
}

// The swing for one stat: its rarity multiplier × that stat's own normal maximum roll
// (pass `affixStatRange(stat, lvl, mult).max` in). Used for BOTH the boost and the
// penalty, so a curse's drawback is always as strong as its gift. No caps: the value
// is whatever the stat's own (uncapped) ceiling × the rarity multiple works out to.
export function statCurseSwing(normalMax, curseMult) {
  return Math.max(1, Math.round(Math.max(0, normalMax) * curseMult));
}

// The most a cursed value of a stat can reach: a full normal roll PLUS a curse swing
// on top. The save-repair pass clamps any legacy out-of-band value to this, so an
// item from the old uncapped-curse bug is pulled back in-band the next time it loads.
export function cursedStatCeiling(normalMax, curseMult) {
  const nm = Math.max(0, normalMax);
  return Math.round(nm) + statCurseSwing(nm, curseMult);
}
