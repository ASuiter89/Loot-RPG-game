// Salvage yields — what breaking one piece of gear sheds, per crafting material.
// Pure over the item's rarity rank + item level; the per-material bands live in
// data/salvageTuning.js. The legacy monolith owns the wallet mutation and the
// actual RNG roll (salvageYield); this module only shapes the chance & quantity
// ranges so both the salvage preview and the roll agree.

import { SALVAGE_MATERIALS } from '../data/salvageTuning.js';

// A deterministic per-item, per-salt jitter in [0,1) (a hashed sine), so two
// same-rarity pieces salvage a little differently while any given item stays
// stable across a preview and its roll.
export function salvageVariance(itemId, salt) {
  const x = Math.sin((((itemId || 0.5) + 1) * (salt * 12.9898 + 78.233))) * 43758.5453;
  return x - Math.floor(x);
}

// Item-level multiplier on salvage quantity: a diminishing-returns curve (early
// ilvl adds the most, deep ilvl barely moves it). `strength` softens it for the
// finer mats — Scrap rides the full curve, Glimmer/Core/Chaos scale gently since
// they're tied more to rarity than to mass.
export function salvageIlvlCurve(ilvl, strength = 1) {
  return 1 + (Math.sqrt(Math.max(1, ilvl || 1)) - 1) * 0.5 * strength;
}

// The raw drop chance a material sheds at this rarity `rank` (before per-item
// jitter): a linear climb from its floor, clamped to its ceiling. A chanceBase ≥ 1
// means guaranteed (Scrap). Below the material's minRank it can't shed at all.
export function materialChance(m, rank) {
  if (rank < m.minRank) return 0;
  if (m.chanceBase >= 1) return 1;
  const c = m.chanceBase + m.chancePerRank * Math.max(0, rank - m.chanceFrom);
  return Math.max(0, Math.min(m.chanceMax, c));
}

// What one item can yield, per material: a drop `chance` plus a quantity range
// (curved by item level and nudged by the item's own variance). Passing a mat's
// chance check always yields ≥1 — scarcity comes from the chance, the spread from
// the range. `rank` is the item's index in the TIERS order (junk 0 … red 6). The
// UI previews these and salvageYield() rolls them.
export function salvageRanges(item, rank) {
  const out = [];
  for (let mi = 0; mi < SALVAGE_MATERIALS.length; mi++) {
    const m = SALVAGE_MATERIALS[mi];
    if (rank < m.minRank) continue;
    const chance = materialChance(m, rank);
    const cJit = 0.88 + salvageVariance(item.id, mi * 101 + 1) * 0.24;   // ×0.88..1.12 drop chance
    const qJit = 0.80 + salvageVariance(item.id, mi * 211 + 2) * 0.40;   // ×0.80..1.20 quantity
    const qMid = m.qBase + m.qPerRank * Math.max(0, rank - m.qFrom);
    const mid = qMid * salvageIlvlCurve(item.ilvl || 1, m.strength) * qJit;
    const lo = Math.max(1, Math.round(mid * 0.65));
    const hi = Math.max(lo + 1, Math.round(mid * 1.35));
    // chance ≥ 1 means GUARANTEED — jitter varies only quantity, never gates it away.
    out.push({ key: m.key, chance: chance >= 1 ? 1 : Math.min(1, chance * cJit), lo, hi });
  }
  return out;
}
