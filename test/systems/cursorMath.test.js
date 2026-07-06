import { describe, it, expect } from 'vitest';
import { cursorHotspotPx } from '../../src/systems/cursorMath.js';

describe('cursorHotspotPx', () => {
  it('defaults to the top-left tip (0,0) when no hotspot is given', () => {
    expect(cursorHotspotPx(undefined, 48, 96, 96)).toEqual({ x: 0, y: 0 });
    expect(cursorHotspotPx(null, 48, 96, 96)).toEqual({ x: 0, y: 0 });
    expect(cursorHotspotPx({}, 48, 96, 96)).toEqual({ x: 0, y: 0 });
  });

  it('resolves a box-relative fraction into pixels, rounded', () => {
    // scythe: left edge, ~mid height
    expect(cursorHotspotPx({ x: 0, y: 0.52 }, 89, 96, 96)).toEqual({ x: 0, y: 50 });
    // axe: top of head
    expect(cursorHotspotPx({ x: 0.37, y: 0.01 }, 92, 96, 96)).toEqual({ x: 34, y: 1 });
    // mace: top spike
    expect(cursorHotspotPx({ x: 0.30, y: 0 }, 96, 95, 96)).toEqual({ x: 29, y: 0 });
  });

  it('fills only one axis when the drawn box is not square', () => {
    // a tall sprite (dw < dh): x fraction spans the narrow width
    expect(cursorHotspotPx({ x: 1, y: 1 }, 40, 96, 96)).toEqual({ x: 40, y: 95 });
  });

  it('clamps the hotspot to the canvas bounds [0, out-1]', () => {
    expect(cursorHotspotPx({ x: 2, y: 2 }, 96, 96, 96)).toEqual({ x: 95, y: 95 });
    expect(cursorHotspotPx({ x: -1, y: -1 }, 96, 96, 96)).toEqual({ x: 0, y: 0 });
  });

  it('ignores a partial or non-finite fraction on a single axis', () => {
    expect(cursorHotspotPx({ x: 0.5 }, 96, 96, 96)).toEqual({ x: 48, y: 0 });
    expect(cursorHotspotPx({ x: NaN, y: 0.5 }, 96, 96, 96)).toEqual({ x: 0, y: 48 });
  });
});
