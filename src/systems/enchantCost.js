// Enchanter costs — pure pricing for adding & rerolling item modifiers. Kept out
// of the render/DOM/state layers so the whole cost model is unit-testable: callers
// pass the item's rarity RANK (its TIERS index), item level, and how many bonus
// modifiers it already carries; nothing here reads game state, the DOM or RNG.
//
// Every cost is the plain { gold, glimmer, scrap?, core?, chaos? } object the
// shared wallet helpers (canAfford / spendCost / costLabel) understand. Scrap
// rides every enchant, Core joins on rare+ gear, and a Chaos Orb is spent on the
// big epic+ reforge — so enchanting draws on the same materials crafting does
// rather than draining Glimmer alone.
import { ENCH_COST } from '../data/enchantTuning.js';

// Gold + material multiplier for an item's rarity rank (0 junk … 6 unique).
export function enchTierFactor(rank) { return 1 + rank * ENCH_COST.tierFactorStep; }

// Augmenting the (affixes+1)-th modifier costs slotGrowth^affixes as much as the
// first — so a nearly-full piece's final slot is by far its priciest.
export function augmentSlotFactor(affixes) {
  return Math.pow(ENCH_COST.slotGrowth, Math.max(0, affixes | 0));
}

// Glimmer for one action: a base plus a gentle per-rarity term (div 0 → flat).
function glimmerFor(cfg, rank) {
  return cfg.base + (cfg.div ? Math.floor(rank / cfg.div) : 0);
}

// Fold the shared Scrap/Core bill into `cost`. Scrap is the guaranteed bulk sink
// (always ≥1); Core joins on rare+ gear but only once it rounds to a whole unit,
// so the cheapest micro-rerolls don't always spend a rare material. `weight`
// scales the whole bill per action (and, for augment, by the slot factor).
function addMaterials(cost, rank, ilvl, weight) {
  const m = ENCH_COST.materials;
  cost.scrap = Math.max(1, Math.round((m.scrapBase + rank * m.scrapPerRank) * (1 + ilvl * m.scrapIlvlStep) * weight));
  if (rank >= ENCH_COST.coreRank) {
    const core = Math.round((m.coreBase + (rank - ENCH_COST.coreRank) * m.corePerRank) * (1 + ilvl * m.coreIlvlStep) * weight);
    if (core >= 1) cost.core = core;
  }
  return cost;
}

// Gold for one action, from its base curve × the rarity factor × any extra scale.
function goldFor(cfg, rank, ilvl, scale = 1) {
  return Math.round((cfg.base + ilvl * cfg.perIlvl) * enchTierFactor(rank) * scale);
}

// Add one missing modifier. Cost climbs with rarity AND with how many modifiers
// the piece already carries (affixes), so filling the last slot costs far more
// than the first.
export function augmentCost({ rank, ilvl = 1, affixes = 0 }) {
  const slot = augmentSlotFactor(affixes);
  const cost = { gold: goldFor(ENCH_COST.gold.augment, rank, ilvl, slot), glimmer: glimmerFor(ENCH_COST.glimmer.augment, rank) };
  return addMaterials(cost, rank, ilvl, ENCH_COST.weights.augment * slot);
}

// Reforge every bonus modifier at once — the big gamble. Epic+ also burns a Chaos Orb.
export function rerollAllCost({ rank, ilvl = 1 }) {
  const cost = { gold: goldFor(ENCH_COST.gold.rerollAll, rank, ilvl), glimmer: glimmerFor(ENCH_COST.glimmer.rerollAll, rank) };
  addMaterials(cost, rank, ilvl, ENCH_COST.weights.rerollAll);
  if (rank >= ENCH_COST.chaosRank) cost.chaos = 1;
  return cost;
}

// Reroll a single modifier's TYPE (swap Might → Agility) — the bigger single-property gamble.
export function rerollTypeCost({ rank, ilvl = 1 }) {
  const cost = { gold: goldFor(ENCH_COST.gold.rerollType, rank, ilvl), glimmer: glimmerFor(ENCH_COST.glimmer.rerollType, rank) };
  return addMaterials(cost, rank, ilvl, ENCH_COST.weights.rerollType);
}

// Reroll a single modifier's VALUE (same modifier, new number) — the cheap reroll.
export function rerollValueCost({ rank, ilvl = 1 }) {
  const cost = { gold: goldFor(ENCH_COST.gold.rerollValue, rank, ilvl), glimmer: glimmerFor(ENCH_COST.glimmer.rerollValue, rank) };
  return addMaterials(cost, rank, ilvl, ENCH_COST.weights.rerollValue);
}
