// Page-scroll lock — the rule deciding whether a touch drag belongs to the PAGE.
//
// The game is a fixed, full-viewport surface: the page itself must never scroll,
// pan or rubber-band, or the fixed header/footer bands slide out of view and
// leave blank browser background under the map. CSS settles that on a
// spec-compliant engine, but iOS Safari still pans the visual viewport on a
// drag, so game.js also cancels the touchmove. It may only cancel drags the page
// owns: a drag that starts inside a real scroller (a shop list, the LOOT drawer,
// a wiki article) has to keep scrolling — INCLUDING the moment that scroller
// runs out of room, where the browser would otherwise chain the leftover scroll
// up to the page.
//
// These take plain BOXES — `{ overflowX, overflowY, scrollLeft, scrollTop,
// scrollWidth, scrollHeight, clientWidth, clientHeight }` — not elements, so the
// rule is testable without a DOM. game.js snapshots the styles once per gesture
// and re-reads the live scroll offsets per move.

/** Overflow values that make a box its own touch-scrollable container. A
 *  `hidden` box may still be scrolled programmatically, but a finger can't. */
const SCROLL_OVERFLOW = new Set(['auto', 'scroll', 'overlay']);

/** Sub-pixel slack: a box within a pixel of its limit has nothing left to give. */
const EDGE_EPS = 1;

/** True when a finger drag can scroll this box on the given axis at all. */
export function isScrollBox(box, axis) {
  if (!box) return false;
  if (axis !== 'x' && SCROLL_OVERFLOW.has(box.overflowY) &&
      box.scrollHeight - box.clientHeight > EDGE_EPS) return true;
  if (axis !== 'y' && SCROLL_OVERFLOW.has(box.overflowX) &&
      box.scrollWidth - box.clientWidth > EDGE_EPS) return true;
  return false;
}

/** True when the box still has room to move in the drag's direction, so the
 *  browser's own scrolling should be left alone. `dx`/`dy` are the finger's
 *  displacement since touchstart in client px — a finger moving DOWN (dy > 0)
 *  pulls content down, which means scrolling UP (scrollTop must be > 0). */
export function boxAbsorbsDrag(box, dx, dy) {
  if (!box) return false;
  if (isScrollBox(box, 'y')) {
    const max = box.scrollHeight - box.clientHeight;
    if (dy < 0 && box.scrollTop < max - EDGE_EPS) return true;
    if (dy > 0 && box.scrollTop > EDGE_EPS) return true;
  }
  if (isScrollBox(box, 'x')) {
    const max = box.scrollWidth - box.clientWidth;
    if (dx < 0 && box.scrollLeft < max - EDGE_EPS) return true;
    if (dx > 0 && box.scrollLeft > EDGE_EPS) return true;
  }
  return false;
}

/** The verdict for a gesture: block it (cancel the touchmove) unless one of the
 *  scrollable ancestors under the finger — innermost first — can absorb it. */
export function shouldBlockPageDrag(hosts, dx, dy) {
  if (!hosts) return true;
  for (const box of hosts) if (boxAbsorbsDrag(box, dx, dy)) return false;
  return true;
}
