import { describe, it, expect } from 'vitest';
import {
  targetViewTiles, makeZoom, stepZoom, zoomAnimating,
  VIEW_TILES_BASE, VIEW_TILES_BOSS, MIN_BOSS_TILE_PX, ZOOM_EASE_SEC,
} from '../../src/systems/cameraZoom.js';

const DESKTOP = 585;   // shorter axis of the map box on a 1280x800 window, CSS px
const FRAME = 1 / 60;

// Run a zoom for `secs` of wall clock at a given frame rate.
const run = (zoom, target, secs, dt = FRAME) => {
  let z = zoom;
  for (let t = 0; t < secs; t += dt) z = stepZoom(z, target, dt);
  return z;
};

describe('targetViewTiles', () => {
  it('holds the zoomed-in stop for normal play', () => {
    expect(targetViewTiles(false, DESKTOP)).toBe(VIEW_TILES_BASE);
    expect(targetViewTiles(false, 320)).toBe(VIEW_TILES_BASE);
  });

  it('pulls the camera back for a boss fight', () => {
    expect(targetViewTiles(true, DESKTOP)).toBe(VIEW_TILES_BOSS);
    expect(VIEW_TILES_BOSS).toBeGreaterThan(VIEW_TILES_BASE); // "back", not "in"
  });

  it('caps the pull-back so tiles never shrink past reading size', () => {
    // A phone: the full boss view would put ~23px tiles on screen, so fit fewer.
    const phone = 390;
    const tiles = targetViewTiles(true, phone);
    expect(phone / tiles).toBeGreaterThanOrEqual(MIN_BOSS_TILE_PX);
    expect(tiles).toBeLessThan(VIEW_TILES_BOSS);
  });

  it('leaves a very small screen at the normal view rather than shrinking it', () => {
    // A ~280px foldable cover screen is already below MIN_BOSS_TILE_PX at the base
    // view; pulling back would only make it worse, so the effect bows out.
    expect(targetViewTiles(true, 280)).toBe(VIEW_TILES_BASE);
    expect(targetViewTiles(true, 120)).toBe(VIEW_TILES_BASE);
  });

  it('never zooms in past the normal view, at any screen size', () => {
    for (let px = 120; px <= 2400; px += 7) {
      const tiles = targetViewTiles(true, px);
      expect(tiles).toBeGreaterThanOrEqual(VIEW_TILES_BASE);
      expect(tiles).toBeLessThanOrEqual(VIEW_TILES_BOSS);
    }
  });

  it('widens monotonically as the screen grows', () => {
    let prev = 0;
    for (let px = 120; px <= 2400; px += 7) {
      const tiles = targetViewTiles(true, px);
      expect(tiles).toBeGreaterThanOrEqual(prev);
      prev = tiles;
    }
  });

  it('falls back to the full boss view when the screen size is unknown', () => {
    expect(targetViewTiles(true, 0)).toBe(VIEW_TILES_BOSS);
    expect(targetViewTiles(true, undefined)).toBe(VIEW_TILES_BOSS);
  });
});

describe('makeZoom', () => {
  it('starts at rest on the normal view', () => {
    const z = makeZoom();
    expect(z.tiles).toBe(VIEW_TILES_BASE);
    expect(zoomAnimating(z)).toBe(false);
  });
});

describe('stepZoom', () => {
  it('glides toward the target rather than snapping', () => {
    const z = stepZoom(makeZoom(), VIEW_TILES_BOSS, FRAME);
    expect(z.tiles).toBeGreaterThan(VIEW_TILES_BASE);
    expect(z.tiles).toBeLessThan(VIEW_TILES_BOSS);
    expect(zoomAnimating(z)).toBe(true);
  });

  it('eases IN as well as out — it does not lurch off the mark', () => {
    // The tell of the exponential approach this replaced: it spent ~half the move
    // in the first few frames, reading as a snap-then-drift. A smoothstep leans in.
    const eighth = run(makeZoom(), VIEW_TILES_BOSS, ZOOM_EASE_SEC / 8);
    const covered = (eighth.tiles - VIEW_TILES_BASE) / (VIEW_TILES_BOSS - VIEW_TILES_BASE);
    expect(covered).toBeLessThan(0.1);    // barely moving at the start…
    const half = run(makeZoom(), VIEW_TILES_BOSS, ZOOM_EASE_SEC / 2);
    const halfway = (half.tiles - VIEW_TILES_BASE) / (VIEW_TILES_BOSS - VIEW_TILES_BASE);
    expect(halfway).toBeGreaterThan(0.4); // …and squarely mid-move at the midpoint
    expect(halfway).toBeLessThan(0.6);
  });

  it('lands EXACTLY on the target, so the renderer knows the zoom has settled', () => {
    // A curve that never quite arrives would leave the terrain bake stretched
    // (soft) forever — zoomAnimating() going false is what triggers a crisp re-bake.
    const out = run(makeZoom(), VIEW_TILES_BOSS, ZOOM_EASE_SEC * 1.5);
    expect(out.tiles).toBe(VIEW_TILES_BOSS);
    expect(zoomAnimating(out)).toBe(false);
    const back = run(out, VIEW_TILES_BASE, ZOOM_EASE_SEC * 1.5);
    expect(back.tiles).toBe(VIEW_TILES_BASE);
    expect(zoomAnimating(back)).toBe(false);
  });

  it('takes the same wall-clock time at any frame rate', () => {
    // 12 frames at 30fps and 48 at 120fps are both 0.4s of wall clock, so the
    // camera must be in exactly the same place — progress tracks elapsed time,
    // not frames served.
    const steps = (n, dt) => {
      let z = makeZoom();
      for (let i = 0; i < n; i++) z = stepZoom(z, VIEW_TILES_BOSS, dt);
      return z.tiles;
    };
    expect(Math.abs(steps(12, 1 / 30) - steps(48, 1 / 120))).toBeLessThan(1e-9);
    expect(Math.abs(steps(24, 1 / 60) - steps(48, 1 / 120))).toBeLessThan(1e-9);
  });

  it('reverses smoothly from wherever it is when the target flips mid-glide', () => {
    // The guardian dies while the camera is still pulling back: no jump-cut.
    const mid = run(makeZoom(), VIEW_TILES_BOSS, ZOOM_EASE_SEC / 2);
    const turn = stepZoom(mid, VIEW_TILES_BASE, FRAME);
    expect(turn.from).toBe(mid.tiles);              // restarts from the live position
    expect(Math.abs(turn.tiles - mid.tiles)).toBeLessThan(0.5);
    expect(run(turn, VIEW_TILES_BASE, ZOOM_EASE_SEC * 1.5).tiles).toBe(VIEW_TILES_BASE);
  });

  it('never overshoots, even on a long stalled frame', () => {
    expect(stepZoom(makeZoom(), VIEW_TILES_BOSS, 10).tiles).toBeLessThanOrEqual(VIEW_TILES_BOSS);
    expect(stepZoom(makeZoom(VIEW_TILES_BOSS), VIEW_TILES_BASE, 10).tiles).toBeGreaterThanOrEqual(VIEW_TILES_BASE);
  });

  it('stays within the two stops the whole way', () => {
    let z = makeZoom();
    for (let t = 0; t < ZOOM_EASE_SEC * 1.5; t += FRAME) {
      z = stepZoom(z, VIEW_TILES_BOSS, FRAME);
      expect(z.tiles).toBeGreaterThanOrEqual(VIEW_TILES_BASE);
      expect(z.tiles).toBeLessThanOrEqual(VIEW_TILES_BOSS);
    }
  });

  it('allocates nothing on a settled frame — the common case, every frame', () => {
    const z = makeZoom();
    expect(stepZoom(z, VIEW_TILES_BASE, FRAME)).toBe(z);          // same object, not a copy
    const boss = run(makeZoom(), VIEW_TILES_BOSS, ZOOM_EASE_SEC * 1.5);
    expect(stepZoom(boss, VIEW_TILES_BOSS, FRAME)).toBe(boss);
  });

  it('snaps to the target for a zero or nonsense delta', () => {
    expect(stepZoom(makeZoom(), VIEW_TILES_BOSS, 0).tiles).toBe(VIEW_TILES_BOSS);
    expect(stepZoom(makeZoom(), VIEW_TILES_BOSS, -1).tiles).toBe(VIEW_TILES_BOSS);
    expect(stepZoom(makeZoom(), VIEW_TILES_BOSS, FRAME, 0).tiles).toBe(VIEW_TILES_BOSS);
  });
});
