// Pure rating→chance math — the core of the "rating vs. opposition" combat
// probability system. Deterministic: numbers in, numbers out, no globals.
// Extracted verbatim from the monolith (see docs/CHANGELOG.md).
//
// A chance is rating / (rating + opposition): more rating raises the chance
// asymptotically toward (but never reaching) 1, and because opposition grows with
// depth, a fixed rating buys LESS chance the deeper you go — you must keep
// investing to stay sharp. Runaway numbers are mechanically unreachable rather
// than clamped.

/**
 * Contest a rating against an opposition value.
 * @returns {number} chance in [0, 1). 0 when rating ≤ 0; 1 when opposition ≤ 0.
 */
export function rated(rating, opposition) {
  if (rating <= 0) return 0;
  if (opposition <= 0) return 1; // no opposition → certain (shouldn't happen in play)
  return rating / (rating + opposition);
}

// skillBonus/buffMag/foodFx are still authored as old-style fractions (0.01 = "1%"),
// so convert them into rating points with one constant until the skill overhaul
// re-authors them directly in rating units.
export const SKILL_RATING = 120;

/** Convert an old-style fraction (0.01 = "1%") into rating points. */
export function ratePct(v) {
  return (v || 0) * SKILL_RATING;
}
