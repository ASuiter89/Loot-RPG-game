// Enchanter cost tuning — pure values, read by src/systems/enchantCost.js.
//
// Enchanting is paid in Glimmer (the Enchanter's staple fuel) and gold, and now
// in the bulk crafting materials too: Scrap on every action and a Core on rare+
// gear. This draws enchanting on the same overflowing wallet crafting spends
// from — so Scrap and Cores no longer pile up unused while Glimmer runs dry —
// and ties the price to the item's rarity. Augmenting additionally scales with
// how many modifiers the piece already carries, so its final slot costs far more
// than its first. (Chaos Orbs stay a crafting-only material — the Enchanter never
// asks for them.)
//
// Rarity is expressed as a RANK: the item's index in TIERS (0 junk, 1 normal,
// 2 uncommon, 3 rare, 4 epic, 5 legendary, 6 unique).
export const ENCH_COST = {
  // Gold + material bill both climb 30% per rarity rank (the long-standing curve).
  tierFactorStep: 0.3,
  // Augmenting the (N+1)-th modifier costs slotGrowth^N as much as the first, so
  // a nearly-full piece's last slot is dramatically pricier than its first.
  slotGrowth: 1.6,
  // Rarity rank at which Core enters the bill (Chaos Orbs are crafting-only).
  coreRank: 3,     // rare+ gear costs Cores to enchant
  // Gold per action: (base + ilvl * perIlvl) * tierFactor
  // (augment is further multiplied by its slot factor).
  gold: {
    augment:     { base: 30, perIlvl: 5 },
    rerollAll:   { base: 45, perIlvl: 7 },
    rerollType:  { base: 18, perIlvl: 3 },
    rerollValue: { base: 10, perIlvl: 2 },
  },
  // Glimmer per action: base + floor(rank / div)  (div 0 → flat, no rarity term).
  glimmer: {
    augment:     { base: 2, div: 2 },
    rerollAll:   { base: 3, div: 2 },
    rerollType:  { base: 1, div: 3 },
    rerollValue: { base: 1, div: 0 },
  },
  // Per-action weight scaling the shared Scrap/Core bill. Reroll-all (a full
  // reforge) costs most; a single value reroll is the cheapest nibble. Augment
  // is 1.0 here and further multiplied by its slot factor.
  weights: {
    augment:     1.0,
    rerollAll:   1.4,
    rerollType:  0.5,
    rerollValue: 0.3,
  },
  // Shared Scrap (bulk, always ≥1) + Core (rare+, charged only once it rounds to
  // a whole unit) curve, scaling with rarity rank and item level. Amounts are
  // tuned to be PROPORTIONAL to how much of each material the game hands you: you
  // earn Scrap on every drop/salvage but Glimmer/Core far less often, so Scrap is
  // priced ~5x the Glimmer bill (and Core ~half of it) — that way enchanting draws
  // each material's stockpile down at a similar rate instead of leaving Scrap and
  // Cores to pile up while Glimmer runs dry. (Income: Scrap is guaranteed on every
  // salvage; Glimmer ~1/6 as often; Core ~0.4x Glimmer — see salvageRanges &
  // the on-kill drop rolls.)
  materials: {
    scrapBase: 4, scrapPerRank: 2.75, scrapIlvlStep: 0.05,
    coreBase: 1, corePerRank: 0.7, coreIlvlStep: 0.03,
  },
};
