// Sellsword hire pricing — pure cost model for the town mercenary camp. Kept out
// of the render/DOM/state layers so the whole model is unit-testable: callers pass
// the merc's price/power tier (`mult`), the deepest floor the hero has reached,
// and the chosen contract length's multiplier; nothing here reads game state, the
// DOM or RNG.
import { MERC_PRICE } from '../data/mercenaries.js';

// Gold to hire a merc of tier `mult` for ONE floor at the given max depth, before
// the contract-length discount. Scales steeply with depth, so a merc costs
// deep-dungeon wages once you are deep. `maxFloor` is clamped to ≥1 so an
// unexpected 0/undefined never underprices the hire.
export function mercFloorRate(mult, maxFloor) {
  const depth = Math.max(1, Math.floor(maxFloor) || 1);
  return (MERC_PRICE.floorBase + depth * MERC_PRICE.floorPerDepth) * (mult || 1);
}

// Total gold for a whole contract: the per-floor rate times the duration tier's
// multiplier (a little less than the floor count, giving a gentle bulk discount).
// Rounded to a whole coin.
export function mercCost(mult, maxFloor, durMult) {
  return Math.round(mercFloorRate(mult, maxFloor) * (durMult || 1));
}
