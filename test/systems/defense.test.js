import { describe, it, expect } from 'vitest';
import { resistFraction, penFraction, mitigate, physicalShare } from '../../src/systems/defense.js';

describe('resistFraction', () => {
  it('multiplies base armor by the per-school multiplier', () => {
    expect(resistFraction(0.10, 1)).toBeCloseTo(0.10, 6);
    expect(resistFraction(0.10, 1.9)).toBeCloseTo(0.19, 6);
    expect(resistFraction(0.10, 0.4)).toBeCloseTo(0.04, 6);
  });
  it('defaults the multiplier to 1 (neutral)', () => {
    expect(resistFraction(0.13)).toBeCloseTo(0.13, 6);
  });
  it('clamps to the cap so nothing is fully immune', () => {
    expect(resistFraction(0.31, 2.5, 0.6)).toBe(0.6);
    expect(resistFraction(0.5, 3, 0.6)).toBe(0.6);
  });
  it('never returns below zero', () => {
    expect(resistFraction(-1, 2)).toBe(0);
    expect(resistFraction(0.1, -5)).toBe(0);
  });
});

describe('penFraction', () => {
  it('is zero with no penetration', () => {
    expect(penFraction(0)).toBe(0);
  });
  it('follows the asymptotic p/(p+scale) curve, never reaching 1', () => {
    expect(penFraction(0.5)).toBeCloseTo(0.5, 6);   // 0.5/(0.5+0.5)
    expect(penFraction(1.5)).toBeCloseTo(0.75, 6);  // 1.5/(1.5+0.5)
    expect(penFraction(100)).toBeLessThan(1);
    expect(penFraction(100)).toBeGreaterThan(0.99);
  });
  it('respects a custom scale and clamps negatives', () => {
    expect(penFraction(1, 1)).toBeCloseTo(0.5, 6);
    expect(penFraction(-3)).toBe(0);
  });
});

describe('mitigate', () => {
  it('reduces damage by the resistance fraction', () => {
    expect(mitigate(100, 0.2)).toBeCloseTo(80, 6);
  });
  it('returns damage untouched when resistance is non-positive', () => {
    expect(mitigate(100, 0)).toBe(100);
    expect(mitigate(100, -0.3)).toBe(100);
  });
  it('lets penetration claw damage back', () => {
    // 40% resist, 50% pen → effective mitigation 20%
    expect(mitigate(100, 0.4, 0.5)).toBeCloseTo(80, 6);
    // full pen negates the resist entirely
    expect(mitigate(100, 0.4, 1)).toBeCloseTo(100, 6);
  });
  it('clamps pen into [0,1]', () => {
    expect(mitigate(100, 0.4, 2)).toBeCloseTo(100, 6); // pen>1 clamps to 1
    expect(mitigate(100, 0.4, -1)).toBeCloseTo(60, 6); // pen<0 clamps to 0
  });
});

describe('physicalShare', () => {
  it('is 1 for a pure physical hit', () => {
    expect(physicalShare(50, 50)).toBe(1);
  });
  it('is the physical fraction of a hybrid total', () => {
    expect(physicalShare(30, 100)).toBeCloseTo(0.3, 6);
  });
  it('guards a zero total', () => {
    expect(physicalShare(0, 0)).toBe(0);
    expect(physicalShare(10, 0)).toBe(0);
  });
  it('clamps into [0,1]', () => {
    expect(physicalShare(120, 100)).toBe(1);
    expect(physicalShare(-5, 100)).toBe(0);
  });
});
