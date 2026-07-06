// Pure math for the gamepad (controller) input layer. No DOM, no globals, no
// clock/RNG — primitives in, numbers/indices out — so the feel and the menu
// navigation are unit-testable. The Gamepad API polling + DOM focus wiring that
// calls these lives in the monolith (src/legacy/game.js), alongside the rest of
// the input handling and the touch layer it mirrors.
//
// Two jobs live here:
//   1. Analog stick → movement vector (a radial dead-zone, like the touch stick).
//   2. Spatial DOM navigation — given the focused element's box and a list of
//      candidate boxes, pick the best one in a D-pad direction. This is what makes
//      every menu drivable with the D-pad / left stick.

import { scaleDeadZone } from './joystickMath.js';

// Stick dead-zones. Sticks rest a little off-centre and drift, so ignore small
// pushes. Movement wants a generous zone (no creep while resting); the menu
// "flick" that steps focus wants a firm threshold so one push = one step.
const MOVE_DEAD_ZONE = 0.22;   // fraction of full throw ignored for movement
const NAV_THRESHOLD  = 0.5;    // push past this (of full throw) to step menu focus
const SPRINT_AT      = 0.9;    // reserved: full-push detection, mirrors the touch stick
// How strongly a cross-axis (perpendicular) offset is penalised when picking the
// next element in a direction. High enough that an element in the SAME row/column
// always beats a closer-but-diagonal one, low enough that a diagonal is still
// reachable when nothing is aligned. Tuned against real menu grids.
const CROSS_PENALTY = 3;

/**
 * Analog stick → movement input vector, with a radial scaled dead-zone. The raw
 * axes are already normalized to roughly [-1, 1] by the Gamepad API; we clamp the
 * magnitude to 1, ease it out of the dead-zone (so there's no speed jump at the
 * edge), and scale the unit direction by it. Screen/axis y grows downward, matching
 * the game's iy (down = +1), so callers need no flip.
 *
 * @param {number} x raw horizontal axis (-1 left .. +1 right)
 * @param {number} y raw vertical axis (-1 up .. +1 down)
 * @param {number} [deadZone] dead-zone fraction of full throw
 * @returns {{ix:number, iy:number, mag:number}}
 */
export function padStickVector(x, y, deadZone = MOVE_DEAD_ZONE) {
  const dist = Math.hypot(x, y);
  if (dist <= 0) return { ix: 0, iy: 0, mag: 0 };
  const raw = Math.min(1, dist);
  const mag = scaleDeadZone(raw, deadZone);
  if (mag <= 0) return { ix: 0, iy: 0, mag: 0 };
  const ux = x / dist, uy = y / dist;
  return { ix: ux * mag, iy: uy * mag, mag };
}

/**
 * The dominant compass direction a stick is pushed, or null inside the dead-zone.
 * Used to drive menu focus with the left stick as if it were the D-pad — the axis
 * with the larger magnitude wins, so a mostly-horizontal push reads as left/right.
 *
 * @param {number} x raw horizontal axis
 * @param {number} y raw vertical axis (down = +)
 * @param {number} [threshold] minimum push (of full throw) to register
 * @returns {'up'|'down'|'left'|'right'|null}
 */
export function stickToDir(x, y, threshold = NAV_THRESHOLD) {
  if (Math.hypot(x, y) < threshold) return null;
  if (Math.abs(x) >= Math.abs(y)) return x >= 0 ? 'right' : 'left';
  return y >= 0 ? 'down' : 'up';
}

/**
 * Rising edges between two same-length boolean pressed-state arrays: the indices
 * that went from not-pressed to pressed since the last poll. This is how a button
 * fires exactly once per press instead of every frame it's held.
 * @param {boolean[]} prev previous poll's pressed states
 * @param {boolean[]} curr current poll's pressed states
 * @returns {number[]} indices newly pressed this poll
 */
export function edgePressed(prev, curr) {
  const out = [];
  for (let i = 0; i < curr.length; i++) if (curr[i] && !prev[i]) out.push(i);
  return out;
}

/**
 * Falling edges: indices that went from pressed to not-pressed since last poll.
 * @param {boolean[]} prev previous poll's pressed states
 * @param {boolean[]} curr current poll's pressed states
 * @returns {number[]} indices newly released this poll
 */
export function edgeReleased(prev, curr) {
  const out = [];
  for (let i = 0; i < prev.length; i++) if (prev[i] && !curr[i]) out.push(i);
  return out;
}

// Centre of a DOMRect-like box.
function cx(r) { return (r.left + r.right) / 2; }
function cy(r) { return (r.top + r.bottom) / 2; }
// Gap between two 1-D spans [a0,a1] and [b0,b1]; 0 when they overlap.
function spanGap(a0, a1, b0, b1) {
  if (a1 < b0) return b0 - a1;
  if (b1 < a0) return a0 - b1;
  return 0;
}

/**
 * Spatial menu navigation. Given the currently-focused box and a list of candidate
 * boxes (DOMRect-like: {left, right, top, bottom}), return the INDEX of the best
 * element to move focus to in `dir`, or -1 if nothing lies that way.
 *
 * A candidate qualifies only if its centre is genuinely on the correct side of the
 * current element's centre. Among those, the score is the primary-axis distance
 * Alignment strictly dominates: a candidate whose CROSS-axis span overlaps the
 * current element (a true same-row neighbour for a horizontal move, or same-column
 * for a vertical one) is ALWAYS preferred over any non-overlapping one, no matter how
 * much nearer the latter sits. Only when nothing overlaps do we fall back to a
 * distance-plus-misalignment score. Without this, "→" from a tab could jump to a
 * slightly-right item one row DOWN (small primary distance) instead of the aligned
 * tab beside it (larger primary distance) — the exact "it goes diagonally" bug. This
 * single rule drives every menu — vertical lists, horizontal tab strips, and the
 * loot/skill grids alike — with no per-menu wiring.
 *
 * @param {{left:number,right:number,top:number,bottom:number}} current focused box
 * @param {Array<{left:number,right:number,top:number,bottom:number}>} candidates
 * @param {'up'|'down'|'left'|'right'} dir
 * @returns {number} index into candidates, or -1
 */
export function pickInDirection(current, candidates, dir) {
  const horizontal = dir === 'left' || dir === 'right';
  const sign = (dir === 'right' || dir === 'down') ? 1 : -1;
  const curX = cx(current), curY = cy(current);
  // Two tiers: an aligned neighbour (cross-span overlaps → same row/column) wins on
  // primary distance alone; everything else competes on the weighted score.
  let aligned = -1, alignedPrimary = Infinity;
  let any = -1, anyScore = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const r = candidates[i];
    if (!r) continue;
    const rx = cx(r), ry = cy(r);
    // Primary = displacement along the travel axis; must be in the chosen direction.
    const primary = horizontal ? (rx - curX) * sign : (ry - curY) * sign;
    if (primary <= 1) continue;   // not far enough on the correct side (>1px guards ties)
    // Cross = perpendicular misalignment: the gap between the perpendicular spans,
    // 0 when they overlap (same row for a horizontal move, same column for vertical).
    const cross = horizontal
      ? spanGap(current.top, current.bottom, r.top, r.bottom)
      : spanGap(current.left, current.right, r.left, r.right);
    if (cross === 0 && primary < alignedPrimary) { alignedPrimary = primary; aligned = i; }
    const score = primary + CROSS_PENALTY * cross;
    if (score < anyScore) { anyScore = score; any = i; }
  }
  return aligned >= 0 ? aligned : any;
}

/**
 * Reading order (top-to-bottom, then left-to-right) of a list of boxes, returned as
 * indices into the input. Used to choose an initial focus when a menu opens and as
 * a stable wrap order. Rows are bucketed with a tolerance so items whose tops differ
 * by a few px still count as the same row.
 * @param {Array<{left:number,top:number}>} rects
 * @param {number} [rowTol] px tolerance for "same row"
 * @returns {number[]} indices in reading order
 */
export function readingOrder(rects, rowTol = 12) {
  return rects
    .map((r, i) => ({ i, top: r.top, left: r.left }))
    .sort((a, b) => (Math.abs(a.top - b.top) <= rowTol ? a.left - b.left : a.top - b.top))
    .map((o) => o.i);
}

export const PAD_DEFAULTS = {
  moveDeadZone: MOVE_DEAD_ZONE,
  navThreshold: NAV_THRESHOLD,
  sprintAt: SPRINT_AT,
  crossPenalty: CROSS_PENALTY,
};
