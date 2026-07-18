// ── EARLY-GAME TRAINING WHEELS ──────────────────────────────────────────────
// On the beach tutorial and the opening dungeon floors, combat is deliberately
// slowed so a brand-new player trades a few real blows with each foe instead of
// one-shotting trash: no single hit may fell an enemy in fewer than MIN_EARLY_HITS
// blows. Pure math — the caller injects the floor context (current depth + whether
// the beach tutorial is running) and the foe's max HP; nothing here touches state.

// Every foe on a covered floor must survive its first (MIN_EARLY_HITS - 1) blows,
// so it always takes MIN_EARLY_HITS or more hits to kill.
export const MIN_EARLY_HITS = 3;

// The rule covers dungeon floors 1..EARLY_HIT_FLOORS. The beach tutorial shares
// floor 1's depth number but is gated on its own flag, independent of this.
export const EARLY_HIT_FLOORS = 3;

// Whether the min-hits rule applies right now: on the beach tutorial, or on the
// first EARLY_HIT_FLOORS dungeon floors.
export function earlyHitCapActive(dungeonLevel, tutorialActive) {
  return !!tutorialActive || (dungeonLevel >= 1 && dungeonLevel <= EARLY_HIT_FLOORS);
}

// The most damage a single blow may deal to a foe of `maxHp` while still leaving
// it alive through its first (minHits - 1) blows — so the foe can never fall in
// fewer than `minHits` hits. Derived as floor((maxHp - 1) / (minHits - 1)):
// (minHits - 1) such blows total at most maxHp - 1 < maxHp, a hard guarantee for
// any maxHp >= minHits (every early foe carries far more). Never below 1.
export function earlyHitDamageCap(maxHp, minHits = MIN_EARLY_HITS) {
  const hp = Math.max(1, Math.round(maxHp || 0));
  const hits = Math.max(2, Math.round(minHits));
  return Math.max(1, Math.floor((hp - 1) / (hits - 1)));
}

// Clamp a single blow's damage to the early-game cap when the rule is active on
// this floor; otherwise pass it through unchanged. The one call site logic used
// by both the melee swing and the universal dealDamage chokepoint.
export function capEarlyHit(dmg, maxHp, dungeonLevel, tutorialActive, minHits = MIN_EARLY_HITS) {
  if (!earlyHitCapActive(dungeonLevel, tutorialActive)) return dmg;
  return Math.min(dmg, earlyHitDamageCap(maxHp, minHits));
}
