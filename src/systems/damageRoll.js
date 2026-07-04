// Fractional damage rolls. When a base damage RANGE is rolled — a weapon's min–max,
// or a spell's derived spread — the roll is a CONTINUOUS value kept to ~3 significant
// figures, so a small range doesn't collapse into a handful of discrete outcomes once
// gear/buff multipliers scale it up. (A 3–4 weapon under a 10× buff would only ever
// hit 30 or 40 if the roll were integer; rolling 3.45 first spreads it across 30…40.)
// Bigger rolls need no decimals — a 345 reads fine as a whole number, a 3.45 does not.
// Pure and deterministic: inject the rng (0..1); production passes Math.random, tests
// pass a fixed stream. The final damage the game applies is still rounded by the caller.

/**
 * Decimal places to keep for a rolled value so it shows ~3 significant figures:
 * 2 below 10 (3.45), 1 below 100 (30.5), 0 at 100+ (345, 3450 — whole numbers).
 * Keyed to the value's own magnitude, so a small roll stays granular and a big one
 * stays clean. Non-finite input is treated as 0 (→ 2 decimals, harmless).
 * @param {number} value
 * @returns {number} 0, 1 or 2
 */
export function rollDecimals(value) {
  const v = Math.abs(value) || 0;
  if (v < 10) return 2;
  if (v < 100) return 1;
  return 0;
}

/** Round `n` to `d` (≥0) decimal places. */
function roundTo(n, d) {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}

/**
 * Quantize a value to ~3 significant figures (see rollDecimals). Used to keep a rolled
 * base damage tidy before it flows into the multiplier chain.
 * @param {number} value
 * @returns {number}
 */
export function quantizeRoll(value) {
  if (!Number.isFinite(value)) return 0;
  return roundTo(value, rollDecimals(value));
}

/**
 * Roll a continuous value in [lo, hi] using an injected rng (a function returning
 * 0..1), quantized to ~3 significant figures. Endpoints may be given in either order;
 * a zero-width range returns that single value (quantized). Falls back to Math.random
 * when no rng is passed.
 * @param {number} lo
 * @param {number} hi
 * @param {() => number} [rng]
 * @returns {number}
 */
export function rollDamage(lo, hi, rng) {
  const a = Math.min(lo, hi), b = Math.max(lo, hi);
  const r = (typeof rng === 'function') ? rng() : Math.random();
  return quantizeRoll(a + r * (b - a));
}

/**
 * A spell's low–high damage range from its single "center" magnitude and a spread
 * fraction: [center·(1−spread), center·(1+spread)]. SYMMETRIC, so the average stays
 * `center` — a spell keeps its existing balance on average and only gains variance.
 * `spread` is clamped to [0, 0.95] (a full-width roll would let the low end hit ~0).
 * Endpoints are returned raw (not quantized) so callers can scale them further before
 * their own rounding; use rollDamage on these ends to actually roll one.
 * @param {number} center
 * @param {number} spread 0..0.95 fraction
 * @returns {[number, number]} [lo, hi]
 */
export function spreadRange(center, spread) {
  const s = Math.max(0, Math.min(0.95, spread || 0));
  return [center * (1 - s), center * (1 + s)];
}
