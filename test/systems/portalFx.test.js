import { describe, it, expect } from 'vitest';
import {
  PORTAL_FX, chargeProgress, departFrame, arriveFrame, portalFrame, portalDone,
} from '../../src/systems/portalFx.js';

// Pure envelope behind the town-portal teleport animation. The render layer feeds
// in elapsed time and reads back the beam brightness, hero opacity and lift for
// that instant. These tests pin the SHAPES (boundaries, monotonicity, a peak in the
// beam) so a tweak to the drawing can't silently break the timing contract.

const inRange01 = v => v >= 0 && v <= 1;
const frameFields = ['beam', 'heroAlpha', 'heroLift', 'glow'];

describe('chargeProgress', () => {
  it('is 0 at the start of the channel and 1 the instant it completes', () => {
    expect(chargeProgress(3, 3)).toBe(0);   // full time left → just started
    expect(chargeProgress(0, 3)).toBe(1);   // no time left → done charging
  });
  it('climbs monotonically as the seconds-left fall', () => {
    expect(chargeProgress(2.25, 3)).toBeCloseTo(0.25);
    expect(chargeProgress(1.5, 3)).toBeCloseTo(0.5);
    expect(chargeProgress(0.75, 3)).toBeCloseTo(0.75);
  });
  it('clamps to [0,1] and treats a non-positive total as complete', () => {
    expect(chargeProgress(5, 3)).toBe(0);   // more left than total (shouldn't happen) → clamp to "just started"
    expect(chargeProgress(-1, 3)).toBe(1);  // past done (overcharged) → clamp to complete
    expect(chargeProgress(1, 0)).toBe(1);
    expect(chargeProgress(1, -2)).toBe(1);
  });
});

describe('departFrame (hero → town)', () => {
  it('starts fully solid with no beam and ends invisible', () => {
    const a = departFrame(0);
    expect(a.heroAlpha).toBe(1);
    expect(a.heroLift).toBe(0);
    expect(a.beam).toBe(0);
    const z = departFrame(1);
    expect(z.heroAlpha).toBe(0);
    expect(z.heroLift).toBe(1);
  });
  it('keeps every channel within [0,1] across the whole run', () => {
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const f = departFrame(p);
      for (const k of frameFields) expect(inRange01(f[k]), `${k} at p=${p.toFixed(2)}`).toBe(true);
    }
  });
  it('fades the hero out monotonically (never flickers back up)', () => {
    let prev = Infinity;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const a = departFrame(p).heroAlpha;
      expect(a).toBeLessThanOrEqual(prev + 1e-9);
      prev = a;
    }
  });
  it('the beam rises to a peak and recedes by the end', () => {
    const mid = departFrame(0.5).beam;
    expect(mid).toBeGreaterThan(departFrame(0).beam);
    expect(mid).toBeGreaterThan(departFrame(1).beam);
    expect(departFrame(1).beam).toBeLessThan(0.5);   // soft cut, not a full-bright snap
  });
  it('clamps out-of-range progress to the endpoints', () => {
    expect(departFrame(-1)).toEqual(departFrame(0));
    expect(departFrame(2)).toEqual(departFrame(1));
  });
});

describe('arriveFrame (town → dungeon)', () => {
  it('starts invisible (lifted) and ends fully solid in place', () => {
    const a = arriveFrame(0);
    expect(a.heroAlpha).toBe(0);
    expect(a.heroLift).toBe(1);
    const z = arriveFrame(1);
    expect(z.heroAlpha).toBe(1);
    expect(z.heroLift).toBe(0);
  });
  it('keeps every channel within [0,1] across the whole run', () => {
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const f = arriveFrame(p);
      for (const k of frameFields) expect(inRange01(f[k]), `${k} at p=${p.toFixed(2)}`).toBe(true);
    }
  });
  it('materializes the hero in monotonically (never flickers back down)', () => {
    let prev = -Infinity;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const a = arriveFrame(p).heroAlpha;
      expect(a).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = a;
    }
  });
  it('settles the hero down into place as it solidifies (lift decreases)', () => {
    let prev = Infinity;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const l = arriveFrame(p).heroLift;
      expect(l).toBeLessThanOrEqual(prev + 1e-9);
      prev = l;
    }
  });
  it('the pillar stabs in early and recedes by the end', () => {
    expect(arriveFrame(0.2).beam).toBeGreaterThan(arriveFrame(1).beam);
  });
});

describe('portalFrame dispatch', () => {
  it("'out' matches departFrame and 'in' matches arriveFrame at the same progress", () => {
    expect(portalFrame('out', 425, 850)).toEqual(departFrame(0.5));
    expect(portalFrame('in', 425, 850)).toEqual(arriveFrame(0.5));
  });
  it('an unknown direction falls back to departure', () => {
    expect(portalFrame('sideways', 0, 850)).toEqual(departFrame(0));
  });
  it('a zero/negative duration resolves to the final frame', () => {
    expect(portalFrame('out', 0, 0)).toEqual(departFrame(1));
    expect(portalFrame('in', 5, 0)).toEqual(arriveFrame(1));
  });
});

describe('portalDone', () => {
  it('is true only once the full duration has elapsed', () => {
    expect(portalDone(0, PORTAL_FX.OUT_MS)).toBe(false);
    expect(portalDone(PORTAL_FX.OUT_MS - 1, PORTAL_FX.OUT_MS)).toBe(false);
    expect(portalDone(PORTAL_FX.OUT_MS, PORTAL_FX.OUT_MS)).toBe(true);
    expect(portalDone(PORTAL_FX.OUT_MS + 100, PORTAL_FX.OUT_MS)).toBe(true);
  });
});
