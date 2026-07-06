// Base weapon cadence — pure, no globals/RNG/clock/DOM. The hero's swing
// interval before any Attack Speed or Agility haste is a baseline (seconds) times
// the weapon style's cadence multiplier (PLAYER_ATK_BASE × STYLE_ATK_MULT in the
// combat layer). This module turns that pair into a legible "attacks per second"
// plus a coarse Slow / Normal / Fast tier, so a weapon's inherent speed reads in
// tooltips and the Forge WITHOUT equipping it. Numbers in, numbers/label out.

// Coarse speed tiers keyed off base attacks/sec, ordered high → low. Boundaries
// are chosen so the shipped weapon styles land intuitively: flurry (dagger /
// shortsword / hatchet) reads Fast, the 1H melee & ranged middle reads Normal,
// and the two-handers + casters read Slow. Adjust here if the style multipliers
// move so the labels keep matching the feel.
export const SPEED_TIERS = [
  { min: 0.75, label: 'Fast' },
  { min: 0.60, label: 'Normal' },
  { min: 0, label: 'Slow' },
];

// Base attacks per second for a style: the reciprocal of (baseline interval ×
// the style's cadence multiplier). A larger multiplier means a slower swing and
// fewer attacks/sec. A non-positive multiplier or interval falls back to 1 so a
// bad lookup can never divide by zero.
export function baseAttacksPerSec(styleMult, baseInterval) {
  const m = styleMult > 0 ? styleMult : 1;
  const s = baseInterval > 0 ? baseInterval : 1;
  return 1 / (s * m);
}

// The coarse tier label for a base attacks/sec value (first tier whose floor it
// clears, high → low; the last tier's floor is 0 so any non-negative value maps).
export function speedTier(aps) {
  for (const t of SPEED_TIERS) if (aps >= t.min) return t.label;
  return SPEED_TIERS[SPEED_TIERS.length - 1].label;
}

// { aps, tier } for a style multiplier + baseline interval — the one call the
// tooltip / Forge helper needs.
export function weaponSpeedInfo(styleMult, baseInterval) {
  const aps = baseAttacksPerSec(styleMult, baseInterval);
  return { aps, tier: speedTier(aps) };
}
