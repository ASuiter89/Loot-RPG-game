// Life & Mana Leech — heal / restore a share of the damage you deal. Leech is
// MARTIAL sustain: it pays out from physical attacks and weapon-based skills, but
// never from spell damage. Pure helpers so the rule stays unit-testable.

// Whether an active skill's cast can leech: only a cast that swings your weapon
// (cast.wpn) deals physical damage. A spell cast (cast.spell, no cast.wpn) never
// leeches, and a pure buff/summon/heal (no wpn, no spell) has nothing to leech.
export function castLeeches(cast) {
  return !!(cast && cast.wpn);
}

// The health/mana recovered by leeching `frac` of `damage`, floored at 1 (when any
// leech is owed) and capped. Returns 0 when there's no damage, no leech, or no cap.
export function leechAmount(damage, frac, cap) {
  if (damage <= 0 || frac <= 0 || cap <= 0) return 0;
  return Math.min(Math.max(1, Math.round(damage * frac)), cap);
}
