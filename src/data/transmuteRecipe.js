// Transmuter recipe tuning — how many UNLOCKED same-rarity pieces one fuse
// consumes to draw out a single item of the next rarity up. Keyed by the SOURCE
// rarity; the count climbs as you fuse higher up the ladder, so a unique/set is
// the priciest to reach. The top rarity (unique) has no entry — it can't be
// pushed higher. Pure data (see CLAUDE.md ▸ data-driven design); the recipe logic
// in systems/transmute.js reads this, it doesn't embed it.
export const TRANSMUTE_COUNTS = {
  junk:      2,
  normal:    2,
  uncommon:  3,
  rare:      3,
  epic:      4,
  legendary: 5,
};
