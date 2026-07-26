import { describe, it, expect } from 'vitest';
import { foodGains, FOOD_STAMINA_FRACTION } from '../../src/systems/foodRestore.js';

const full = { hp: 100, maxHp: 100, mp: 50, maxMp: 50, stamina: 100, maxStamina: 100 };

describe('foodGains', () => {
  it('tops up HP/MP by the flat food amount, Stamina by ~50% of max', () => {
    const pools = { hp: 40, maxHp: 100, mp: 20, maxMp: 50, stamina: 10, maxStamina: 100 };
    // HP/MP get the flat 15; Stamina gets 50% of its 100 max = 50 (90 room).
    expect(foodGains(pools, 15)).toEqual({ hp: 15, mp: 15, stamina: 50 });
  });

  it('scales the Stamina bite with the MAX pool, not the food amount', () => {
    expect(foodGains({ stamina: 0, maxStamina: 100 }, 8).stamina).toBe(50);  // 50% of 100
    expect(foodGains({ stamina: 0, maxStamina: 300 }, 8).stamina).toBe(150); // 50% of 300 — bigger pool, bigger bite
  });

  it('clamps each pool to the room left — never overfills', () => {
    const pools = { hp: 95, maxHp: 100, mp: 48, maxMp: 50, stamina: 80, maxStamina: 100 };
    // Stamina wants 50 but only 20 room remains.
    expect(foodGains(pools, 20)).toEqual({ hp: 5, mp: 2, stamina: 20 });
  });

  it('gives nothing to a pool already full', () => {
    expect(foodGains(full, 25)).toEqual({ hp: 0, mp: 0, stamina: 0 });
  });

  it('treats missing pools (legacy save) as zero gain, not NaN', () => {
    const g = foodGains({ hp: 10, maxHp: 100 }, 12); // no mp/stamina keys
    expect(g).toEqual({ hp: 12, mp: 0, stamina: 0 });
  });

  it('handles fractional current Stamina (regen) without going negative', () => {
    const g = foodGains({ hp: 0, maxHp: 100, mp: 0, maxMp: 50, stamina: 88.6, maxStamina: 100 }, 10);
    expect(g.stamina).toBeCloseTo(11.4, 5); // wants 50, only 11.4 room
    // a pool sitting above max (edge case) yields 0, not a negative gain
    expect(foodGains({ stamina: 120, maxStamina: 100 }, 10).stamina).toBe(0);
  });

  it('falls back to the flat amount when 50% of a tiny max is smaller', () => {
    // maxStamina 10 → 50% = 5, but the flat heal is 20, so Stamina takes the larger 20 (room-capped).
    expect(foodGains({ stamina: 0, maxStamina: 10 }, 20).stamina).toBe(10); // room caps at 10
    expect(foodGains({ stamina: 0, maxStamina: 100 }, 20).stamina).toBe(50); // 50% of 100 beats the flat 20
  });

  it('a zero / missing food amount still refuels Stamina from the max fraction', () => {
    expect(foodGains(full, 0)).toEqual({ hp: 0, mp: 0, stamina: 0 }); // full → no room anywhere
    // HP/MP need a flat amount; Stamina rides the max fraction even at amount 0.
    expect(foodGains({ hp: 10, maxHp: 100, stamina: 0, maxStamina: 100 })).toEqual({ hp: 0, mp: 0, stamina: 50 });
  });

  it('exposes the tuning fraction and honours an override', () => {
    expect(FOOD_STAMINA_FRACTION).toBe(0.5);
    expect(foodGains({ stamina: 0, maxStamina: 100 }, 0, 0.25).stamina).toBe(25);
  });
});
