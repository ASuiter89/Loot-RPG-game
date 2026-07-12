// Low-HP heartbeat — the pure brain behind the thump you hear when the hero is
// near death, synced to the existing red danger halo (the DOM #low-hp-vignette).
// No canvas, no audio, no game globals, no RNG: it turns the hero's HP fraction +
// a clock into a danger intensity and a heartbeat cadence, so the feel stays
// deterministic and unit-testable while the sfx / halo drawing live at the edge
// (src/legacy/game.js).
//
// The heartbeat engages at the SAME HP fraction as the danger halo (this module is
// now the single source of truth for that threshold) and races as HP falls: the
// interval between thumps shortens from a slow, ominous thud toward a panicked
// flutter as death nears.

// Below this fraction of max HP the danger feedback engages; at/above it, nothing.
// This is also the low-HP danger halo's trigger (activeHalos() reads it), so the
// heartbeat and the red glow always agree.
export const DANGER_HP_FRAC = 0.25;
// Milliseconds between heartbeat thumps at the edge of danger (danger≈0, ~25% HP)
// vs. death's door (danger=1). A slow ~1s thud that quickens toward a fast flutter.
const BEAT_MS_CALM = 1000;
const BEAT_MS_PANIC = 450;

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

// Danger intensity 0..1 from current/max HP. 0 when HP is unknown/non-positive
// (dead — the death flow owns the screen then) or at/above DANGER_HP_FRAC; ramps
// linearly to 1 as HP approaches 0.
export function dangerLevel(hp, maxHp) {
  if (!(maxHp > 0) || !(hp > 0)) return 0;
  const frac = hp / maxHp;
  if (frac >= DANGER_HP_FRAC) return 0;
  return clamp01((DANGER_HP_FRAC - frac) / DANGER_HP_FRAC);
}

// Milliseconds between heartbeat thumps at the given danger — shortens toward
// BEAT_MS_PANIC as danger rises so the pulse races near death.
export function beatIntervalMs(danger) {
  const d = clamp01(danger);
  return BEAT_MS_CALM + (BEAT_MS_PANIC - BEAT_MS_CALM) * d;
}

// Whether a heartbeat thump is due right now: true when in danger and at least a
// full (danger-scaled) beat interval has passed since the last one. The edge holds
// `lastBeatAt` on the animation clock and, when this returns true, plays the thump
// and records `nowMs`. A large gap (just entered danger, or the clock jumped)
// fires immediately, so dropping into the red always thumps at once.
export function heartbeatDue(danger, nowMs, lastBeatAt) {
  if (clamp01(danger) <= 0) return false;
  return (nowMs - (lastBeatAt || 0)) >= beatIntervalMs(danger);
}
