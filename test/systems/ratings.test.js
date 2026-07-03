import { describe, it, expect } from 'vitest';
import { rated, ratePct, SKILL_RATING } from '../../src/systems/ratings.js';

describe('rated', () => {
  it('is 0 when the rating is non-positive', () => {
    expect(rated(0, 10)).toBe(0);
    expect(rated(-5, 10)).toBe(0);
  });
  it('is certain (1) when there is no opposition', () => {
    expect(rated(10, 0)).toBe(1);
    expect(rated(10, -1)).toBe(1);
  });
  it('is rating/(rating+opposition) otherwise', () => {
    expect(rated(10, 10)).toBe(0.5);
    expect(rated(30, 10)).toBe(0.75);
    expect(rated(120, 120)).toBe(0.5);
  });
  it('never reaches 1 for positive opposition (asymptotic)', () => {
    expect(rated(1e6, 1)).toBeLessThan(1);
    expect(rated(1e6, 1)).toBeGreaterThan(0.999);
  });
  it('rises with rating and falls with opposition (monotonic)', () => {
    expect(rated(20, 10)).toBeGreaterThan(rated(10, 10));
    expect(rated(10, 20)).toBeLessThan(rated(10, 10));
  });
});

describe('ratePct', () => {
  it('scales a fraction by SKILL_RATING', () => {
    expect(SKILL_RATING).toBe(120);
    expect(ratePct(0.5)).toBe(60);
    expect(ratePct(1)).toBe(120);
  });
  it('treats falsy input as 0', () => {
    expect(ratePct(0)).toBe(0);
    expect(ratePct(undefined)).toBe(0);
    expect(ratePct(null)).toBe(0);
  });
});
