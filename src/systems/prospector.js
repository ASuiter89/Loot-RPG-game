// Prospector pricing + refinery math — pure functions over the tuning data in
// src/data/prospector.js. No RNG, no clock, no DOM: the gold cost of a material
// and the refine ratios are deterministic given the inputs, so this is fully
// unit-tested. The town UI (src/legacy/game.js) passes live state in and spends
// the results through the shared wallet helpers.

import {
  PROSPECTOR_BASE_PRICE, PROSPECTOR_VISIT_MARKUP, PROSPECTOR_DEPTH_MARKUP,
  REFINE_CHAIN, REFINE_COST,
} from '../data/prospector.js';

// Gold price for ONE unit of `mat`, given how deep the hero has reached (maxDepth)
// and how many separate PURCHASES of that material they've made this visit
// (purchasesThisVisit). Depth adds a flat surcharge; each prior purchase compounds
// the visit markup. Always ≥ 1 and rounded to a whole coin.
export function unitPrice(mat, maxDepth = 1, purchasesThisVisit = 0) {
  const base = PROSPECTOR_BASE_PRICE[mat] || 0;
  if (base <= 0) return 0;
  const depthMult = 1 + PROSPECTOR_DEPTH_MARKUP * Math.max(0, (maxDepth || 1) - 1);
  const visitMult = Math.pow(1 + PROSPECTOR_VISIT_MARKUP, Math.max(0, purchasesThisVisit));
  return Math.max(1, Math.round(base * depthMult * visitMult));
}

// Total gold for a lot of `qty` units bought in ONE purchase — flat at the current
// unit price. The visit markup compounds PER PURCHASE, not per unit (like the
// Merchant's restock surcharge), so a bulk lot is always the cheapest way to buy a
// quantity and a common material's big lot never balloons geometrically.
export function lotPrice(mat, qty, maxDepth = 1, purchasesThisVisit = 0) {
  return unitPrice(mat, maxDepth, purchasesThisVisit) * Math.max(0, Math.floor(qty));
}

// Refinery: how many of `mat` are consumed to yield ONE of the next tier up, or
// null if `mat` is unknown or already the top tier (Chaos Orb has none above).
export function refineCost(mat) {
  const i = REFINE_CHAIN.indexOf(mat);
  if (i < 0 || i >= REFINE_CHAIN.length - 1) return null;
  return REFINE_COST[mat];
}

// The material `mat` refines UP into, or null if it has no higher tier.
export function refineYield(mat) {
  const i = REFINE_CHAIN.indexOf(mat);
  if (i < 0 || i >= REFINE_CHAIN.length - 1) return null;
  return REFINE_CHAIN[i + 1];
}

// True if the hero holds enough of `mat` (have units) to run one refine.
export function canRefine(mat, have) {
  const need = refineCost(mat);
  return need != null && (have || 0) >= need;
}
