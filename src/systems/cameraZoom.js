// Camera zoom — how many tiles the follow camera fits across the play area's
// SHORTER axis. Fewer tiles = bigger tiles. Pure and deterministic (no DOM, no
// clock); `src/legacy/game.js` owns the live value and feeds it a frame delta.
//
// Normal play sits at the most zoomed-in stop, which is what makes the pixel art
// read at default browser zoom. A boss fight EASES the camera back so the
// guardian's arena — a 31-tile circle with a 3×3 thing stalking you around it —
// reads at its real scale, then eases in again once the guardian falls.
//
// The pull-back is capped by what the screen can afford, not by a fixed number:
// on a phone or a foldable cover screen, fitting the full boss view would shrink
// each tile past reading size, so we fit as many tiles as stay at least
// MIN_BOSS_TILE_PX and never zoom out past that. A small screen simply gets less
// of the effect rather than an unreadable one.

export const VIEW_TILES_BASE = 13;    // normal play — the most zoomed-in stop
export const VIEW_TILES_BOSS = 17;    // a guardian's arena — ~1.3x wider view
export const MIN_BOSS_TILE_PX = 26;   // never pull back past this tile size (CSS px)
export const ZOOM_EASE_SEC = 0.8;     // how long the pull-back / settle-back takes

// The view width a fight state wants, given the shorter axis of the play area in
// CSS pixels. Pass 0/undefined for the axis to skip the small-screen cap.
export function targetViewTiles(bossFight, shortAxisCssPx) {
  if (!bossFight) return VIEW_TILES_BASE;
  if (!(shortAxisCssPx > 0)) return VIEW_TILES_BOSS;
  const fits = Math.floor(shortAxisCssPx / MIN_BOSS_TILE_PX);
  return Math.max(VIEW_TILES_BASE, Math.min(VIEW_TILES_BOSS, fits));
}

// Ease in AND out — the camera leans into the move and settles out of it. A plain
// exponential approach was the first cut and felt wrong here: it spends nearly
// half the move in the first few frames, so the pull-back read as a snap followed
// by a drift rather than one deliberate camera move.
function smoothstep(t) { return t * t * (3 - 2 * t); }

// A zoom, at rest at `tiles`. `t` is progress through the current glide (1 = done).
export function makeZoom(tiles = VIEW_TILES_BASE) {
  return { from: tiles, to: tiles, t: 1, tiles };
}

// True while a glide is in flight. The renderer uses this to STRETCH the floor's
// baked terrain instead of re-baking at every intermediate tile size — a glide
// crosses a dozen-odd integer sizes inside a second, and a full-floor bake at each
// would hitch the fight badly.
export function zoomAnimating(zoom) { return zoom.t < 1; }

// Advance one frame toward `target`. Retargeting mid-glide restarts the ease from
// wherever the camera actually is, so a guardian felled during the pull-back
// reverses smoothly rather than jumping. Progress is wall-clock, so the move takes
// the same time at any frame rate; `dt` is clamped so a stalled tab resumes with a
// glide rather than a jump-cut.
export function stepZoom(zoom, target, dt, sec = ZOOM_EASE_SEC) {
  // Settled where we already want to be: hand back the same object, so the frames
  // that are the overwhelming majority (not in a boss fight) allocate nothing.
  if (target === zoom.to && zoom.t >= 1) return zoom;
  let { from, to, t, tiles } = zoom;
  if (target !== to) { from = tiles; to = target; t = 0; }
  t = (sec > 0 && dt > 0) ? Math.min(1, t + Math.min(dt, 0.25) / sec) : 1;
  tiles = t >= 1 ? to : from + (to - from) * smoothstep(t);
  return { from, to, t, tiles };
}
