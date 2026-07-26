import { describe, it, expect } from 'vitest';
import {
  castCost, lifeCost, canAfford, autoCastAffordsLife, costLabel,
} from '../../src/systems/skillCost.js';
import {
  MIN_CAST_COST, LIFE_COST_PER_MP, BLOOD_PRICE_MULT, AUTO_CAST_LIFE_RESERVE,
} from '../../src/data/skillCosts.js';

describe('castCost — mana after Mana Cost Reduction', () => {
  it('is the base cost with no reduction', () => {
    expect(castCost(40, 0)).toBe(40);
  });

  it('divides rather than subtracting, so each MCR point does a little less', () => {
    // 40 / (1 + 100/100) = 20; 40 / (1 + 200/100) ≈ 13 — never half again.
    expect(castCost(40, 100)).toBe(20);
    expect(castCost(40, 200)).toBe(13);
    const step1 = castCost(40, 0) - castCost(40, 50);
    const step2 = castCost(40, 50) - castCost(40, 100);
    expect(step2).toBeLessThan(step1);
  });

  it('asymptotes toward free but never below the floor', () => {
    expect(castCost(40, 1e6)).toBe(MIN_CAST_COST);
    expect(castCost(1, 900)).toBe(MIN_CAST_COST);
  });

  it('keeps a free skill free, and treats garbage as free', () => {
    expect(castCost(0, 50)).toBe(0);
    expect(castCost(undefined, 50)).toBe(0);
    expect(castCost(NaN, 50)).toBe(0);
  });

  it('never lets negative / garbage MCR inflate the price', () => {
    expect(castCost(40, -100)).toBe(40);
    expect(castCost(40, 'lots')).toBe(40);
    expect(castCost(40, undefined)).toBe(40);
  });
});

describe('lifeCost — blood a no-mana class pays', () => {
  it('is a share of MAX HP per point of the mana cost', () => {
    expect(lifeCost(1000, 20)).toBe(Math.round(1000 * LIFE_COST_PER_MP * 20));
  });

  it('tracks the health pool: four times the HP, about four times the toll', () => {
    const small = lifeCost(500, 30);
    const big = lifeCost(2000, 30);
    expect(big / small).toBeCloseTo(4, 1);
  });

  it('doubles under the Blood Price keystone', () => {
    expect(lifeCost(1000, 20, true)).toBe(lifeCost(1000, 20) * BLOOD_PRICE_MULT);
  });

  it('always costs at least a point of blood, and tolerates garbage', () => {
    expect(lifeCost(10, 1)).toBe(1);
    expect(lifeCost(0, 0)).toBe(1);
    expect(lifeCost(NaN, NaN)).toBe(1);
    expect(lifeCost(-100, -5)).toBe(1);
  });
});

describe('canAfford — one predicate for the bar, the tooltips and the cast', () => {
  it('checks the mana pool for a mana cast', () => {
    expect(canAfford({ hp: 500, mp: 40, cost: 40 })).toBe(true);
    expect(canAfford({ hp: 500, mp: 39, cost: 40 })).toBe(false);
  });

  it('checks that a blood cast leaves the hero ALIVE, never merely solvent', () => {
    expect(canAfford({ hp: 51, mp: 0, cost: 40, life: 50 })).toBe(true);
    expect(canAfford({ hp: 50, mp: 0, cost: 40, life: 50 })).toBe(false); // would hit 0
    expect(canAfford({ hp: 1, mp: 0, cost: 40, life: 50 })).toBe(false);
  });

  it('ignores the (empty) mana pool once a blood toll is charged', () => {
    expect(canAfford({ hp: 900, mp: 0, cost: 40, life: 20 })).toBe(true);
  });

  it('is always true for a free cast', () => {
    expect(canAfford({ hp: 1, mp: 0, cost: 0 })).toBe(true);
    expect(canAfford({ hp: 1, mp: 0, cost: NaN })).toBe(true);
  });
});

describe('autoCastAffordsLife — the auto slot holds a health reserve', () => {
  const RESERVE = AUTO_CAST_LIFE_RESERVE;

  it('allows a blood cast that leaves the reserve standing', () => {
    // 1000 max HP, reserve 50% → a 100-HP toll needs 600 HP in hand.
    expect(autoCastAffordsLife(1000, 1000, 100)).toBe(true);
    expect(autoCastAffordsLife(1000 * RESERVE + 100, 1000, 100)).toBe(true);
  });

  it('refuses one that would eat into the reserve — the bleed-out bug', () => {
    expect(autoCastAffordsLife(1000 * RESERVE + 99, 1000, 100)).toBe(false);
    expect(autoCastAffordsLife(200, 1000, 100)).toBe(false);
  });

  it('never blocks a cast with no blood toll (mana casts, free casts)', () => {
    expect(autoCastAffordsLife(1, 1000, 0)).toBe(true);
    expect(autoCastAffordsLife(1, 1000, NaN)).toBe(true);
  });

  it('is stricter than mere survival — that is the whole point', () => {
    const hp = 120, maxHp = 1000, toll = 100;
    expect(canAfford({ hp, mp: 0, cost: 10, life: toll })).toBe(true);  // a keypress may
    expect(autoCastAffordsLife(hp, maxHp, toll)).toBe(false);           // the auto slot may not
  });
});

describe('costLabel — the price a tooltip prints', () => {
  it('quotes blood for a blood-caster and mana for everyone else', () => {
    expect(costLabel(40, 18)).toBe('18 HP');
    expect(costLabel(40, 0)).toBe('40 MP');
  });

  it('says free when nothing is charged', () => {
    expect(costLabel(0, 0)).toBe('free');
  });
});
