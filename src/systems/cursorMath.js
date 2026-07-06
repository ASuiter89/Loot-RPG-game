// Pure math for the custom mouse pointer (Settings → CURSOR).
//
// A cursor sprite is baked into an `out`×`out` canvas with the trimmed art
// filling a `dw`×`dh` box anchored at the top-left. The OS click hotspot is then
// placed at a point on that art. By default the hotspot is the sprite's up-left
// tip (0,0); an option can instead point it at the visible business end (a blade
// edge, an axe head, a spike) via a box-relative fraction so clicks land where
// the image says they should.

/**
 * Resolve a box-relative hotspot fraction to an integer pixel coordinate inside
 * the baked cursor canvas.
 *
 * @param {{x?:number,y?:number}|null|undefined} hot fractions in [0,1] of the
 *   drawn `dw`×`dh` box (0,0 = top-left tip). Missing/partial defaults to 0.
 * @param {number} dw drawn sprite width in px
 * @param {number} dh drawn sprite height in px
 * @param {number} out baked canvas size in px (hotspot must stay in [0, out-1])
 * @returns {{x:number,y:number}} integer hotspot, clamped to the canvas
 */
export function cursorHotspotPx(hot, dw, dh, out) {
  const cap = Math.max(0, (out | 0) - 1);
  const clamp = (v) => Math.max(0, Math.min(cap, Math.round(v)));
  const fx = hot && Number.isFinite(hot.x) ? hot.x : 0;
  const fy = hot && Number.isFinite(hot.y) ? hot.y : 0;
  return { x: clamp(fx * dw), y: clamp(fy * dh) };
}
