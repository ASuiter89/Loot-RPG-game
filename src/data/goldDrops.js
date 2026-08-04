// ── GOLD DROP TUNING ──
// What a slain foe's coin drop is worth BEFORE the hero's own multipliers (Gold
// Find, Greed, ramen, Blessings, farm decay…): a flat roll plus a per-depth
// slice, so a floor's income climbs linearly with how deep it sits. The kill
// payout in the game shell rolls these; town prices that are meant to track what
// the floor pays read the average instead (see avgGoldDrop / blessingCost).

export const GOLD_DROP_MIN = 2;
export const GOLD_DROP_MAX = 8;
export const GOLD_DROP_PER_DEPTH = 3;

// Mean of the flat roll — the "typical" drop before depth is added in.
export const GOLD_DROP_FLAT = (GOLD_DROP_MIN + GOLD_DROP_MAX) / 2;
