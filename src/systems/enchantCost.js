// Enchanter costs — pure pricing for adding & rerolling item modifiers. Kept out
// of the render/DOM/state layers so the whole cost model is unit-testable: callers
// pass the item's rarity RANK (its TIERS index), item level, how many bonus
// modifiers it already carries, its reroll TALLY (for escalation), and a stable
// SEED (its id, for the material palette). Nothing here reads game state, the DOM,
// or live RNG — the only randomness is a seeded stream derived from the item id, so
// a given piece always prices the same way for the same inputs.
//
// Every cost is the plain { gold, scrap?, glimmer?, core?, chaos? } object the
// shared wallet helpers (canAfford / spendCost / costLabel) understand. Instead of
// always billing the same materials, each piece draws a randomized MATERIAL PALETTE
// (a subset of the four crafting materials, keyed off its id) and the material
// budget is split across it — so different pieces cost different mixes.
import { ENCH_COST } from '../data/enchantTuning.js';
import { mulberry32 } from '../utils/rng.js';

// Gold + material multiplier for an item's rarity rank (0 junk … 6 unique).
export function enchTierFactor(rank) { return 1 + rank * ENCH_COST.tierFactorStep; }

// Augmenting the (affixes+1)-th modifier costs slotGrowth^affixes as much as the
// first — so a nearly-full piece's final slot is by far its priciest.
export function augmentSlotFactor(affixes) {
  return Math.pow(ENCH_COST.slotGrowth, Math.max(0, affixes | 0));
}

// Escalation multiplier: every value/type/all reroll a piece receives bumps its
// tally, and EVERY cost on that piece is scaled by escalationStep^tally — forever.
// So dialing in a perfect piece by brute force gets exponentially dearer, and a
// deep stockpile can't trivially reroll a piece to perfection.
export function enchEscalation(tally = 0) {
  return Math.pow(ENCH_COST.escalationStep, Math.max(0, tally | 0));
}

// Stable 32-bit hash of an item seed (its id) → seeds the palette RNG so a given
// piece always draws the SAME material mix (only the amounts move with cost). FNV-1a.
function seedInt(seed) {
  const s = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Materials eligible to appear in a piece's palette at rarity `rank`, commonest
// first. Higher rarity unlocks rarer materials (mirrors each material's drop tier),
// so a piece never demands a material far rarer than itself.
export function eligibleMaterials(rank) {
  return ['scrap', 'glimmer', 'core', 'chaos'].filter(k => (rank | 0) >= ENCH_COST.matUnlock[k]);
}

// The per-item PALETTE: a deterministic subset of the eligible materials, weighted
// so common materials appear more often than rare ones. Purely a function of
// (rank, seed) — no game state, no live RNG — so it's stable and unit-testable, and
// stays fixed for a given piece no matter how its cost grows.
export function materialPalette(rank, seed) {
  const pool = eligibleMaterials(rank).map(k => ({ k, w: ENCH_COST.matSelectWeight[k] }));
  if (!pool.length) return ['scrap'];
  const rng = mulberry32(seedInt(seed));
  // Spread the bill across 1..maxK distinct materials (legendary+ may reach three).
  const maxK = Math.min(pool.length, (rank | 0) >= ENCH_COST.matUnlock.chaos ? 3 : 2);
  const k = 1 + Math.floor(rng() * maxK);
  const chosen = [];
  for (let i = 0; i < k && pool.length; i++) {
    let total = 0; for (const m of pool) total += m.w;
    let r = rng() * total, idx = 0;
    while (idx < pool.length - 1 && r >= pool[idx].w) { r -= pool[idx].w; idx++; }
    chosen.push(pool[idx].k);
    pool.splice(idx, 1);
  }
  return chosen;
}

// Split a material BUDGET (Scrap-equivalent points) across the piece's palette,
// converting each material's point-share to whole units by its per-unit worth
// (rarer material → fewer units), never below 1. Deterministic per item.
function materialBill(rank, ilvl, weight, seed, escalation) {
  const m = ENCH_COST.material;
  const budget = (m.base + rank * m.perRank) * (1 + ilvl * m.ilvlStep) * weight * escalation;
  const palette = materialPalette(rank, seed);
  // A second, independent seeded stream weights how the budget splits across the mix.
  const rng = mulberry32((seedInt(seed) ^ 0x9e3779b9) >>> 0);
  const shares = palette.map(() => 0.6 + rng());   // each in [0.6, 1.6)
  let sum = 0; for (const s of shares) sum += s;
  if (!sum) sum = 1;
  const bill = {};
  palette.forEach((mat, i) => {
    const points = budget * shares[i] / sum;
    bill[mat] = Math.max(1, Math.round(points / ENCH_COST.matValue[mat]));
  });
  return bill;
}

// Gold for one action, from its base curve × the rarity factor × any extra scale ×
// the piece's escalation.
function goldFor(cfg, rank, ilvl, scale, escalation) {
  return Math.round((cfg.base + ilvl * cfg.perIlvl) * enchTierFactor(rank) * scale * escalation);
}

// Add one missing modifier. Cost climbs with rarity AND with how many modifiers
// the piece already carries (affixes), so filling the last slot costs far more than
// the first — all of it scaled by the piece's reroll escalation.
export function augmentCost({ rank, ilvl = 1, affixes = 0, tally = 0, seed = 0 }) {
  const slot = augmentSlotFactor(affixes);
  const esc = enchEscalation(tally);
  const cost = { gold: goldFor(ENCH_COST.gold.augment, rank, ilvl, slot, esc) };
  return Object.assign(cost, materialBill(rank, ilvl, ENCH_COST.weights.augment * slot, seed, esc));
}

// Reforge every bonus modifier at once — the big gamble across every slot.
export function rerollAllCost({ rank, ilvl = 1, tally = 0, seed = 0 }) {
  const esc = enchEscalation(tally);
  const cost = { gold: goldFor(ENCH_COST.gold.rerollAll, rank, ilvl, 1, esc) };
  return Object.assign(cost, materialBill(rank, ilvl, ENCH_COST.weights.rerollAll, seed, esc));
}

// Reroll a single modifier's TYPE (swap Might → Agility) — the bigger single-property gamble.
export function rerollTypeCost({ rank, ilvl = 1, tally = 0, seed = 0 }) {
  const esc = enchEscalation(tally);
  const cost = { gold: goldFor(ENCH_COST.gold.rerollType, rank, ilvl, 1, esc) };
  return Object.assign(cost, materialBill(rank, ilvl, ENCH_COST.weights.rerollType, seed, esc));
}

// Reroll a single modifier's VALUE (same modifier, new number) — the cheap reroll.
export function rerollValueCost({ rank, ilvl = 1, tally = 0, seed = 0 }) {
  const esc = enchEscalation(tally);
  const cost = { gold: goldFor(ENCH_COST.gold.rerollValue, rank, ilvl, 1, esc) };
  return Object.assign(cost, materialBill(rank, ilvl, ENCH_COST.weights.rerollValue, seed, esc));
}
