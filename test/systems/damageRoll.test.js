import { describe, it, expect } from 'vitest';
import { rollDecimals, quantizeRoll, rollDamage, spreadRange } from '../../src/systems/damageRoll.js';

describe('rollDecimals', () => {
  it('keeps 2 decimals below 10, 1 below 100, 0 at 100+ (≈3 significant figures)', () => {
    expect(rollDecimals(3.45)).toBe(2);
    expect(rollDecimals(9.99)).toBe(2);
    expect(rollDecimals(10)).toBe(1);
    expect(rollDecimals(30.5)).toBe(1);
    expect(rollDecimals(99.9)).toBe(1);
    expect(rollDecimals(100)).toBe(0);
    expect(rollDecimals(345)).toBe(0);
    expect(rollDecimals(3450)).toBe(0); // thousands stay whole — over 3 sig figs is fine
  });
  it('uses magnitude, ignoring sign, and treats non-finite as small', () => {
    expect(rollDecimals(-3)).toBe(2);
    expect(rollDecimals(-300)).toBe(0);
    expect(rollDecimals(NaN)).toBe(2);
  });
});

describe('quantizeRoll', () => {
  it('rounds to the magnitude-appropriate precision', () => {
    expect(quantizeRoll(3.456)).toBe(3.46);
    expect(quantizeRoll(34.56)).toBe(34.6);
    expect(quantizeRoll(345.6)).toBe(346);
    expect(quantizeRoll(3456)).toBe(3456);
  });
  it('is 0 for non-finite input', () => {
    expect(quantizeRoll(Infinity)).toBe(0);
    expect(quantizeRoll(NaN)).toBe(0);
  });
});

describe('rollDamage', () => {
  it('returns the low end when rng is 0 and the high end when rng is ~1', () => {
    expect(rollDamage(2, 6, () => 0)).toBe(2);
    expect(rollDamage(2, 6, () => 1)).toBe(6);
  });
  it('rolls fractional values inside a small range (the whole point)', () => {
    // A 2–6 range at rng 0.3625 lands 3.45 — a value integer rolls could never make.
    expect(rollDamage(2, 6, () => 0.3625)).toBe(3.45);
  });
  it('rolls whole numbers once the value reaches the hundreds', () => {
    const v = rollDamage(200, 600, () => 0.3625);
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBe(345);
  });
  it('accepts endpoints in either order and handles a zero-width range', () => {
    expect(rollDamage(6, 2, () => 0)).toBe(2);
    expect(rollDamage(5, 5, () => 0.99)).toBe(5);
  });
  it('falls back to Math.random when no rng is passed, staying in range', () => {
    for (let i = 0; i < 20; i++) {
      const v = rollDamage(2, 6);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
  it('stays within [lo, hi] across the rng domain', () => {
    for (let i = 0; i <= 10; i++) {
      const v = rollDamage(20, 60, () => i / 10);
      expect(v).toBeGreaterThanOrEqual(20);
      expect(v).toBeLessThanOrEqual(60);
    }
  });
});

describe('spreadRange', () => {
  it('is symmetric about the center so the average is unchanged', () => {
    const [lo, hi] = spreadRange(100, 0.15);
    expect(lo).toBeCloseTo(85, 10);
    expect(hi).toBeCloseTo(115, 10);
    expect((lo + hi) / 2).toBeCloseTo(100, 10);
  });
  it('collapses to a point at zero spread', () => {
    expect(spreadRange(50, 0)).toEqual([50, 50]);
    expect(spreadRange(50)).toEqual([50, 50]);
  });
  it('clamps spread to 0.95 so the low end never reaches zero', () => {
    const [lo, hi] = spreadRange(100, 2);
    expect(lo).toBeCloseTo(5, 10);
    expect(hi).toBeCloseTo(195, 10);
  });
});
