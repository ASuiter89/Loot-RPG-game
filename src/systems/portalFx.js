// Town-portal teleport animation — pure timing/easing math.
//
// The town gate no longer flashes an icon over the hero. Instead the channel is a
// building blue CHARGING aura, and when it finishes the hero fades out and rockets
// up a beam of light off the map (departure); returning to the dungeon plays it in
// reverse — a pillar stabs into the map and the hero materializes (arrival). The
// canvas keeps drawing the dungeon floor for the whole transition so the effect is
// actually visible before we cut to town / hand control back.
//
// This module is the pure envelope behind those animations: no canvas, no game
// globals — a caller in the render/loop layer feeds in the elapsed time and gets
// back the beam brightness, hero opacity and lift for that instant, so the shapes
// stay deterministic and unit-testable while the drawing itself stays at the edge.

// How long each half of the round trip plays, in milliseconds. The world is frozen
// for this whole window (hero can't move or be hit — see the loop's rtPaused gate),
// so keep it brief: long enough to read as a teleport, short enough not to stall.
export const PORTAL_FX = { OUT_MS: 850, IN_MS: 850 };

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeIn = t => t * t;               // slow start, quick finish
const easeOut = t => 1 - (1 - t) * (1 - t); // quick start, gentle finish

// Charging-aura intensity while the town portal channels: 0 the instant it starts,
// climbing to 1 as it completes. `charge` is the seconds LEFT, `total` the full
// channel length. The aura swells and spins faster as this approaches 1.
export function chargeProgress(charge, total) {
  if (!(total > 0)) return 1;
  return clamp01(1 - charge / total);
}

// DEPARTURE frame (hero → town). A blue beam erupts fast and holds while the hero
// clings on, then in the back half the hero rips away — a rapid fade paired with an
// upward launch — and the beam recedes at the very end so the cut to town is soft.
//   p          progress through the animation, 0 → 1
//   beam       column brightness / length, 0 → 1 (rises, holds, then falls)
//   heroAlpha  hero opacity, 1 → 0 (fades late and fast)
//   heroLift   upward launch fraction, 0 → 1 (render scales this to pixels)
//   glow       ground-glow brightness at the hero's feet, 0 → 1
export function departFrame(p) {
  p = clamp01(p);
  const rise = easeOut(clamp01(p / 0.35));            // beam stabs up to full by 35%
  const fall = easeIn(clamp01((p - 0.82) / 0.18));    // then recedes over the last 18%
  const launch = clamp01((p - 0.3) / 0.7);            // hero starts leaving at 30%
  return {
    beam: rise * (1 - fall),
    heroAlpha: 1 - easeIn(launch),
    heroLift: easeIn(launch),
    glow: rise * (1 - 0.6 * fall),
  };
}

// ARRIVAL frame (town → dungeon) — the reverse read: a pillar stabs into the map
// fast, then recedes as the hero solidifies out of it, dropping the last of the way
// into place.
//   heroAlpha  hero opacity, 0 → 1 (fades in once the pillar has landed)
//   heroLift   still lifted at the start, settling to 0 as it materializes
export function arriveFrame(p) {
  p = clamp01(p);
  const rise = easeOut(clamp01(p / 0.28));            // pillar stabs in fast
  const fall = easeIn(clamp01((p - 0.5) / 0.5));      // recedes as the hero solidifies
  const solid = clamp01((p - 0.28) / 0.62);           // hero fades in after it lands
  return {
    beam: rise * (1 - fall),
    heroAlpha: easeOut(solid),
    heroLift: 1 - easeOut(solid),
    glow: rise * (1 - 0.5 * fall),
  };
}

// Dispatch to the right envelope for a running transition. `dir` is 'out' (to town)
// or 'in' (back to the dungeon); returns the {beam,heroAlpha,heroLift,glow} frame.
export function portalFrame(dir, elapsedMs, durMs) {
  const p = durMs > 0 ? elapsedMs / durMs : 1;
  return dir === 'in' ? arriveFrame(p) : departFrame(p);
}

// Whether a transition that started `elapsedMs` ago has run its full `durMs`.
export function portalDone(elapsedMs, durMs) { return elapsedMs >= durMs; }
