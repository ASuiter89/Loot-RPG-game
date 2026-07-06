import { describe, it, expect } from 'vitest';
import {
  restockCost,
  RESTOCK_BASE,
  RESTOCK_PER_ILVL,
  RESTOCK_PER_ILVL_SQ,
  RESTOCK_GROWTH,
} from '../../src/systems/shopPricing.js';

const base = (lvl) => RESTOCK_BASE + lvl * RESTOCK_PER_ILVL + lvl * lvl * RESTOCK_PER_ILVL_SQ;

describe('restockCost', () => {
  it('matches the base formula on the first (0th) restock', () => {
    expect(restockCost(5, 0)).toBe(Math.round(base(5)));
    expect(restockCost(70, 0)).toBe(Math.round(base(70)));
  });

  it('scales super-linearly with depth', () => {
    // Doubling the item level should more than double the cost (quadratic term).
    expect(restockCost(70, 0)).toBeGreaterThan(restockCost(35, 0) * 2);
  });

  it('keeps deep floors a real cost, not pocket change', () => {
    // Floor ~69 (ilvl 70) used to cost ~1k; it should now be several thousand.
    expect(restockCost(70, 0)).toBeGreaterThan(5000);
  });

  it('multiplies by the growth factor for each prior restock', () => {
    const b = restockCost(30, 0);
    expect(restockCost(30, 1)).toBe(Math.round(b * RESTOCK_GROWTH));
    expect(restockCost(30, 2)).toBe(Math.round(b * RESTOCK_GROWTH * RESTOCK_GROWTH));
  });

  it('rises monotonically with each restock', () => {
    let prev = 0;
    for (let n = 0; n <= 5; n++) {
      const c = restockCost(20, n);
      expect(c).toBeGreaterThan(prev);
      prev = c;
    }
  });

  it('clamps a low or bad item level to at least 1', () => {
    expect(restockCost(0, 0)).toBe(Math.round(base(1)));
    expect(restockCost(-5, 0)).toBe(Math.round(base(1)));
    expect(restockCost(NaN, 0)).toBe(Math.round(base(1)));
  });

  it('treats a missing or negative restock count as zero', () => {
    expect(restockCost(10)).toBe(restockCost(10, 0));
    expect(restockCost(10, -3)).toBe(restockCost(10, 0));
  });
});
