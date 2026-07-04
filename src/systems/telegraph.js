// ── TELEGRAPH ENGINE (pure geometry + timing) ────────────────────────────────
// The shared "floor indicator" system every boss attack is built from. A
// telegraph is a lethal zone that announces itself BEFORE it fires: it lives
// through three phases — WINDUP (indicator visible, no damage), ACTIVE (hitbox
// live, resolved once), DONE (expired) — so every attack is dodgeable by reading
// the shape and stepping out of it in time.
//
// This module is pure: all coordinates are in TILE units, timings are in SECONDS,
// and an instance carries its own `age` (advanced by the caller with the frame dt
// at the edge). No DOM, no rng, no clock — geometry and phase math only, so the
// dodge/hit rules are deterministic and unit-testable. Rendering (colour, fill
// animation) and damage live in the edge layers.

export const TELE_WINDUP = 'windup';
export const TELE_ACTIVE = 'active';
export const TELE_DONE = 'done';

// ── Geometry primitives (tile units) ──
export function pointInDisc(px, py, cx, cy, r) {
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}
// Annulus band: lethal between innerR and outerR, safe in the hole or beyond.
export function pointInRing(px, py, cx, cy, innerR, outerR) {
  const dx = px - cx, dy = py - cy, d2 = dx * dx + dy * dy;
  return d2 >= innerR * innerR && d2 <= outerR * outerR;
}
// Shortest distance from a point to a segment — the basis of lane/beam hit-tests.
export function distToSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1;
  const len2 = vx * vx + vy * vy;
  let t = len2 > 0 ? ((px - x1) * vx + (py - y1) * vy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = x1 + t * vx, cy = y1 + t * vy;
  const dx = px - cx, dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy);
}
export function pointInLane(px, py, x1, y1, x2, y2, halfW) {
  return distToSegment(px, py, x1, y1, x2, y2) <= halfW;
}
// Smallest signed difference between two angles, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
// Pie wedge of radius r opening ±halfAngle around `facing` (radians).
export function pointInCone(px, py, cx, cy, facing, halfAngle, r) {
  const dx = px - cx, dy = py - cy, d2 = dx * dx + dy * dy;
  if (d2 > r * r || d2 < 1e-9) return d2 < 1e-9;   // the origin tile is always inside
  return Math.abs(angleDiff(Math.atan2(dy, dx), facing)) <= halfAngle;
}

// ── Phase / fill math (age-driven) ──
// `age` is seconds since the telegraph appeared; `tell` is the windup (dodge
// window), `active` the brief window the hitbox is live.
export function telegraphPhase(t) {
  if (t.age < t.tell) return TELE_WINDUP;
  if (t.age < t.tell + (t.active || 0)) return TELE_ACTIVE;
  return TELE_DONE;
}
// 0→1 windup progress, for the indicator's fill animation.
export function telegraphFill(t) {
  return t.tell > 0 ? Math.min(1, t.age / t.tell) : 1;
}
// Is the point inside this telegraph's lethal area (regardless of phase)? The
// caller gates damage to the ACTIVE phase; this is pure geometry.
export function telegraphDanger(t, px, py) {
  switch (t.shape) {
    case 'disc': return pointInDisc(px, py, t.x, t.y, t.r);
    case 'ring': return pointInRing(px, py, t.x, t.y, t.innerR || 0, t.r);
    case 'lane': return pointInLane(px, py, t.x1, t.y1, t.x2, t.y2, t.halfW);
    case 'cone': return pointInCone(px, py, t.x, t.y, t.facing, t.halfAngle, t.r);
    default: return false;
  }
}
// Convenience for the edge stepper: advance age and report whether this frame is
// the FIRST to enter the ACTIVE window (the detonation frame to resolve a hit on).
export function stepTelegraph(t, dt) {
  const wasActive = telegraphPhase(t) === TELE_ACTIVE;
  t.age += dt;
  const phase = telegraphPhase(t);
  return { phase, justDetonated: phase === TELE_ACTIVE && !wasActive && !t.resolved };
}
