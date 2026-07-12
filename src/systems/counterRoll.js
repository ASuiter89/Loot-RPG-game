// Rolling counters — the pure easing behind HUD numbers that "count up" to a new
// value instead of snapping (gold gained, the XP bar filling). No DOM, no globals,
// no clock of its own: given the currently-shown value, the real target, and the
// elapsed dt, it returns the next shown value, so the motion is deterministic and
// unit-testable while the DOM writes stay at the edge (src/legacy/game.js).
//
// The curve is an exponential ease toward the target (a big early step that settles)
// with an absolute floor so a small gap still closes promptly rather than crawling
// asymptotically forever, and an exact landing once a step would reach/overshoot —
// so the shown value always arrives at the target and stops.

// Move `shown` toward `target` by one frame of `dt` seconds.
//  - rate:      exponential responsiveness per second (higher = snappier).
//  - minPerSec: an absolute floor on speed (units/sec) so tiny gaps still finish.
// Returns `target` exactly when a step would reach or pass it; returns `shown`
// unchanged when no time has passed or it is already there.
export function rollTo(shown, target, dt, { rate = 9, minPerSec = 6 } = {}) {
  if (!(dt > 0)) return shown;          // no time elapsed → no motion
  if (shown === target) return target;
  const gap = target - shown;
  const mag = Math.abs(gap);
  // Exponential ease: close `rate`-worth of the remaining gap each second, frame-rate
  // independent (1 - e^(-rate·dt) is the fraction of the gap covered over dt).
  const eased = mag * (1 - Math.exp(-rate * dt));
  // Absolute floor so a 1-unit gap doesn't creep — whichever moves more wins.
  const move = Math.max(eased, minPerSec * dt);
  if (move >= mag) return target;       // would reach/overshoot → land exactly
  return shown + (gap < 0 ? -move : move);
}
