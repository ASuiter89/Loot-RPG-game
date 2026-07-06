// ── Glyph rolling — pure, deterministic (systems layer) ──────────────────────
//
// Turns "the hero found a glyph at Endless depth D" into a concrete glyph object,
// using ONLY an injected rng (() => number in [0,1)) so a seeded mulberry32 stream
// reproduces the exact drop (leaderboard-auditable, like the rest of the loot). No
// globals, no Math.random, no clock, no DOM. Tuning is src/data/glyphs.js, passed as
// the last parameter so tests can inject their own bands/gates.
//
// A rolled glyph is what the board sockets consume — see
// src/systems/ascendantWeave.js ▸ weaveStatContribution, which reads glyphPower().
import { GLYPHS } from '../data/glyphs.js';

// Safe rng read: a non-function (corrupt caller) degrades to a fixed 0 rather than
// throwing, so a bad drop can never crash a run.
function roll(rng) {
  return (typeof rng === 'function') ? rng() : 0;
}

// Round to 4 decimals — keeps rolled values tidy without leaking float noise into
// saves or the UI.
function round4(n) {
  return Math.round(n * 10000) / 10000;
}

/**
 * The multiplier a glyph applies to each node it covers: ×(1 + value). A missing /
 * malformed glyph is a no-op (×1), so an empty or corrupt socket changes nothing.
 * This is the single source of truth for "how strong is a glyph" — the board math
 * imports it rather than re-deriving the formula.
 * @param {{value?:number}} glyph
 * @returns {number} multiplier ≥ 1 (clamped: a negative rolled value can't shrink a node)
 */
export function glyphPower(glyph) {
  const v = glyph && typeof glyph.value === 'number' && isFinite(glyph.value) ? glyph.value : 0;
  return 1 + Math.max(0, v);
}

/**
 * Roll a glyph for a drop at the given Endless depth. Picks the HIGHEST tier whose
 * depth gate is unlocked by `endlessDepth`, then rolls a value in that tier's band
 * and one tertiary rider. Draws from the rng in a FIXED order (value → tertiary →
 * id) so the same seed + depth always yields the same glyph.
 *
 * @param {() => number} rng injected rng
 * @param {number} endlessDepth the run's Endless depth (floored, clamped ≥ 0)
 * @param {typeof GLYPHS} data tuning table (last param, defaulted for production)
 * @returns {{id:string, tier:number, name:string, color:string, tertiary:string, value:number, radius:number}}
 */
export function rollGlyph(rng, endlessDepth, data = GLYPHS) {
  const tiers = Array.isArray(data && data.tiers) ? data.tiers : [];
  const gates = Array.isArray(data && data.depthGates) ? data.depthGates : [];
  const riders = Array.isArray(data && data.tertiaryBonuses) ? data.tertiaryBonuses : [];

  // Depth as a clean, non-negative integer. Garbage (NaN/negative/fractional) floors
  // to the entry tier rather than throwing.
  const depth = Math.max(0, Math.floor(Number(endlessDepth) || 0));

  // Highest tier whose gate is satisfied by the current depth. We scan the gates,
  // keep the deepest-unlocked one, and fall back to the lowest tier that exists if
  // (somehow) nothing is unlocked, so a glyph is ALWAYS produced.
  let bestTier = null;
  let bestGate = -Infinity;
  for (const g of gates) {
    const need = Math.max(0, Math.floor(Number(g && g.minEndlessDepth) || 0));
    if (need <= depth && need >= bestGate) {
      bestGate = need;
      bestTier = g.tier;
    }
  }

  // Resolve the tier definition; fall back defensively to the first tier.
  let tierDef = tiers.find((t) => t && t.tier === bestTier);
  if (!tierDef) tierDef = tiers[0];
  // Absolute last resort if the tuning table is empty — a harmless no-op glyph.
  if (!tierDef) {
    return { id: 'glyph_0_0', tier: 0, name: 'Blank Glyph', color: '#000000', tertiary: '', value: 0, radius: 0 };
  }

  // 1) Value within the tier's band (min == max degenerates to a fixed value).
  const band = tierDef.valueBand || { min: 0, max: 0 };
  const lo = Number(band.min) || 0;
  const hi = Number(band.max) || 0;
  const span = Math.max(0, hi - lo);
  const value = round4(lo + roll(rng) * span);

  // 2) One tertiary rider, uniformly. Empty rider list → no rider.
  const rider = riders.length ? riders[Math.min(riders.length - 1, Math.floor(roll(rng) * riders.length))] : null;
  const tertiary = rider ? rider.key : '';

  // 3) A deterministic id: tier + a base-36 suffix drawn from the rng, so two glyphs
  // rolled off different stream positions get distinct, save-stable ids without any
  // clock or Math.random.
  const suffix = Math.floor(roll(rng) * 0x7fffffff).toString(36);
  const id = `glyph_${tierDef.tier}_${suffix}`;

  return {
    id,
    tier: tierDef.tier,
    name: tierDef.name,
    color: tierDef.color,
    tertiary,
    value,
    radius: tierDef.radius,
  };
}
