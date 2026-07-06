// ── THE MIRRORFORGE — deep-crafting / perfection tuning ──
// Pure values behind the Mirrorforge endgame sink (logic in
// src/systems/mirrorforge.js). The Mirrorforge answers a specific late-game
// problem: once you are deep in Endless the wallet OVERFLOWS with Scrap/Glimmer/
// Core/Chaos and there is nothing bounded to chase — every craft is another
// infinite reroll. The Mirrorforge turns that glut into a BOUNDED, targetable
// climb: each item carries a finite Forging Potential (FP) budget, layered
// actions spend FP + materials to sculpt its affixes toward perfect, and MIRROR
// locks a flawless copy — a second, much harder collection axis (Owned →
// Perfected). Because FP is finite per item, you cannot brute-force perfection;
// you plan the spend, and a mistake (or a Corrupt gamble) is permanent.
//
// Rarity here is the item's RANK — its index in TIERS (0 junk, 1 normal,
// 2 uncommon, 3 rare, 4 epic, 5 legendary, 6 unique) — mirroring every other
// crafting system (Enchanter, Empower).
//
// Materials: the four staples the wallet already tracks (scrap/glimmer/core/
// chaos) PLUS a brand-new deep-Endless material, AETHER, gated behind
// `aether.minEndlessDepth`. Aether is the Mirror sink and the Divine "top-roll"
// fuel, so it stays rare and meaningful even when the four staples are maxed out.
export const MIRRORFORGE = {
  // ── Forging Potential budget ──
  // Total FP an item can ever spend = base + perRank·rank + perIlvl·ilvl. Higher
  // rarity and deeper item level buy a bigger sculpting budget (a red ilvl-120
  // artifact affords far more layered work than a blue ilvl-40 piece), but the
  // budget is always FINITE — that is the whole point of the system.
  //   e.g. rank 5, ilvl 80  → 100 + 20·5 + 2·80 = 360 FP
  fp: { base: 100, perRank: 20, perIlvl: 2 },

  // ── Per-action cost: FP drawn from the item's budget + materials from the
  // wallet. FP is the SCARCE, per-item resource that bounds how many actions an
  // item can take; materials are the (abundant) glut this system is designed to
  // drain. Mirror costs no FP (it is the final lock, not a sculpt) but demands a
  // heavy material bill topped with the rare Aether.
  costs: {
    // Attune — reforge the bonus affixes, guaranteeing your chosen stat rolls
    // strong. The cheap, repeatable "aim the reforge" action.
    attune:  { fp: 40, mats: { scrap: 60, glimmer: 12, core: 2, chaos: 0 } },
    // Exalt — deterministically shove one affix halfway to its ceiling. No RNG:
    // the reliable way to grind a chosen stat up (with diminishing returns).
    exalt:   { fp: 55, mats: { scrap: 40, glimmer: 8, core: 3, chaos: 1 } },
    // Divine — reroll one affix's value in-band (optionally snap to its top decile
    // by spending Aether). The precision finisher.
    divine:  { fp: 70, mats: { scrap: 30, glimmer: 20, core: 4, chaos: 2 } },
    // Corrupt — a one-shot, irreversible gamble that SEALS the item (no further
    // crafting) but can grant an extra affix, a greater "radiant" roll, a unique
    // signature, or a heavy curse. High Chaos/Core, no Scrap — a pure gamble sink.
    corrupt: { fp: 90, mats: { scrap: 0, glimmer: 0, core: 5, chaos: 5 } },
    // Mirror — lock a perfect copy into the collection's Perfected axis. Costs no
    // FP; the sink is the wallet + the deep-Endless Aether.
    mirror:  { fp: 0, mats: { scrap: 500, glimmer: 100, core: 30, chaos: 15, aether: 3 } },
  },

  // ── Corrupt outcome table ──
  // A single weighted roll when you Corrupt. Weights are relative (normalised at
  // roll time), so a curse (50/100) is the common result and a signature (5/100)
  // is the jackpot. Every outcome keeps the item — Corrupt NEVER destroys gear,
  // it only seals it — so the gamble is "what did I get", never "did I lose it".
  corruptOutcomes: [
    // Blessing: append one extra bonus affix rolled inside `band`. A clean upgrade.
    { id: 'blessing',  weight: 30, kind: 'addAffix', band: { min: 10, max: 40 } },
    // Radiant: flag the item radiant and push one affix into its top decile — a
    // "greater roll", the same band deep-Endless drops can roll (see `radiant`).
    { id: 'radiant',   weight: 15, kind: 'radiant' },
    // Signature: brand the item with a unique Mirrorforge power id. The rarest
    // corrupt result — the shell maps the id to a bespoke on-item power.
    { id: 'signature', weight: 5,  kind: 'signature', signature: 'mirrorbrand' },
    // Curse: a big boost on one affix paired with an equally big penalty (reuses
    // the shared curse-swing math, so the drawback is always as strong as the gift).
    { id: 'curse',     weight: 50, kind: 'curse' },
  ],

  // ── Radiant "greater roll" chance in deep Endless ──
  // The odds a naturally-dropped affix rolls radiant (top-decile band) climb with
  // Endless depth, from `chanceBase`, `perDepth` per floor, capped at `cap`. `band`
  // is the {min,max} fraction of an affix's own range a radiant roll lands in — the
  // top 10% by default. Bounded so even the deepest floor is a nudge, not a gift.
  radiant: { chanceBase: 0.02, perDepth: 0.005, cap: 0.35, band: { min: 0.9, max: 1.0 } },

  // ── Aether gate ──
  // The new deep material only starts dropping at this Endless depth, so Mirroring
  // is strictly an Endless-mastery pursuit (finite difficulties can perfect-sculpt
  // an item with FP + staples, but cannot Mirror it without going deep).
  aether: { minEndlessDepth: 90 },

  // ── Attunement (shatter → pity currency) ──
  // Shattering a worked item returns Attunement, the Mirrorforge's pity currency:
  // it feeds the SHARED targeting pity (src/systems/collectionTargeting.js) that
  // lets you aim a farm at a still-missing artifact. Gain scales with rank + a
  // slice of ilvl, with fat bonuses for shattering a radiant or an already-mirrored
  // piece (so retiring a perfect copy is never a total loss).
  attunement: { perShatter: 5, perRank: 3, radiantBonus: 10, mirroredBonus: 25, perIlvlDiv: 20 },

  // ── Action tuning constants (kept out of logic per the data-driven rule) ──
  // Exalt closes this fraction of the gap to an affix's max each cast (0.5 → halve
  // the remaining gap, classic diminishing returns).
  exaltFraction: 0.5,
  // Divine-with-Aether snaps into the band [min + aetherDecile·range, max] — the
  // top decile by default (a guaranteed near-perfect roll).
  aetherDecile: 0.9,
  // Attune guarantees the targeted stat rolls in the top (1 - attuneTargetFloor)
  // of its band — 0.5 → the top half, so an Attuned target is always at least a
  // mid-high roll of that stat.
  attuneTargetFloor: 0.5,
};
