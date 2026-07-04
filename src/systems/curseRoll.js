// ── CURSED-ITEM ROLL MATH ──
// A cursed drop pairs a big BOOST on one property with a big DRAWBACK on another.
// The size of each swing is computed here — kept pure so it can be unit-tested and,
// crucially, so the boost and the penalty use the SAME sizing (an equally strong
// upside and downside).
//
// A swing is sized RELATIVE TO THE STAT it lands on: a curse moves a stat by a fixed
// MULTIPLE of that stat's own normal top-end roll. That keeps a curse strong for
// whatever it hits — a big Attack Speed %, a big HP pool — instead of one flat number
// that leaves a low-cap percent stat untouched but blows another out to hundreds of
// percent (the old bug: a flat swing added to Attack Speed, cap 15%, produced ~300%).

// How many times a stat's normal ceiling a cursed swing is worth. Tuned so a curse is
// clearly the strongest single source of a stat — well past what the Enchanter can
// roll — while staying bounded and readable.
export const CURSE_STAT_MULT = 2.5;

// Crit chance and Luck are 0–100% chances in play, so a big swing would break them —
// they keep a tiny fixed clamp instead of the stat-relative swing.
export function isTinyCurseStat(stat) { return stat === 'CRIT' || stat === 'LCK'; }

// The clamped swing for crit chance / Luck (unchanged from the original tuning).
export function tinyCurseSwing(lvl, mult) {
  return Math.max(1, Math.min(5, Math.round((1 + lvl * 0.1) * mult)));
}

// The swing for every other stat: a multiple of that stat's own normal maximum roll
// (pass `affixStatRange(stat, lvl, mult).max` in). Used for BOTH the boost and the
// penalty, so a curse's drawback is always as strong as its gift.
export function statCurseSwing(normalMax, curseMult = CURSE_STAT_MULT) {
  return Math.max(1, Math.round(Math.max(0, normalMax) * curseMult));
}

// The most a cursed value of a stat can now reach: a full normal roll PLUS a curse
// swing on top. The save-repair pass clamps any legacy out-of-band value to this, so
// a pre-fix ~300% Attack Speed item is pulled back in-band the next time it loads.
export function cursedStatCeiling(normalMax, curseMult = CURSE_STAT_MULT) {
  const nm = Math.max(0, normalMax);
  return Math.round(nm) + statCurseSwing(nm, curseMult);
}
