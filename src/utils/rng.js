// Injectable RNG — the seam that makes game logic deterministic and testable.
//
// The legacy game calls `Math.random()` and a global `rnd(lo,hi)` inline in ~160
// places, which makes combat, loot and map generation impossible to test
// reproducibly. The refactor's rule (see CLAUDE.md ▸ "side effects at the edges")
// is that extracted logic takes an `rng` function as a parameter instead of
// reaching for `Math.random` directly.
//
// An `Rng` here is simply a function `() => number` returning a float in [0, 1),
// exactly like `Math.random`. `sysRandom` is the production default; `mulberry32`
// gives a seeded, reproducible stream for tests. The helper functions
// (`rndInt`, `pick`, `chance`, `shuffle`) mirror the shapes the game already
// uses so extracted code reads the same, just with `rng` threaded through.

/** The production RNG: delegates to the platform PRNG. */
export const sysRandom = () => Math.random();

/**
 * mulberry32 — a tiny, fast, well-distributed seeded PRNG.
 * Returns a stateful `Rng` closure: each call advances the stream.
 * @param {number} seed - any 32-bit integer seed.
 * @returns {() => number} an rng function producing floats in [0, 1).
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Integer in [lo, hi] inclusive — mirrors the legacy global `rnd(lo, hi)`.
 * @param {() => number} rng
 * @param {number} lo
 * @param {number} hi
 */
export function rndInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/**
 * Float in [lo, hi).
 * @param {() => number} rng
 * @param {number} lo
 * @param {number} hi
 */
export function rndFloat(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

/**
 * Uniformly pick one element of a non-empty array.
 * @template T
 * @param {() => number} rng
 * @param {T[]} arr
 * @returns {T}
 */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * True with probability p (0..1). `chance(rng, 0)` is always false,
 * `chance(rng, 1)` is always true.
 * @param {() => number} rng
 * @param {number} p
 */
export function chance(rng, p) {
  return rng() < p;
}

/**
 * Fisher–Yates shuffle. Returns a NEW array; does not mutate the input.
 * @template T
 * @param {() => number} rng
 * @param {T[]} arr
 * @returns {T[]}
 */
export function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
