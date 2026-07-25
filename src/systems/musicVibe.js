// ── Music-vibe selection ── which generative styles the soundtrack is allowed to
// play. The player picks any MIX of styles in Settings ▸ Audio (a multi-select),
// or leaves every style enabled to shuffle through them all. Pure logic over an
// injected rng — no audio, DOM, storage or Math.random here. The live wiring lives
// in src/legacy/game.js; the styles themselves in src/data/musicSections.js.

// The stored form of "every style" (shuffle all). An empty selection, or one that
// covers the whole set, normalises back to this.
export const VIBE_ALL = 'auto';

// Normalise a selection into a sorted, de-duped array of valid style indices.
// Accepts the stored string ('auto' | '3' | '3,5,9'), an array of indices/strings,
// or null/undefined. Indices outside [0,count) are dropped; selecting every style
// (or none) collapses to [] — i.e. "all styles allowed" (shuffle). Back-compat: an
// old single-lock value like '3' parses to [3].
export function parseVibe(selected, count) {
  const seen = new Set();
  const add = (v) => {
    const i = typeof v === 'number' ? v : parseInt(v, 10);
    if (Number.isInteger(i) && i >= 0 && i < count) seen.add(i);
  };
  if (Array.isArray(selected)) {
    selected.forEach(add);
  } else if (selected != null && selected !== VIBE_ALL) {
    String(selected).split(',').forEach(add);
  }
  if (seen.size === 0 || seen.size >= count) return [];
  return [...seen].sort((a, b) => a - b);
}

// Serialise a selection back to its stored string. Empty / full set → 'auto';
// otherwise a sorted comma list ('3' | '3,5,9').
export function serializeVibe(selected, count) {
  const set = parseVibe(selected, count);
  return set.length ? set.join(',') : VIBE_ALL;
}

// Toggle one style in or out of the selection, returning a NEW sorted index array.
// Toggling an out-of-range index is a no-op.
export function toggleVibe(selected, idx, count) {
  const set = new Set(parseVibe(selected, count));
  if (Number.isInteger(idx) && idx >= 0 && idx < count) {
    if (set.has(idx)) set.delete(idx); else set.add(idx);
  }
  return [...set].sort((a, b) => a - b);
}

// Pick the next style to play from the allowed pool, given rng() in [0,1). The pool
// is the selection, or every style when the selection is "all". `avoid` (optional)
// is skipped when the pool still leaves another choice — so a shuffle never repeats
// a style back-to-back — but is returned unchanged when it's the ONLY allowed style
// (a single locked vibe), letting the caller decide to hold or force a detour.
export function pickVibeSection(selected, count, rng, avoid) {
  const pool = parseVibe(selected, count);
  const all = pool.length ? pool : Array.from({ length: count }, (_, i) => i);
  let choices = all;
  if (avoid != null && all.length > 1) {
    const trimmed = all.filter(i => i !== avoid);
    if (trimmed.length) choices = trimmed;
  }
  return choices[Math.floor(rng() * choices.length)];
}

// Pick the style a fresh run opens on. On shuffle-all this favours a bright, upbeat
// "happy" style; with a selection it favours a happy style WITHIN the selection,
// falling back to any selected style (or any style at all) when none is picked.
// `happy` is the list of happy-style indices.
export function pickStartSection(selected, count, happy, rng) {
  const pool = parseVibe(selected, count);
  const happyValid = (happy || []).filter(i => Number.isInteger(i) && i >= 0 && i < count);
  let from;
  if (pool.length) {
    const happyInPool = happyValid.filter(i => pool.includes(i));
    from = happyInPool.length ? happyInPool : pool;
  } else {
    from = happyValid.length ? happyValid : Array.from({ length: count }, (_, i) => i);
  }
  return from[Math.floor(rng() * from.length)];
}
