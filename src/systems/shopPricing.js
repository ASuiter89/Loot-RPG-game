// Merchant restock pricing — the gold to lay out a whole fresh set of wares.
// Pure math over the merchant's item level and how many times you've already
// paid to restock this same merchant. Two forces shape it:
//   * Depth: the base scales super-linearly (a quadratic term dominates past the
//     early floors) so a deep-floor restock stays a real cost against a late-game
//     gold economy instead of rounding to pocket change.
//   * Repetition: every paid restock multiplies the price, so re-rolling for the
//     perfect drop gets steep fast rather than being a free slot-machine pull.

export const RESTOCK_BASE = 40;        // flat floor so even a level-1 restock costs something
export const RESTOCK_PER_ILVL = 14;    // linear term
export const RESTOCK_PER_ILVL_SQ = 1.2; // quadratic depth term (the deep-floor driver)
export const RESTOCK_GROWTH = 1.6;     // each prior restock multiplies the cost by this

// Cost to restock a merchant of item level `ilvl` that you have already restocked
// `restocks` times this visit (0 for the first paid restock).
export function restockCost(ilvl, restocks = 0) {
  const lvl = Math.max(1, Math.floor(ilvl) || 1);
  const times = Math.max(0, Math.floor(restocks) || 0);
  const base = RESTOCK_BASE + lvl * RESTOCK_PER_ILVL + lvl * lvl * RESTOCK_PER_ILVL_SQ;
  return Math.round(base * Math.pow(RESTOCK_GROWTH, times));
}
