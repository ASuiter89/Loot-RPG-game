// Critical-hit resolution — shared by every damage source so a crit can land on
// an auto-attack, a martial skill, or a spell alike. Pure: the caller injects the
// RNG roll (0..1) and the contested crit chance; production passes Math.random(),
// tests pass a fixed number.

// A hit is critical if it is FORCED (a guaranteed-crit skill like Backstab, or a
// primed "next hit crits") or the injected roll falls under the crit chance.
export function isCritical(roll, chance, forced = false) {
  return !!forced || roll < chance;
}
