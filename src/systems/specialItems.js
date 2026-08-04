// ── SPECIAL-ITEM ROLL MATH ──
// Which special kind a drop carries and how hard each one bends its own axis. Kept
// pure (rng injected) so every rate and swing is unit-testable, and so the generator
// in the shell only has to APPLY what these decide.
//
// The kinds and their tuning live in src/data/specialItems.js; the cursed kind's own
// swing/penalty math stays in src/systems/curseRoll.js, which predates this module.

import {
  SPECIAL_ITEM_KINDS,
  FORTUNE_STATS,
  FORTUNE_TIER_MULT,
  DEEPFORGE_ILVL,
  STORIED_EXTRA_STATS,
} from '../data/specialItems.js';

// Declaration order is roll order — stable, so a seeded rng gives a stable result.
export const SPECIAL_KIND_KEYS = Object.keys(SPECIAL_ITEM_KINDS);

// The tuning row for a kind, or null for anything that isn't one.
export function specialItemDef(kind) { return SPECIAL_ITEM_KINDS[kind] || null; }

// Total chance (in percent) that an eligible drop rolls a special, given which kinds
// are on the table. Every kind keeps its own ABSOLUTE rate — an ineligible kind is
// simply dropped rather than re-weighted onto the others — so a slot that can't roll
// Fortunate ends up slightly less special overall instead of quietly over-cursed.
export function specialChancePct(kinds = SPECIAL_KIND_KEYS) {
  return (kinds || []).reduce((sum, k) => sum + ((SPECIAL_ITEM_KINDS[k] || {}).weight || 0), 0);
}

// The finder stats a slot's affix pool actually allows — the eligibility test for
// Fortunate. Weapons, gloves and off-hands carry neither Gold nor Magic Find, so a
// fortunate roll there would have nowhere to land.
export function fortuneStats(pool) {
  const p = new Set(pool || []);
  return FORTUNE_STATS.filter(s => p.has(s));
}

// Which kinds this item can roll, given its slot's stat pool. Cursed / deepforged /
// storied fit any gear; fortunate needs a finder stat to boost.
export function eligibleSpecialKinds(pool) {
  const hasFinder = fortuneStats(pool).length > 0;
  return SPECIAL_KIND_KEYS.filter(k => k !== 'fortunate' || hasFinder);
}

// Roll which special kind a drop carries, or null for a plain item. `rng` returns
// [0,1); the weights are read as percentage points, so their sum is the special rate.
export function rollSpecialKind(rng, kinds = SPECIAL_KIND_KEYS) {
  const allowed = new Set(kinds || []);
  const r = (typeof rng === 'function' ? rng() : 1) * 100;
  let acc = 0;
  for (const k of SPECIAL_KIND_KEYS) {
    if (!allowed.has(k)) continue;
    acc += (SPECIAL_ITEM_KINDS[k] || {}).weight || 0;
    if (r < acc) return k;
  }
  return null;
}

// ── FORTUNATE ──
// The fortune multiplier for a tier (falls back to the gentlest tier — only
// uncommon..legendary can ever roll a special).
export function fortuneTierMult(tier) {
  return FORTUNE_TIER_MULT[tier] || FORTUNE_TIER_MULT.uncommon;
}

// What a fortunate roll puts on its finder stat: a FULL normal roll plus a
// rarity-scaled multiple of that stat's own ceiling on top. Sized relative to the
// stat (like a curse swing), so it's big for whatever it lands on and never out of
// proportion — and always strictly better than the best ordinary roll.
export function fortuneStatValue(normalMax, fortuneMult) {
  const nm = Math.max(0, normalMax);
  return Math.round(nm) + Math.max(1, Math.round(nm * fortuneMult));
}

// ── DEEPFORGED ──
// The item level a deepforged piece rolls at: its own, plus a percentage of itself
// (floored at a flat minimum so shallow drops still jump). Everything — headline,
// affixes, gold worth AND the equip requirement — is then generated at this level, so
// the piece reads like one found far deeper and gates like one too.
export function deepforgeIlvl(lvl) {
  const lv = Math.max(1, Math.round(lvl) || 1);
  return lv + Math.max(DEEPFORGE_ILVL.min, Math.round(lv * DEEPFORGE_ILVL.pct));
}

// ── STORIED ──
// How many stat affixes a storied piece rolls: its rarity's FULL cap plus the extra.
// Deliberately not a random count — "storied" must always read richer than its colour,
// so it skips the usual roll-up-to-the-cap that can come out sparse.
export function storiedStatCount(cap) {
  return Math.max(0, Math.round(cap) || 0) + STORIED_EXTRA_STATS;
}
