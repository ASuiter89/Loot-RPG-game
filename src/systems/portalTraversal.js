// Map-portal traversal animation — pure timing/easing math.
//
// Stepping onto an in-level teleporter pad no longer snaps the hero across the
// floor. Instead the portal SWALLOWS the hero (they spin and shrink down into the
// swirl and wink out), the camera PANS across the floor to the partner pad, and
// the hero is SPAT BACK OUT of it (spinning and growing back to full size). It
// reads as physically walking THROUGH the portal — distinct from the town gate,
// which beams the hero straight up a column of light and off the map. The world
// is frozen for the whole window (rtPaused/clockPaused) so nothing can move or
// hit the hero mid-traversal.
//
// This module is the pure envelope behind that animation: no canvas, no game
// globals. A caller in the render/loop layer feeds in the elapsed time and reads
// back the phase, the camera-pan fraction, and the hero's scale / opacity / spin
// / swirl for that instant, so the shapes stay deterministic and unit-testable
// while the drawing itself stays at the edge.

// Total window in ms plus the two internal phase boundaries (as fractions of the
// total). The world is frozen for this whole window, so keep it brief: long
// enough to read as travelling between the pads, short enough not to stall.
//   absorb  [0, ABSORB]   hero at the SOURCE pad, spun down into the swirl
//   pan     (ABSORB, PAN] hero gone; camera glides across to the partner pad
//   emerge  (PAN, 1]      hero at the DEST pad, spun back up out of the swirl
// SPIN_TURNS is how many full rotations the hero whirls through as it's pulled in.
export const PORTAL_WARP = { DUR_MS: 900, ABSORB: 0.3, PAN: 0.64, SPIN_TURNS: 1.5 };

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeIn = t => t * t;                          // slow start, quick finish
const easeOut = t => 1 - (1 - t) * (1 - t);          // quick start, gentle finish
// Smooth acceleration then deceleration — used for the camera glide so it eases
// off both pads rather than lurching to a start/stop.
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) * (-2 * t + 2) / 2);
// Overshoot ease for the emerge "pop": swells briefly past 1 (~1.1) then settles
// back to exactly 1, so the hero springs out of the portal rather than just fading
// up. easeOutBack(0) === 0 and easeOutBack(1) === 1.
const BACK_C1 = 1.70158, BACK_C3 = BACK_C1 + 1;
const easeOutBack = t => { const u = t - 1; return 1 + BACK_C3 * u * u * u + BACK_C1 * u * u; };

// Sub-progress 0→1 within a phase spanning [a,b] of the overall run, clamped so a
// caller can read a phase's shape even slightly past its own window.
function within(p, a, b) { return b > a ? clamp01((p - a) / (b - a)) : 1; }

// The full frame for overall progress `p` (0→1). Returns:
//   phase      'absorb' | 'pan' | 'emerge'
//   panT       camera pan fraction, 0 (centred on SOURCE) → 1 (centred on DEST)
//   atDest     false while the hero is still at the SOURCE pad, true once it has
//              been swallowed (pan + emerge) — the render draws it at the dest pad
//   heroScale  size multiplier: 1 → 0 across absorb, then 0 → past 1 → 1 across
//              emerge (a brief overshoot "pop" as the hero springs out of the pad)
//   heroAlpha  opacity: 1 → 0 across absorb, 0 → 1 across emerge
//   spin       rotation in radians — winds UP to the peak as the hero is pulled in,
//              holds through the pan, then unwinds to 0 (upright) as it settles
//   swirl      portal-energy intensity at the hero's pad, 0 → 1 (absorb) → 0 (emerge)
export function warpFrame(p, spinTurns = PORTAL_WARP.SPIN_TURNS) {
  p = clamp01(p);
  const { ABSORB, PAN } = PORTAL_WARP;
  const spinMax = spinTurns * Math.PI * 2;
  if (p <= ABSORB) {
    const a = within(p, 0, ABSORB);
    return {
      phase: 'absorb', panT: 0, atDest: false,
      heroScale: 1 - easeIn(a),
      heroAlpha: 1 - easeIn(a),
      spin: easeIn(a) * spinMax,
      swirl: easeOut(a),
    };
  }
  if (p <= PAN) {
    const a = within(p, ABSORB, PAN);
    return {
      phase: 'pan', panT: easeInOut(a), atDest: true,
      heroScale: 0, heroAlpha: 0,
      spin: spinMax,
      swirl: 1,
    };
  }
  const a = within(p, PAN, 1);
  return {
    phase: 'emerge', panT: 1, atDest: true,
    heroScale: easeOutBack(a),          // springs out with a small overshoot, settles to 1
    heroAlpha: easeOut(a),
    spin: (1 - easeOut(a)) * spinMax,
    swirl: 1 - easeIn(a),
  };
}

// Whether a warp that started `elapsedMs` ago has run its full `durMs`.
export function warpDone(elapsedMs, durMs) { return elapsedMs >= durMs; }

// Dispatch to the frame for a running warp given elapsed ms and total ms.
export function warpFrameAt(elapsedMs, durMs, spinTurns) {
  const p = durMs > 0 ? elapsedMs / durMs : 1;
  return warpFrame(p, spinTurns);
}
