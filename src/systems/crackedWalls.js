// Cracked walls — the breakable wall segments the hero shoves through. They stay
// solid terrain until smashed, but no longer shatter in a single blow: each shove
// chips one further and it only collapses after MAX_CRACK_HITS, so it half-blocks
// the way until you keep at it. Pure helpers live here (deterministic, testable);
// the legacy monolith owns the mutable per-tile hit map, the render and the
// audio/particle effects, and paces successive shoves with SMASH_COOLDOWN.

// How many shoves a cracked wall soaks before it collapses.
export const MAX_CRACK_HITS = 3;

// Seconds between successive shoves landing. Holding into a wall then breaks it
// over roughly a second of pressing — a "smash · smash · crumble" cadence — rather
// than instantly draining all its hits in three consecutive frames.
export const SMASH_COOLDOWN = 0.3;

// Apply one shove to a wall that has already taken `prevHits` blows. Returns the
// new running hit total and whether this blow is the one that brings it down.
export function applyCrackHit(prevHits, maxHits = MAX_CRACK_HITS) {
  const hits = Math.max(0, (prevHits | 0)) + 1;
  return { hits, broken: hits >= maxHits };
}

// The damage stage to draw: 0 (freshly cracked, untouched) up to maxHits-1 (barely
// holding). A wall never renders at maxHits — that blow is the one that collapses
// it — so the stages span 0..maxHits-1.
export function crackStage(hits, maxHits = MAX_CRACK_HITS) {
  const h = Math.max(0, (hits | 0));
  return Math.min(h, maxHits - 1);
}

// Normalised damage 0..1 across the visible stages, for scaling how dark/spread/
// glowing the fracture reads in the renderer. Fresh → 0, about-to-give → 1.
export function crackSeverity(hits, maxHits = MAX_CRACK_HITS) {
  if (maxHits <= 1) return 0;
  return crackStage(hits, maxHits) / (maxHits - 1);
}
