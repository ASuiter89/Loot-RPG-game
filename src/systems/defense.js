// Typed damage mitigation — physical armor vs magic resistance. A foe shrugs off a
// slice of every blow; how big that slice is depends on the damage SCHOOL. Physical
// armor blunts weapon attacks and martial skills; magic resistance blunts spells.
// A hybrid strike is mitigated in two parts — its weapon half by armor, its magic
// half by resistance. Pure helpers so the split stays unit-testable; the live enemy
// state and gear stats stay in the shell.

// The mitigation fraction (0..cap) a foe applies to one school: its depth-scaled base
// armor reshaped by that foe's per-school multiplier. mult > 1 = tougher against that
// school, < 1 = softer. Clamped so nothing is ever fully immune.
export function resistFraction(baseArmor, mult = 1, cap = 0.6) {
  const r = Math.max(0, baseArmor) * Math.max(0, mult);
  return Math.min(cap, Math.max(0, r));
}

// Fraction of a foe's resistance that PENETRATION ignores. Asymptotic, never reaches 1:
// raw pen p feeds p/(p+scale), so each point helps a little less than the last and a
// foe is never wholly stripped. Shared by Armor Pen (physical) and Magic Pen (spell).
export function penFraction(pen, scale = 0.5) {
  const p = Math.max(0, pen);
  return p / (p + scale);
}

// Apply a resistance (already the mitigation fraction) with penetration to a damage
// number: dmg * (1 - resist*(1-pen)). Returns dmg unchanged when resist <= 0.
export function mitigate(dmg, resist, pen = 0) {
  if (!(resist > 0)) return dmg;
  const p = Math.min(1, Math.max(0, pen));
  return dmg * (1 - resist * (1 - p));
}

// The physical SHARE of a hybrid strike's total — the slice that may leech life.
// A pure weapon skill returns 1 (all of it leeches); a pure spell's caller never asks.
// Guards against a zero total.
export function physicalShare(physDamage, totalDamage) {
  if (!(totalDamage > 0)) return 0;
  return Math.min(1, Math.max(0, physDamage / totalDamage));
}
