// Progress- and gate-aware rarity distribution for merchant wares (the roaming
// dungeon merchant and the town shop share it). Replaces the old flat weight table
// that offered the same colours on floor 1 and floor 100 and ignored the early
// rarity gate entirely.
//
// Two signals shape a stall:
//   • ITEM LEVEL (`ilvl`, a merchant's gear depth) drives a bell per tier — each
//     tier peaks around its `center` ilvl and fades away from it, so shallow
//     merchants stock white→green and deep ones lean blue→orange→red.
//   • The rarity GATE (boss first-kill ledger + deepest floor) removes any colour
//     the hero hasn't earned yet — greens until the floor-5 guardian, blues and
//     rarer until the floor-10 one — exactly as it gates dungeon drops.
//
// Pure: no RNG, no state, no DOM. Returns a { tier: weight } map the caller feeds
// to its own weighted picker.

import { SHOP_TIER_BANDS, SHOP_TIER_FLOOR, SHOP_FALLBACK_TIER } from '../data/shopStock.js';
import { lockedTiers } from './rarityGate.js';

// How prominent one tier is at item level `ilvl`: a Gaussian bump centred on the
// tier's `center`, so weight tails off smoothly as the shop's depth moves away
// from where that colour belongs.
function bandWeight(band, ilvl) {
  const z = (ilvl - band.center) / band.spread;
  return Math.exp(-z * z);
}

// The rarity weights for a merchant whose wares are geared to `ilvl`, for a hero
// with the given boss ledger + deepest floor. Tiers the gate still locks are
// dropped; a tier whose share is below SHOP_TIER_FLOOR is dropped too (no
// out-of-band tail piece). Always returns at least one tier.
export function shopTierWeights(ilvl, bossFirstKills, maxFloor) {
  const lvl = Math.max(1, Number(ilvl) || 1);
  const locked = lockedTiers(bossFirstKills, maxFloor);

  // Raw bell weights over the tiers this hero may actually be sold.
  const raw = {};
  let total = 0;
  for (const band of SHOP_TIER_BANDS) {
    if (locked.has(band.tier)) continue;
    const w = bandWeight(band, lvl);
    if (w > 0) { raw[band.tier] = w; total += w; }
  }

  // Trim the negligible tail, then hand back the survivors.
  const weights = {};
  if (total > 0) {
    for (const [tier, w] of Object.entries(raw)) {
      if (w / total >= SHOP_TIER_FLOOR) weights[tier] = w;
    }
  }
  if (Object.keys(weights).length === 0) weights[SHOP_FALLBACK_TIER] = 1;
  return weights;
}
