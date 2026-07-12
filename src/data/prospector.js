// The Prospector — a town keeper who trades GOLD for raw crafting materials and
// refines commons up into rarer ones. Pure tuning values: the pricing / refine
// math lives in src/systems/prospector.js and the UI in src/legacy/game.js.
//
// Design intent — buying materials is a GOLD SINK, never a shortcut past the
// difficulty gate that governs what materials you can even earn (see the
// caller's buyable() check against MATERIAL_MIN_DIFF). Prices climb steeply by
// rarity, grow with the depth you've reached, and escalate within a single visit,
// so you can top up a material you already farm — not stockpile a rarer one cheap.

// Base gold price for ONE unit of each material at depth 1, before the depth
// surcharge and the per-visit escalation. Commonest → rarest.
export const PROSPECTOR_BASE_PRICE = { scrap: 40, glimmer: 200, core: 1200, chaos: 7000 };

// Each separate PURCHASE of a material this visit makes the next purchase of it
// dearer by this factor (compounding per buy, like the Merchant's restock
// surcharge — not per unit, so a bulk lot stays flat). Discourages draining the
// trader of a rare material in one sitting. Resets when you next enter town.
export const PROSPECTOR_VISIT_MARKUP = 0.12;

// Gold price grows with the deepest floor reached — deep heroes pay deep-camp
// rates — added as a fraction of the base per floor of max depth beyond 1.
export const PROSPECTOR_DEPTH_MARKUP = 0.015;

// Bulk-buy lot sizes offered per material (one button each). Rarer materials buy
// in smaller lots so a single click never dumps a fortune of the top tier.
export const PROSPECTOR_LOTS = {
  scrap: [1, 10, 50],
  glimmer: [1, 5, 25],
  core: [1, 5],
  chaos: [1],
};

// Refinery — fuse N of a material into 1 of the next tier up. The chain is the
// material rarity order; REFINE_COST is how many of a key yield ONE of the next.
// Deliberately LOSSY (each ratio costs more base-gold than just buying the higher
// material outright), so refining is a way to spend a surplus of commons you'll
// never use — not an efficient bypass of the gold price.
export const REFINE_CHAIN = ['scrap', 'glimmer', 'core', 'chaos'];
export const REFINE_COST = { scrap: 8, glimmer: 8, core: 7 };
