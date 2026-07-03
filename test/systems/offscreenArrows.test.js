import { describe, it, expect } from 'vitest';
import { tileOnScreen, edgeAnchor, offscreenArrows } from '../../src/systems/offscreenArrows.js';

// Pure geometry behind the edge-of-viewport indicator arrows (the gold stairs
// arrow and the small red monster arrows). A 200×200 canvas with 20-px tiles and
// no camera offset makes the sums easy to read: tile t spans pixels [20t, 20t+20).

const CAM = { offX: 0, offY: 0, tw: 20, th: 20 };
const VIEW = { W: 200, H: 200 };  // 10×10 tiles visible

describe('tileOnScreen', () => {
  it('true when the footprint overlaps the viewport at all', () => {
    expect(tileOnScreen(5, 5, 1, 0, 0, 20, 20, 200, 200)).toBe(true);
    expect(tileOnScreen(9, 9, 1, 0, 0, 20, 20, 200, 200)).toBe(true);   // last on-screen tile
  });
  it('false when the footprint sits entirely outside', () => {
    expect(tileOnScreen(10, 5, 1, 0, 0, 20, 20, 200, 200)).toBe(false);  // just past the right edge
    expect(tileOnScreen(-1, 5, 1, 0, 0, 20, 20, 200, 200)).toBe(false);  // just past the left edge
    expect(tileOnScreen(5, 20, 1, 0, 0, 20, 20, 200, 200)).toBe(false);  // below
  });
  it('a one-pixel sliver still counts as visible', () => {
    // Tile at x=-0.95 tiles (via camera offset) leaves 1px on screen.
    expect(tileOnScreen(0, 5, 1, -19, 0, 20, 20, 200, 200)).toBe(true);
    expect(tileOnScreen(0, 5, 1, -20, 0, 20, 20, 200, 200)).toBe(false);  // exactly flush → gone
  });
  it('honours multi-tile footprints', () => {
    // A 3-tile boss whose top-left is off the right edge but whose body reaches in.
    expect(tileOnScreen(8, 5, 3, 0, 0, 20, 20, 200, 200)).toBe(true);
    expect(tileOnScreen(10, 5, 3, 0, 0, 20, 20, 200, 200)).toBe(false);
  });
});

describe('edgeAnchor', () => {
  it('casts straight right to the inset border', () => {
    const a = edgeAnchor(100, 100, 1, 0, 200, 200, 10);
    expect(a.x).toBeCloseTo(190);  // W - pad
    expect(a.y).toBeCloseTo(100);
  });
  it('casts straight up to the inset border', () => {
    const a = edgeAnchor(100, 100, 0, -1, 200, 200, 10);
    expect(a.x).toBeCloseTo(100);
    expect(a.y).toBeCloseTo(10);   // pad
  });
  it('stays clamped inside the inset rectangle on a diagonal', () => {
    const inv = 1 / Math.SQRT2;
    const a = edgeAnchor(100, 100, inv, inv, 200, 200, 10);
    expect(a.x).toBeGreaterThanOrEqual(10);
    expect(a.x).toBeLessThanOrEqual(190);
    expect(a.y).toBeGreaterThanOrEqual(10);
    expect(a.y).toBeLessThanOrEqual(190);
    // 45° from centre hits the corner of the inset square.
    expect(a.x).toBeCloseTo(190);
    expect(a.y).toBeCloseTo(190);
  });
});

describe('offscreenArrows', () => {
  const hero = { fx: 5.5, fy: 5.5 };  // tile-(5,5) centre, i.e. pixel (110,110)

  it('skips targets that are on screen', () => {
    const arrows = offscreenArrows({
      hero, targets: [{ x: 7, y: 7, span: 1 }], cam: CAM, view: VIEW, pad: 10,
    });
    expect(arrows).toEqual([]);
  });

  it('emits an arrow aimed at an off-screen target', () => {
    const arrows = offscreenArrows({
      hero, targets: [{ x: 30, y: 5, span: 1 }], cam: CAM, view: VIEW, pad: 10,
    });
    expect(arrows).toHaveLength(1);
    expect(arrows[0].angle).toBeCloseTo(0);       // due right
    expect(arrows[0].x).toBeCloseTo(190);         // pinned to the right border
    expect(arrows[0].y).toBeCloseTo(110);         // target centre row (tile 5 → 110px)
    expect(arrows[0].dist).toBeGreaterThan(0);
  });

  it('uses the smooth centre (cx,cy) when provided', () => {
    const arrows = offscreenArrows({
      hero, targets: [{ x: 30, y: 30, span: 1, cx: 30.5, cy: 5.5 }],
      cam: CAM, view: VIEW, pad: 10,
    });
    expect(arrows[0].angle).toBeCloseTo(0);       // cy pulls the aim to the hero's row
  });

  it('drops a target sitting exactly on the hero (no direction)', () => {
    // Force it off-screen via a camera offset while its centre coincides with the hero.
    const arrows = offscreenArrows({
      hero, targets: [{ x: 5, y: 5, span: 1, cx: 5.5, cy: 5.5 }],
      cam: CAM, view: { W: 40, H: 40 }, pad: 5,
    });
    expect(arrows).toEqual([]);
  });

  it('merges a cluster in one direction down to its nearest member', () => {
    // Three foes all far to the right — their edge anchors nearly coincide.
    const targets = [
      { x: 40, y: 5, span: 1 },  // farthest
      { x: 30, y: 5, span: 1 },  // nearest
      { x: 35, y: 5, span: 1 },
    ];
    const arrows = offscreenArrows({ hero, targets, cam: CAM, view: VIEW, pad: 10, mergeDist: 20 });
    expect(arrows).toHaveLength(1);
    // Kept the nearest (tile 30 → distance from hero smaller than tile 35/40).
    const nearest = offscreenArrows({ hero, targets: [{ x: 30, y: 5, span: 1 }], cam: CAM, view: VIEW, pad: 10 })[0];
    expect(arrows[0].dist).toBeCloseTo(nearest.dist);
  });

  it('keeps arrows in different directions distinct', () => {
    const targets = [
      { x: 40, y: 5, span: 1 },   // right
      { x: 5, y: 40, span: 1 },   // down
      { x: -30, y: 5, span: 1 },  // left
    ];
    const arrows = offscreenArrows({ hero, targets, cam: CAM, view: VIEW, pad: 10, mergeDist: 20 });
    expect(arrows).toHaveLength(3);
  });

  it('returns arrows sorted nearest-first', () => {
    const targets = [
      { x: 60, y: 5, span: 1 },   // far right
      { x: 5, y: 30, span: 1 },   // near, below
    ];
    const arrows = offscreenArrows({ hero, targets, cam: CAM, view: VIEW, pad: 10 });
    expect(arrows[0].dist).toBeLessThan(arrows[1].dist);
  });

  it('handles an empty / missing target list', () => {
    expect(offscreenArrows({ hero, targets: [], cam: CAM, view: VIEW, pad: 10 })).toEqual([]);
    expect(offscreenArrows({ hero, cam: CAM, view: VIEW, pad: 10 })).toEqual([]);
  });
});
