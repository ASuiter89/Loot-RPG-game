import { describe, it, expect } from 'vitest';
import { HARD_CC, TENACITY } from '../../src/data/tenacity.js';

describe('HARD_CC set', () => {
  it('covers the lock effects (stun/freeze) and excludes soft CC', () => {
    expect(HARD_CC.has('stun')).toBe(true);
    expect(HARD_CC.has('freeze')).toBe(true);
    expect(HARD_CC.has('slow')).toBe(false);
    expect(HARD_CC.has('chill')).toBe(false);
  });
});

describe('TENACITY profiles', () => {
  it('defines a boss and an elite tier (and no ordinary-foe tier)', () => {
    expect(TENACITY.boss).toBeTruthy();
    expect(TENACITY.elite).toBeTruthy();
    expect(TENACITY.normal).toBeUndefined();
  });

  it('every profile has sane, in-range fields', () => {
    for (const [tier, p] of Object.entries(TENACITY)) {
      expect(p.tenac, tier).toBeGreaterThan(0);
      expect(p.tenac, tier).toBeLessThan(1);
      expect(Array.isArray(p.drSteps), tier).toBe(true);
      expect(p.drSteps.length, tier).toBeGreaterThanOrEqual(1);
      expect(p.windowSecs, tier).toBeGreaterThan(0);
      expect(p.floorSecs, tier).toBeGreaterThan(0);
    }
  });

  it('drSteps start at full strength and only weaken (diminishing returns)', () => {
    for (const [tier, p] of Object.entries(TENACITY)) {
      expect(p.drSteps[0], tier).toBe(1);
      for (let i = 1; i < p.drSteps.length; i++) {
        expect(p.drSteps[i], tier).toBeLessThan(p.drSteps[i - 1]);
        expect(p.drSteps[i], tier).toBeGreaterThan(0);
      }
    }
  });

  it('bosses resist harder than elites (stronger cut, longer window)', () => {
    expect(TENACITY.boss.tenac).toBeGreaterThan(TENACITY.elite.tenac);
    expect(TENACITY.boss.windowSecs).toBeGreaterThanOrEqual(TENACITY.elite.windowSecs);
  });
});
