// Enchanter cost tuning — pure values, read by src/systems/enchantCost.js.
//
// Enchanting is paid in gold plus crafting MATERIALS. Rather than always billing
// the same Scrap + Glimmer + Core, every piece draws a randomized MATERIAL PALETTE
// — a small, deterministic subset of {Scrap, Glimmer, Core, Chaos Orb} keyed off
// the item's own id — so two pieces of the same rarity can cost quite different
// mixes. The palette stays FIXED for a given piece (only the amounts move); which
// materials appear is gated by rarity so a piece never demands a material far
// rarer than itself.
//
// Two forces shape the amounts:
//   • Rarity & item level raise the base MATERIAL BUDGET (and gold).
//   • An anti-abuse ESCALATION: every value/type/all reroll a piece receives bumps
//     its personal tally, and every cost on that piece is multiplied by
//     escalationStep^tally — forever. Brute-forcing a perfect piece therefore costs
//     exponentially more each attempt, so a deep stockpile can't trivially reroll a
//     piece to perfection.
//
// Rarity is expressed as a RANK: the item's index in TIERS (0 junk, 1 normal,
// 2 uncommon, 3 rare, 4 epic, 5 legendary, 6 unique).
export const ENCH_COST = {
  // Gold bill climbs 30% per rarity rank (the long-standing curve).
  tierFactorStep: 0.3,
  // Augmenting the (N+1)-th modifier costs slotGrowth^N as much as the first, so
  // a nearly-full piece's last slot is dramatically pricier than its first.
  slotGrowth: 1.6,
  // Gold per action: (base + ilvl * perIlvl) * tierFactor * escalation
  // (augment is further multiplied by its slot factor).
  gold: {
    augment:     { base: 30, perIlvl: 5 },
    rerollAll:   { base: 45, perIlvl: 7 },
    rerollType:  { base: 18, perIlvl: 3 },
    rerollValue: { base: 10, perIlvl: 2 },
  },
  // Per-action weight scaling the shared material budget. Reroll-all (a full
  // reforge) costs most; a single value reroll is the cheapest nibble. Augment
  // is 1.0 here and further multiplied by its slot factor.
  weights: {
    augment:     1.0,
    rerollAll:   1.4,
    rerollType:  0.5,
    rerollValue: 0.3,
  },

  // ── Material budget & randomized palette ──
  // Each action draws a MATERIAL BUDGET in Scrap-equivalent "points":
  //   (base + rank * perRank) * (1 + ilvl * ilvlStep) * actionWeight * escalation.
  // The budget is then split across the piece's palette, each material's point
  // share converted to whole units by its per-unit worth below.
  material: { base: 9, perRank: 8, ilvlStep: 0.05 },
  // Scrap-equivalent worth of ONE unit of each material — rarer material is worth
  // more, so it's charged in FEWER units. Ratios track relative drop income (Scrap
  // is the common bulk; Glimmer ~6x rarer, Core ~14x, a Chaos Orb ~30x), so the
  // total pressure of a bill stays comparable no matter which materials it lands on.
  matValue: { scrap: 1, glimmer: 6, core: 14, chaos: 30 },
  // Lowest rarity RANK at which a material can enter a palette — mirrors when that
  // material starts dropping, so a piece never asks for something far rarer than
  // itself: Scrap/Glimmer from the start, Core on rare+ gear, a Chaos Orb only on
  // legendary+ reforges (Chaos was crafting-only before — now it's the rare spice
  // that the very best gear occasionally demands).
  matUnlock: { scrap: 0, glimmer: 1, core: 3, chaos: 5 },
  // Relative odds a material is drawn into a palette when eligible — commoner
  // materials appear far more often than rare ones (a Chaos Orb is a rare spice
  // even where it's allowed).
  matSelectWeight: { scrap: 5, glimmer: 4, core: 2, chaos: 1 },

  // ── Anti-abuse: escalating cost per reroll ──
  // Every value, type or full reroll a piece receives multiplies ALL of its future
  // enchant costs (gold + materials) by this factor — compounding, forever. 1.15
  // barely bites the first couple of fixes but makes brute-forcing dozens of rolls
  // ruinously expensive.
  escalationStep: 1.15,
};
