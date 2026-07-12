import { describe, it, expect } from 'vitest';
import {
  unitPrice, lotPrice, refineCost, refineYield, canRefine,
} from '../../src/systems/prospector.js';
import {
  PROSPECTOR_BASE_PRICE, PROSPECTOR_VISIT_MARKUP, PROSPECTOR_DEPTH_MARKUP,
  REFINE_CHAIN, REFINE_COST,
} from '../../src/data/prospector.js';

describe('unitPrice', () => {
  it('returns the base price at depth 1 with no prior buys', () => {
    for (const mat of Object.keys(PROSPECTOR_BASE_PRICE)) {
      expect(unitPrice(mat, 1, 0)).toBe(PROSPECTOR_BASE_PRICE[mat]);
    }
  });

  it('adds the depth surcharge as a fraction of base per floor beyond 1', () => {
    const at100 = unitPrice('scrap', 100, 0);
    const expected = Math.round(PROSPECTOR_BASE_PRICE.scrap * (1 + PROSPECTOR_DEPTH_MARKUP * 99));
    expect(at100).toBe(expected);
    expect(at100).toBeGreaterThan(PROSPECTOR_BASE_PRICE.scrap);
  });

  it('compounds the visit markup for each prior purchase this visit', () => {
    const first = unitPrice('glimmer', 1, 0);
    const second = unitPrice('glimmer', 1, 1);
    expect(second).toBeGreaterThan(first);
    const expected = Math.round(PROSPECTOR_BASE_PRICE.glimmer * (1 + PROSPECTOR_VISIT_MARKUP));
    expect(second).toBe(expected);
  });

  it('never drops below 1 and rounds to a whole coin', () => {
    const p = unitPrice('scrap', 1, 0);
    expect(Number.isInteger(p)).toBe(true);
    expect(p).toBeGreaterThanOrEqual(1);
  });

  it('returns 0 for an unknown material', () => {
    expect(unitPrice('mithril', 50, 3)).toBe(0);
  });

  it('treats a missing/low depth as depth 1 (no negative surcharge)', () => {
    expect(unitPrice('core', 0, 0)).toBe(PROSPECTOR_BASE_PRICE.core);
    expect(unitPrice('core', undefined, 0)).toBe(PROSPECTOR_BASE_PRICE.core);
  });
});

describe('lotPrice', () => {
  it('is flat: the current unit price × the quantity (markup is per-purchase)', () => {
    const qty = 50;
    expect(lotPrice('scrap', qty, 10, 0)).toBe(unitPrice('scrap', 10, 0) * qty);
  });

  it('a big common lot never balloons geometrically', () => {
    // The 50-scrap lot must stay ~50× the unit price, not a runaway sum.
    const unit = unitPrice('scrap', 45, 0);
    expect(lotPrice('scrap', 50, 45, 0)).toBe(unit * 50);
    expect(lotPrice('scrap', 50, 45, 0)).toBeLessThan(unit * 51);
  });

  it('prices the whole lot at the CURRENT purchase index (offset by prior buys)', () => {
    expect(lotPrice('scrap', 3, 1, 2)).toBe(unitPrice('scrap', 1, 2) * 3);
  });

  it('a later purchase of the same lot size costs more (per-buy markup)', () => {
    expect(lotPrice('core', 5, 30, 1)).toBeGreaterThan(lotPrice('core', 5, 30, 0));
  });

  it('is 0 for a non-positive quantity', () => {
    expect(lotPrice('scrap', 0, 5, 0)).toBe(0);
    expect(lotPrice('scrap', -3, 5, 0)).toBe(0);
  });
});

describe('refineCost / refineYield', () => {
  it('walks the chain, consuming REFINE_COST of a tier to yield the next', () => {
    expect(refineCost('scrap')).toBe(REFINE_COST.scrap);
    expect(refineYield('scrap')).toBe('glimmer');
    expect(refineCost('glimmer')).toBe(REFINE_COST.glimmer);
    expect(refineYield('glimmer')).toBe('core');
    expect(refineCost('core')).toBe(REFINE_COST.core);
    expect(refineYield('core')).toBe('chaos');
  });

  it('has no refine above the top tier (Chaos Orb)', () => {
    expect(refineCost('chaos')).toBeNull();
    expect(refineYield('chaos')).toBeNull();
  });

  it('returns null for an unknown material', () => {
    expect(refineCost('mithril')).toBeNull();
    expect(refineYield('mithril')).toBeNull();
  });

  it('every non-top chain entry has a defined, lossy cost vs. buying the next tier', () => {
    for (let i = 0; i < REFINE_CHAIN.length - 1; i++) {
      const mat = REFINE_CHAIN[i];
      const next = REFINE_CHAIN[i + 1];
      const need = refineCost(mat);
      expect(need).toBeGreaterThan(0);
      // Refining must cost MORE base-gold than simply buying the higher material,
      // so it's a surplus sink, not arbitrage.
      expect(need * PROSPECTOR_BASE_PRICE[mat]).toBeGreaterThan(PROSPECTOR_BASE_PRICE[next]);
    }
  });
});

describe('canRefine', () => {
  it('is true only with enough of the material for one refine', () => {
    expect(canRefine('scrap', REFINE_COST.scrap)).toBe(true);
    expect(canRefine('scrap', REFINE_COST.scrap - 1)).toBe(false);
    expect(canRefine('scrap', 0)).toBe(false);
  });
  it('is false for the top tier and unknown materials', () => {
    expect(canRefine('chaos', 999)).toBe(false);
    expect(canRefine('mithril', 999)).toBe(false);
  });
  it('treats a missing holding as zero', () => {
    expect(canRefine('scrap', undefined)).toBe(false);
  });
});
