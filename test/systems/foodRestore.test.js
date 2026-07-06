import { describe, it, expect } from 'vitest';
import { foodGains } from '../../src/systems/foodRestore.js';

const full = { hp: 100, maxHp: 100, mp: 50, maxMp: 50, stamina: 100, maxStamina: 100 };

describe('foodGains', () => {
  it('tops up all three pools by the food amount when there is room', () => {
    const pools = { hp: 40, maxHp: 100, mp: 20, maxMp: 50, stamina: 60, maxStamina: 100 };
    expect(foodGains(pools, 15)).toEqual({ hp: 15, mp: 15, stamina: 15 });
  });

  it('clamps each pool to the room left — never overfills', () => {
    const pools = { hp: 95, maxHp: 100, mp: 48, maxMp: 50, stamina: 30, maxStamina: 100 };
    expect(foodGains(pools, 20)).toEqual({ hp: 5, mp: 2, stamina: 20 });
  });

  it('gives nothing to a pool already full', () => {
    expect(foodGains(full, 25)).toEqual({ hp: 0, mp: 0, stamina: 0 });
  });

  it('treats missing pools (legacy save) as zero gain, not NaN', () => {
    const g = foodGains({ hp: 10, maxHp: 100 }, 12); // no mp/stamina keys
    expect(g).toEqual({ hp: 12, mp: 0, stamina: 0 });
  });

  it('handles fractional current values (stamina regen) without going negative', () => {
    const g = foodGains({ hp: 0, maxHp: 100, mp: 0, maxMp: 50, stamina: 88.6, maxStamina: 100 }, 10);
    expect(g.stamina).toBeCloseTo(10, 5);
    // a pool sitting above max (edge case) yields 0, not a negative gain
    expect(foodGains({ stamina: 120, maxStamina: 100 }, 10).stamina).toBe(0);
  });

  it('a zero / missing amount restores nothing', () => {
    expect(foodGains(full, 0)).toEqual({ hp: 0, mp: 0, stamina: 0 });
    expect(foodGains({ hp: 10, maxHp: 100 })).toEqual({ hp: 0, mp: 0, stamina: 0 });
  });
});
