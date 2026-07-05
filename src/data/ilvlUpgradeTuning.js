// Item-level upgrade ("Empower") cost + rescale tuning — pure values, read by
// src/systems/ilvlUpgrade.js.
//
// Empowering raises a piece's item level toward what could currently drop for
// you, scaling every stat, modifier and requirement up as if the item had
// dropped that deep. It is paid in gold and the bulk crafting materials (Scrap
// always, a Core on rare+ gear) so it draws on the same wallet the Craftsman and
// Enchanter spend from. The whole bill scales with the item's RARITY rank and
// with the item LEVEL each step reaches — and, because the per-level cost is
// summed across every level gained, a bigger jump costs more than the sum of its
// parts' shallow levels (the deeper levels in the jump are the priciest).
//
// Rarity is a RANK: the item's index in TIERS (0 junk, 1 normal, 2 uncommon,
// 3 rare, 4 epic, 5 legendary, 6 unique).
export const ILVL_UPGRADE = {
  // Gold + material bill climb this much per rarity rank (a touch steeper than
  // the Enchanter's 0.3, so empowering a red artifact is a real investment).
  tierFactorStep: 0.35,
  // Rarity rank at which a Core joins the bill (rare+), mirroring the Craftsman
  // and Enchanter. Chaos Orbs stay crafting-only — Empower never asks for them.
  coreRank: 3,
  // Per-level (per single +1) cost curves. The cost of reaching item level L is
  //   gold  = (goldBase  + L * goldPerIlvl)  * tierFactor(rank)
  //   scrap = (scrapBase + L * scrapPerIlvl) * tierFactor(rank)   (min 1)
  //   core  = coreBase + (rank - coreRank) * corePerRank + L * coreIlvlStep  (rank ≥ coreRank; charged once it rounds to ≥1)
  // summed over every level a jump gains, so +10 costs the sum of its ten levels.
  goldBase: 12, goldPerIlvl: 6,
  scrapBase: 2, scrapPerIlvl: 0.6,
  coreBase: 0.3, corePerRank: 0.4, coreIlvlStep: 0.04,

  // Generation-curve factors per HEADLINE role, used to rescale the deterministic
  // headline values (weapon DMG, armour/shield DEF, hands/off-hand ATK, shield
  // BLOCK) by the ratio of the curve at the two item levels. These MIRROR the
  // slopes baked into applyBaseStats() in src/legacy/game.js — keep them in sync:
  //   DMG   base = (2 + lvl*1.2) * dmgMult * dm
  //   DEF        = (1 + lvl)     * mult * slotDef * def
  //   ATK        = (1 + lvl*0.35)* mult * 0.6 * atk
  //   BLOCK      = (base|8)      * (1 + lvl*0.15)
  // The rarity/base/slot constants cancel in the ratio, so only the (base, per)
  // slope matters here.
  headlineSlopes: {
    DMG:   { base: 2, per: 1.2 },
    DEF:   { base: 1, per: 1.0 },
    ATK:   { base: 1, per: 0.35 },
    BLOCK: { base: 1, per: 0.15 },
  },
};
