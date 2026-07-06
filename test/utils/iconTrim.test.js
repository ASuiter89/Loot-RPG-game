import { describe, it, expect } from 'vitest';
import { trimFillStyle } from '../../src/utils/iconTrim.js';

describe('trimFillStyle', () => {
  it('sets the element aspect ratio to the opaque box aspect', () => {
    expect(trimFillStyle(0, 0, 12, 10, 256, 144).ar).toBe('12/10');
  });

  it('sizes the background so the box fills the element (atlas is bigger than box)', () => {
    const s = trimFillStyle(16, 32, 16, 16, 256, 144);
    expect(s.bgW).toBeCloseTo((256 / 16) * 100); // 1600%
    expect(s.bgH).toBeCloseTo((144 / 16) * 100); // 900%
  });

  it('positions the background at the box origin as a percentage', () => {
    // A box at (dw*p, dh*p) lands at p% — here x0 chosen as 24 of dw=(256-16)=240 -> 10%
    const s = trimFillStyle(24, 0, 16, 16, 256, 144);
    expect(s.posX).toBeCloseTo(24 / (256 - 16) * 100); // 10%
    expect(s.posY).toBeCloseTo(0);
  });

  it('puts a top-left box at 0% and a bottom-right box near 100%', () => {
    const tl = trimFillStyle(0, 0, 16, 16, 256, 144);
    expect(tl.posX).toBe(0);
    expect(tl.posY).toBe(0);
    const br = trimFillStyle(256 - 16, 144 - 16, 16, 16, 256, 144);
    expect(br.posX).toBeCloseTo(100);
    expect(br.posY).toBeCloseTo(100);
  });

  it('guards a degenerate box that spans a full atlas axis (no divide-by-zero)', () => {
    const s = trimFillStyle(0, 0, 256, 144, 256, 144);
    expect(s.posX).toBe(0);
    expect(s.posY).toBe(0);
    expect(Number.isFinite(s.bgW)).toBe(true);
    expect(Number.isFinite(s.bgH)).toBe(true);
  });

  it('guards a zero-size box', () => {
    const s = trimFillStyle(0, 0, 0, 0, 256, 144);
    expect(s.bgW).toBe(100);
    expect(s.bgH).toBe(100);
  });
});
