// Season enemy-affix resolvers — turn the affix key a Cycle's headline rule names
// into the number the shell applies at one call site. Pure: a key (and a base value)
// in, a number out. An unknown/absent key always resolves to the NEUTRAL value, so
// every call site can read a knob unconditionally.
import { SEASON_AFFIXES } from '../data/seasonAffixes.js';

function num(v, fallback) {
  // Deliberately strict: `Number(null)` and `Number('')` are 0, which would quietly
  // read an ABSENT knob as a real zero. Only an actual finite number counts.
  return (typeof v === 'number' && Number.isFinite(v)) ? v : fallback;
}

// The def a key names, or null. Handy for the enemy card / season panel copy.
export function seasonAffixDef(key, data = SEASON_AFFIXES) {
  const t = (data && typeof data === 'object') ? data : SEASON_AFFIXES;
  return (key && t[key]) || null;
}

// Attack-SPEED multiplier for a season affix (1 = unchanged). The shell divides the
// foe's attack interval by this, so >1 means faster swings.
export function seasonAtkSpeedMult(key, data = SEASON_AFFIXES) {
  const d = seasonAffixDef(key, data);
  return Math.max(0.1, num(d && d.atkSpeedMult, 1));
}

// Extra physical-armor FRACTION a season affix grants every foe (0 = unchanged).
// Clamped to a sane band so a bad tuning value can never make a foe untouchable.
export function seasonArmorAdd(key, data = SEASON_AFFIXES) {
  const d = seasonAffixDef(key, data);
  return Math.min(0.5, Math.max(0, num(d && d.armorAdd, 0)));
}

// Tiles from the corpse a death burst reaches (0 = this affix has no burst).
export function seasonBurstRadius(key, data = SEASON_AFFIXES) {
  const d = seasonAffixDef(key, data);
  return Math.max(0, num(d && d.burstRadius, 0));
}

/**
 * Damage one death burst deals: a share of the foe's OWN hit, capped at a share of
 * the hero's max HP so a deep-floor brute (or a boss) can never turn its corpse into
 * a one-shot. Returns 0 when the affix has no burst or the numbers are garbage.
 * @param {string} key      season affix key
 * @param {number} enemyDmg the foe's own damage stat
 * @param {number} maxHp    the hero's max HP (the cap is a share of it)
 */
export function seasonBurstDamage(key, enemyDmg, maxHp, data = SEASON_AFFIXES) {
  const d = seasonAffixDef(key, data);
  if (!d || !(num(d.burstRadius, 0) > 0)) return 0;
  const raw = Math.max(0, num(enemyDmg, 0)) * Math.max(0, num(d.burstDmgFrac, 0));
  if (!(raw > 0)) return 0;
  const cap = Math.max(0, num(maxHp, 0)) * Math.max(0, num(d.burstCapFrac, 1));
  return Math.max(1, Math.round(cap > 0 ? Math.min(raw, cap) : raw));
}
