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

// ── WHERE A CURSE PENALTY IS ALLOWED TO LAND ──
// A curse's drawback is only a REAL drawback if a NEGATIVE value on the stat actually
// subtracts in combat. Most gear stats are benefit-only RATINGS — crit, dodge, block,
// pen, leech, attack/cast speed, double-strike, cooldown/mana reduction, area, bleed,
// tenacity — whose combat layer floors them at 0 (rated() returns 0 for rating ≤ 0,
// penFraction() clamps, Math.max(0,…) guards). Push a penalty onto one of those while
// the hero has none from elsewhere and the negative simply vanishes: "cursed" gear
// with no felt downside (the bug this list fixes).
//
// These are the stats whose negative value genuinely BITES: flat pools that combine
// with a hero base so a negative directly lowers a real total (Attack, Defense, Max
// HP/MP, Speed) and the multiplicative damage amps (Increased Damage, Boss Damage,
// Spell/Skill Power) where a negative scales every hit DOWN. A curse penalty must come
// from here so the price is always paid.
export const FELT_CURSE_PENALTY_STATS = ['ATK', 'DEF', 'HP', 'MP', 'SPD', 'IDMG', 'BOSSDMG', 'SPELLPWR', 'SKILLPWR'];

// The candidate stats a curse may lay its PENALTY on, given the item's affix `pool`,
// the `boostStat` its gift already took (never also the penalty), and `positive` — the
// stats the item currently carries a > 0 value on. Only ever returns FELT stats (see
// above), so the drawback can never be invisible. Prefers a felt stat the item already
// invests in (turning a genuine strength into a weakness), then any felt stat in the
// pool, then — only for a degenerate pool with no felt stat — the felt core, so a real
// item is never left with an empty candidate set. Returns [] only for an empty pool
// AND an empty core (never in practice), which the caller reads as "don't curse it".
export function cursePenaltyStats(pool, boostStat, positive = []) {
  const felt = new Set(FELT_CURSE_PENALTY_STATS);
  const pos = new Set(positive);
  const feltPool = (pool || []).filter(s => s !== boostStat && felt.has(s));
  const owned = feltPool.filter(s => pos.has(s));
  if (owned.length) return owned;
  if (feltPool.length) return feltPool;
  return FELT_CURSE_PENALTY_STATS.filter(s => s !== boostStat);
}
