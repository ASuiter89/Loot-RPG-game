// Per-material salvage bands, keyed by an item's rarity RANK in the TIERS order
// (junk 0 · white 1 · green 2 · blue 3 · purple 4 · orange 5 · red 6). Breaking
// gear sheds these regardless of difficulty; RARITY is what governs which finer
// materials come out and — the point of this table — HOW OFTEN. The finer the
// material, the STEEPER its drop chance climbs with rarity, so a grey/white/green
// only occasionally sheds Glimmer/Core while a purple/orange/red reliably does.
//
// Listed commonest→rarest to match CRAFT_MAT_KEYS (scrap, glimmer, core, chaos);
// systems/salvage.js reads them in that order (the index seeds per-item variance).
//
//   drop chance(rank) = clamp(chanceBase + chancePerRank·max(0, rank − chanceFrom),
//                             0, chanceMax);  chanceBase ≥ 1 marks a GUARANTEED shed
//                             (Scrap — every piece yields at least one).
//   quantity midpoint(rank) = qBase + qPerRank·max(0, rank − qFrom), then curved by
//                             item level (strength) and nudged ±20% per-item.
export const SALVAGE_MATERIALS = [
  // Scrap — the bulk material; every piece, guaranteed. Quantity grows fastest with rarity.
  { key: 'scrap',   minRank: 0, chanceBase: 1,    chancePerRank: 0,    chanceFrom: 0, chanceMax: 1,   qBase: 1, qPerRank: 0.9,  qFrom: 0, strength: 1    },
  // Glimmer — white+ can shed it, but rarely at low rarity: ~10% white → ~25% green →
  // ~40% blue, climbing to ~85% at red. Grey junk melts to pure Scrap.
  { key: 'glimmer', minRank: 1, chanceBase: 0.10, chancePerRank: 0.15, chanceFrom: 1, chanceMax: 0.9, qBase: 1, qPerRank: 0.25, qFrom: 0, strength: 0.5  },
  // Core — green+ only, and a mere ~5% from a green: real odds arrive at blue (~19%)
  // and climb steeply (~33% purple → ~47% orange → ~61% red).
  { key: 'core',    minRank: 2, chanceBase: 0.05, chancePerRank: 0.14, chanceFrom: 2, chanceMax: 0.7, qBase: 1, qPerRank: 0.3,  qFrom: 2, strength: 0.5  },
  // Chaos — the top-end material; a lucky ~8% from a purple, better from orange/red.
  { key: 'chaos',   minRank: 4, chanceBase: 0.08, chancePerRank: 0.10, chanceFrom: 4, chanceMax: 0.6, qBase: 1, qPerRank: 0.5,  qFrom: 5, strength: 0.35 },
];
