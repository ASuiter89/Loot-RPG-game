// Off-screen direction arrows — pure geometry for edge-of-viewport indicators.
//
// When something worth pointing at (the down-stairs, a remaining foe) scrolls
// outside the visible map, a small arrow rides the panel border on the ray from
// the hero to that target, pointing straight at it. This module is the pure math
// behind those arrows: no canvas, no game globals — a caller in render/ hands in
// pixel-space camera params plus target tiles and gets back where each arrow sits
// and which way it points, so the geometry stays deterministic and unit-testable
// while the drawing itself stays at the render edge.

// Is a footprint spanning `span` tiles from tile (tx,ty) at all inside the
// [0,W]×[0,H] viewport, given camera offset (offX,offY) and tile size (tw,th)?
// A one-pixel sliver on screen counts as visible — no arrow is needed then.
export function tileOnScreen(tx, ty, span, offX, offY, tw, th, W, H) {
  const l = offX + tx * tw, t = offY + ty * th;
  const r = l + span * tw, b = t + span * th;
  return l < W && r > 0 && t < H && b > 0;
}

// Point where the ray from (px,py) along unit (dx,dy) meets the nearest edge of
// the rectangle inset by `pad` on every side, clamped to stay inside it. Returns
// {x,y}. (dx,dy) is assumed to be a unit vector.
export function edgeAnchor(px, py, dx, dy, W, H, pad) {
  const minX = pad, minY = pad, maxX = W - pad, maxY = H - pad;
  let t = Infinity;
  if (dx > 1e-6) t = Math.min(t, (maxX - px) / dx);
  else if (dx < -1e-6) t = Math.min(t, (minX - px) / dx);
  if (dy > 1e-6) t = Math.min(t, (maxY - py) / dy);
  else if (dy < -1e-6) t = Math.min(t, (minY - py) / dy);
  if (!isFinite(t) || t < 0) t = 0;
  return {
    x: Math.max(minX, Math.min(maxX, px + dx * t)),
    y: Math.max(minY, Math.min(maxY, py + dy * t)),
  };
}

// Build the merged set of edge arrows pointing at off-screen targets.
//
//   hero      { fx, fy } hero footprint centre in TILE coords
//   targets   [{ x, y, span, cx?, cy? }] each target's tile top-left, footprint
//             span, and optional smooth centre in TILE coords (defaults to the
//             footprint centre x+span/2, y+span/2)
//   cam       { offX, offY, tw, th } camera pixel offset + tile size in pixels
//   view      { W, H } canvas size in pixels
//   pad       border inset so the whole arrowhead stays inside the panel
//   mergeDist arrows landing within this many px of an already-accepted one are
//             dropped, so a pack clustered in one direction collapses to a single
//             arrow aimed at its nearest foe (0 → keep every off-screen target)
//
// Returns [{ x, y, angle, dist }] — anchor pixel, heading (radians, +x → target)
// and hero→target pixel distance — nearest first, thinned by the merge spacing.
export function offscreenArrows({ hero, targets, cam, view, pad, mergeDist = 0 }) {
  const { offX, offY, tw, th } = cam;
  const { W, H } = view;
  const psx = offX + hero.fx * tw, psy = offY + hero.fy * th;
  const cand = [];
  for (const tgt of targets || []) {
    const span = tgt.span || 1;
    if (tileOnScreen(tgt.x, tgt.y, span, offX, offY, tw, th, W, H)) continue;  // visible → no arrow
    const cxT = tgt.cx == null ? tgt.x + span / 2 : tgt.cx;
    const cyT = tgt.cy == null ? tgt.y + span / 2 : tgt.cy;
    let dx = offX + cxT * tw - psx, dy = offY + cyT * th - psy;
    const mag = Math.hypot(dx, dy);
    if (mag < 1e-3) continue;                                                  // sitting on the hero → no direction
    dx /= mag; dy /= mag;
    const a = edgeAnchor(psx, psy, dx, dy, W, H, pad);
    cand.push({ x: a.x, y: a.y, angle: Math.atan2(dy, dx), dist: mag });
  }
  cand.sort((p, q) => p.dist - q.dist);                                        // nearest first so merges keep the closest foe
  if (mergeDist <= 0) return cand;
  const out = [];
  for (const c of cand) {
    if (out.some(o => Math.hypot(o.x - c.x, o.y - c.y) < mergeDist)) continue;
    out.push(c);
  }
  return out;
}
