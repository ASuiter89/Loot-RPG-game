// Pure math for the on-screen touch joystick (see the mobile touch UI). No DOM,
// no globals, no clock/RNG — primitives in, numbers out — so the movement feel is
// unit-testable. The DOM/pointer wiring that calls these lives in the monolith
// (src/legacy/game.js), where the rest of the input handling already sits.
//
// The joystick is a floating/dynamic stick: an origin (where the thumb first
// pressed) and a live thumb point. The vector from origin→thumb, clamped to the
// knob radius and passed through a radial dead-zone, drives the hero the same way
// held WASD does (it feeds the ix/iy input vector in updatePlayer).

const DEFAULT_DEAD_ZONE = 0.12;   // fraction of the radius ignored around the origin
const DEFAULT_SPRINT_AT = 0.92;   // push past this (of full throw) to sprint

/**
 * Radial scaled dead-zone. Below `dead` the output is 0; above it the remaining
 * range is rescaled to [0,1] so there's no speed jump at the edge of the zone.
 * @param {number} raw normalized distance from origin, expected 0..1
 * @param {number} dead dead-zone fraction, 0..1
 * @returns {number} eased magnitude clamped to 0..1
 */
export function scaleDeadZone(raw, dead = DEFAULT_DEAD_ZONE) {
  const d = Math.min(0.99, Math.max(0, dead));
  const r = Math.min(1, Math.max(0, raw));
  if (r <= d) return 0;
  return (r - d) / (1 - d);
}

/**
 * The analog input vector for a floating joystick.
 *
 * @param {{x:number,y:number}} origin  where the stick was anchored (px)
 * @param {{x:number,y:number}} current live thumb position (px)
 * @param {number} radius  knob throw radius in px (full push distance)
 * @param {number} [deadZone] dead-zone fraction of the radius
 * @returns {{ix:number, iy:number, mag:number}} direction*magnitude and the
 *   scaled magnitude (0..1). Screen y grows downward, matching the game's iy
 *   (down = +1), so no axis flip is needed by callers.
 */
export function joystickVector(origin, current, radius, deadZone = DEFAULT_DEAD_ZONE) {
  if (!(radius > 0)) return { ix: 0, iy: 0, mag: 0 };
  const dx = current.x - origin.x;
  const dy = current.y - origin.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= 0) return { ix: 0, iy: 0, mag: 0 };
  const raw = Math.min(1, dist / radius);
  const mag = scaleDeadZone(raw, deadZone);
  if (mag <= 0) return { ix: 0, iy: 0, mag: 0 };
  // Unit direction, scaled by the eased magnitude.
  const ux = dx / dist, uy = dy / dist;
  return { ix: ux * mag, iy: uy * mag, mag };
}

/**
 * Whether the current push should engage a sprint (thumb near the rim).
 * @param {number} mag eased magnitude 0..1 (from joystickVector)
 * @param {number} [threshold] fraction of full throw to count as sprint
 */
export function sprintFromMagnitude(mag, threshold = DEFAULT_SPRINT_AT) {
  return mag >= threshold;
}

/**
 * Sliding origin: if the thumb has dragged farther than the knob radius, pull the
 * origin along behind it so it sits exactly `radius` from the thumb. This keeps a
 * far-drifting thumb producing a full-magnitude vector in the drag direction
 * (rather than pinning against a fixed origin), the modern floating-stick feel.
 * When the thumb is within the radius the origin is returned unchanged.
 *
 * @param {{x:number,y:number}} origin current anchor (px)
 * @param {{x:number,y:number}} current live thumb position (px)
 * @param {number} radius knob throw radius (px)
 * @returns {{x:number, y:number}} the (possibly moved) origin
 */
export function slideOrigin(origin, current, radius) {
  if (!(radius > 0)) return { x: origin.x, y: origin.y };
  const dx = current.x - origin.x;
  const dy = current.y - origin.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= radius) return { x: origin.x, y: origin.y };
  const k = (dist - radius) / dist;   // fraction of the gap to close
  return { x: origin.x + dx * k, y: origin.y + dy * k };
}

export const JOY_DEFAULTS = { deadZone: DEFAULT_DEAD_ZONE, sprintAt: DEFAULT_SPRINT_AT };
