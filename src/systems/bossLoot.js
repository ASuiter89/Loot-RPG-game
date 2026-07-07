// Boss / elite / ordinary-foe loot picks — the "how MUCH and how GOOD" numbers a
// slain foe drops, plus the FIRST-KILL JACKPOT. The first time a hero clears a given
// boss floor, its guardian spills far more loot at noticeably higher quality (a
// one-time reward for finally beating it); re-clearing the same floor (farming)
// reverts to the normal boss numbers — still good, but subject to the separate
// farm-fatigue curve. Whether a kill counts as the "first" is decided at the edge
// (see onEnemyDefeated, keyed by floor) and passed in as foe.firstKill; this module
// only turns that flag into pick/quality numbers. Pure so the payout math stays
// unit-testable — the RNG that spends these numbers, and the Magic Find / Fortune /
// farm multipliers, live at the edge.

// Per-tier drop shape. `picks` is how many independent loot rolls a kill makes;
// `noDrop` is the chance a single pick finds nothing; `quality` is the per-item
// quality nudge (each step ≈ +15 effective Magic Find inside rollTier).
export const KILL_LOOT = {
  boss:   { picks: 5, noDrop: 0.30, quality: 3 },
  elite:  { picks: 3, noDrop: 0.55, quality: 2 },
  normal: { picks: 1, noDrop: 0.90, quality: 1 },
  // First-kill jackpot (bosses only): ~3× the picks, a quality bump on every item,
  // and a slashed empty-pick chance so nearly every one of those extra picks lands.
  firstKill: { lootMult: 3, qualityBonus: 3, noDropMult: 0.35 },
};

// The foe's loot "class" — boss, elite, or ordinary — which selects its drop shape.
export function killLootClass(foe) {
  if (foe && foe.isBoss) return 'boss';
  if (foe && foe.isElite) return 'elite';
  return 'normal';
}

// Derive the base loot parameters for a slain foe. A boss's FIRST kill
// (`foe.firstKill`) multiplies its picks, bumps item quality, and cuts the empty-pick
// chance — the jackpot. Every other kill returns its plain per-tier numbers. Fortune,
// farm fatigue and Magic Find are layered on by the caller, on top of these bases.
export function killLootParams(foe, tuning = KILL_LOOT) {
  const cls = killLootClass(foe);
  const base = tuning[cls];
  const first = cls === 'boss' && !!(foe && foe.firstKill);
  const fk = tuning.firstKill;
  return {
    firstKill: first,
    picks:   first ? Math.max(1, Math.round(base.picks * fk.lootMult)) : base.picks,
    noDrop:  first ? base.noDrop * fk.noDropMult : base.noDrop,
    quality: first ? base.quality + fk.qualityBonus : base.quality,
  };
}
