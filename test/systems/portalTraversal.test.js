import { describe, it, expect } from 'vitest';
import {
  PORTAL_WARP, warpFrame, warpFrameAt, warpDone,
} from '../../src/systems/portalTraversal.js';

// Pure envelope behind the map-portal traversal (walk-through-a-portal warp): the
// portal swallows the hero at the SOURCE pad, the camera pans across to the DEST
// pad, and the hero is spat back out. These tests pin the SHAPES — phase
// boundaries, the pan sweep, the mirrored scale/alpha, spin continuity — so a
// tweak to the drawing can't silently break the timing contract.

const inRange01 = v => v >= 0 && v <= 1;
const { ABSORB, PAN } = PORTAL_WARP;

describe('warpFrame phases', () => {
  it('reports absorb / pan / emerge across its three windows', () => {
    expect(warpFrame(0).phase).toBe('absorb');
    expect(warpFrame(ABSORB - 0.001).phase).toBe('absorb');
    expect(warpFrame((ABSORB + PAN) / 2).phase).toBe('pan');
    expect(warpFrame(PAN + 0.001).phase).toBe('emerge');
    expect(warpFrame(1).phase).toBe('emerge');
  });
  it('keeps the hero at the SOURCE pad only through absorb', () => {
    expect(warpFrame(0).atDest).toBe(false);
    expect(warpFrame(ABSORB - 0.001).atDest).toBe(false);
    expect(warpFrame(ABSORB + 0.001).atDest).toBe(true);   // swallowed → drawn at dest
    expect(warpFrame(1).atDest).toBe(true);
  });
});

describe('warpFrame absorb (hero → into the portal)', () => {
  it('starts full-size, fully solid, unspun, with no swirl', () => {
    const a = warpFrame(0);
    expect(a.heroScale).toBe(1);
    expect(a.heroAlpha).toBe(1);
    expect(a.spin).toBe(0);
    expect(a.swirl).toBe(0);
    expect(a.panT).toBe(0);
  });
  it('shrinks and fades the hero out monotonically as it is pulled in', () => {
    let prevScale = Infinity, prevAlpha = Infinity;
    for (let p = 0; p <= ABSORB + 1e-9; p += ABSORB / 10) {
      const f = warpFrame(p);
      expect(f.heroScale).toBeLessThanOrEqual(prevScale + 1e-9);
      expect(f.heroAlpha).toBeLessThanOrEqual(prevAlpha + 1e-9);
      prevScale = f.heroScale; prevAlpha = f.heroAlpha;
    }
  });
  it('winds the spin up and the swirl in as it charges', () => {
    expect(warpFrame(ABSORB / 2).spin).toBeGreaterThan(warpFrame(0).spin);
    expect(warpFrame(ABSORB).spin).toBeGreaterThan(warpFrame(ABSORB / 2).spin);
    expect(warpFrame(ABSORB).swirl).toBeGreaterThan(warpFrame(0).swirl);
  });
});

describe('warpFrame pan (camera glides to the partner pad)', () => {
  it('hides the hero and sweeps the camera 0 → 1 across the pan', () => {
    const start = warpFrame(ABSORB + 1e-6);
    const mid = warpFrame((ABSORB + PAN) / 2);
    const end = warpFrame(PAN);
    expect(mid.heroScale).toBe(0);
    expect(mid.heroAlpha).toBe(0);
    expect(start.panT).toBeLessThan(mid.panT);
    expect(mid.panT).toBeLessThan(end.panT);
    expect(end.panT).toBeCloseTo(1);
  });
  it('moves the camera monotonically from source to dest', () => {
    let prev = -Infinity;
    for (let p = ABSORB; p <= PAN + 1e-9; p += (PAN - ABSORB) / 12) {
      const t = warpFrame(p).panT;
      expect(t).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = t;
    }
  });
});

describe('warpFrame emerge (hero ← out of the portal)', () => {
  it('ends full-size, fully solid, upright, with no swirl, camera on the dest pad', () => {
    const z = warpFrame(1);
    expect(z.heroScale).toBe(1);
    expect(z.heroAlpha).toBe(1);
    expect(z.spin).toBe(0);
    expect(z.swirl).toBe(0);
    expect(z.panT).toBe(1);
  });
  it('fades the hero back in monotonically as it settles', () => {
    let prevAlpha = -Infinity;
    for (let p = PAN; p <= 1 + 1e-9; p += (1 - PAN) / 10) {
      const a = warpFrame(p).heroAlpha;
      expect(a).toBeGreaterThanOrEqual(prevAlpha - 1e-9);
      prevAlpha = a;
    }
  });
  it('springs the hero out with a scale that overshoots 1 then settles to exactly 1', () => {
    let peak = 0;
    for (let p = PAN; p <= 1 + 1e-9; p += (1 - PAN) / 20) peak = Math.max(peak, warpFrame(p).heroScale);
    expect(peak).toBeGreaterThan(1);          // the "pop"
    expect(peak).toBeLessThan(1.2);           // but a restrained one
    expect(warpFrame(1).heroScale).toBe(1);   // settles dead on 1
    expect(warpFrame(PAN).heroScale).toBe(0); // starts from nothing at the seam
  });
  it('unwinds the spin back to upright and the swirl back down', () => {
    expect(warpFrame(PAN).spin).toBeGreaterThan(warpFrame(1).spin);
    expect(warpFrame(1).spin).toBe(0);
    expect(warpFrame(PAN).swirl).toBeGreaterThan(warpFrame(1).swirl);
  });
});

describe('warpFrame invariants', () => {
  it('keeps alpha, panT and swirl within [0,1] across the whole run', () => {
    for (let p = -0.2; p <= 1.2; p += 0.02) {
      const f = warpFrame(p);
      for (const k of ['heroAlpha', 'panT', 'swirl']) {
        expect(inRange01(f[k]), `${k} at p=${p.toFixed(2)}`).toBe(true);
      }
    }
  });
  it('keeps heroScale in [0, 1.2] across the whole run (allowing the emerge pop)', () => {
    for (let p = -0.2; p <= 1.2; p += 0.02) {
      const s = warpFrame(p).heroScale;
      expect(s >= 0 && s <= 1.2, `heroScale ${s} at p=${p.toFixed(2)}`).toBe(true);
    }
  });
  it('keeps the spin continuous across the phase seams', () => {
    const spinMax = PORTAL_WARP.SPIN_TURNS * Math.PI * 2;
    expect(warpFrame(ABSORB).spin).toBeCloseTo(spinMax);
    expect(warpFrame(ABSORB + 1e-9).spin).toBeCloseTo(spinMax);
    expect(warpFrame(PAN).spin).toBeCloseTo(spinMax);
    expect(warpFrame(PAN + 1e-9).spin).toBeCloseTo(spinMax);
  });
  it('clamps out-of-range progress to the endpoints', () => {
    expect(warpFrame(-1)).toEqual(warpFrame(0));
    expect(warpFrame(2)).toEqual(warpFrame(1));
  });
  it('honours a custom spin-turn count', () => {
    expect(warpFrame(ABSORB, 3).spin).toBeCloseTo(3 * Math.PI * 2);
    expect(warpFrame(ABSORB, 0).spin).toBe(0);
  });
});

describe('warpFrameAt dispatch', () => {
  it('maps elapsed/total ms onto warpFrame progress', () => {
    expect(warpFrameAt(0, PORTAL_WARP.DUR_MS)).toEqual(warpFrame(0));
    expect(warpFrameAt(PORTAL_WARP.DUR_MS, PORTAL_WARP.DUR_MS)).toEqual(warpFrame(1));
    const half = warpFrameAt(PORTAL_WARP.DUR_MS / 2, PORTAL_WARP.DUR_MS);
    expect(half).toEqual(warpFrame(0.5));
  });
  it('resolves a zero/negative duration to the final frame', () => {
    expect(warpFrameAt(0, 0)).toEqual(warpFrame(1));
    expect(warpFrameAt(5, -2)).toEqual(warpFrame(1));
  });
});

describe('warpDone', () => {
  it('is true only once the full duration has elapsed', () => {
    expect(warpDone(0, PORTAL_WARP.DUR_MS)).toBe(false);
    expect(warpDone(PORTAL_WARP.DUR_MS - 1, PORTAL_WARP.DUR_MS)).toBe(false);
    expect(warpDone(PORTAL_WARP.DUR_MS, PORTAL_WARP.DUR_MS)).toBe(true);
    expect(warpDone(PORTAL_WARP.DUR_MS + 100, PORTAL_WARP.DUR_MS)).toBe(true);
  });
});
