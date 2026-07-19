// Merchant rarity scaling — tuning for how a shop's wares shift in rarity with
// how deep the hero has pushed. Pure data: consumed by systems/shopStock.js.
//
// Old behaviour: a merchant rolled one FLAT table (uncommon 40 / rare 34 / epic
// 16 / legendary 6 / unique 2) on every floor, so a floor-3 stall and a floor-90
// stall offered the same colours — and it ignored the early-game rarity gate, so
// a fresh hero could be sold greens/blues/purples/set gear the dungeon itself
// won't drop until the first bosses fall. Now each tier PEAKS in prominence
// around a "center" item level and fades away from it (a bell), so shallow
// merchants stock white→green and deep ones lean blue→orange→red — and the gate
// (systems/rarityGate.js) still removes any colour the hero hasn't earned.
//
// `center`/`spread` are in ITEM-LEVEL units (a merchant's ilvl ≈ its floor + 1).
// Broad, overlapping spreads keep two or three tiers live at any depth so a table
// never collapses to one colour. Ordered common → rare.
export const SHOP_TIER_BANDS = [
  { tier: 'normal',    center: 1,  spread: 6  },
  { tier: 'uncommon',  center: 7,  spread: 7  },
  { tier: 'rare',      center: 16, spread: 10 },
  { tier: 'epic',      center: 30, spread: 14 },
  { tier: 'legendary', center: 50, spread: 20 },
  { tier: 'unique',    center: 78, spread: 26 },
];

// A tier whose bell weight falls below this share of the whole table is dropped —
// stops a vanishingly small tail (e.g. a 0.07% unique at floor 10) from ever
// sneaking a wildly-out-of-band piece onto a shallow stall.
export const SHOP_TIER_FLOOR = 0.02;

// If progress + the gate leave nothing sellable (can't happen — 'normal' is never
// gated and never below the floor near ilvl 1), fall back to this tier.
export const SHOP_FALLBACK_TIER = 'normal';
