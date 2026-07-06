// Paying to re-roll a merchant's wares escalates: each restock already bought this
// visit makes the next one dearer, so restocking is a deliberate gold sink rather
// than a spammable slot machine. The surcharge is a flat fraction of the base cost
// per prior restock; the count resets when a fresh set of wares is laid out (a new
// town visit, or a new floor's wandering merchant).

// +this fraction of the base cost per restock already purchased this visit.
export const RESTOCK_ESCALATION = 0.6;

// Gold to lay out a fresh set of wares. `base` is the tier-scaled floor price;
// `restocks` is how many paid restocks have already happened this visit (0 for the
// first). Linear surcharge — e.g. base, 1.6×, 2.2×, 2.8×, … at the default rate.
export function restockCost(base, restocks = 0, escalation = RESTOCK_ESCALATION) {
  const n = Math.max(0, restocks | 0);
  return Math.round(base * (1 + n * escalation));
}
