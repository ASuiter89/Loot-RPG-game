import { describe, it, expect } from 'vitest';
import { mercFloorRate, mercCost } from '../../src/systems/mercPricing.js';
import { MERC_PRICE, MERC_DURATIONS, MERC_TYPES } from '../../src/data/mercenaries.js';

// The Sellsword only opens on reaching Brutal (max depth ≥ 51), so pricing is
// exercised across that range and beyond into Endless.
const BRUTAL_START = 51, BRUTAL_END = 75, ENDLESS = 120;

describe('mercFloorRate', () => {
  it('matches the documented per-floor formula', () => {
    // (floorBase + depth * floorPerDepth) * mult, no rounding.
    expect(mercFloorRate(1, 51)).toBeCloseTo(MERC_PRICE.floorBase + 51 * MERC_PRICE.floorPerDepth);
    expect(mercFloorRate(1.2, 60)).toBeCloseTo((MERC_PRICE.floorBase + 60 * MERC_PRICE.floorPerDepth) * 1.2);
  });

  it('climbs steeply with the deepest floor reached', () => {
    for (let d = BRUTAL_START; d < ENDLESS; d++) {
      expect(mercFloorRate(1, d + 1)).toBeGreaterThan(mercFloorRate(1, d));
    }
    // Depth is the dominant term across Brutal → Endless (more than doubles).
    expect(mercFloorRate(1, ENDLESS)).toBeGreaterThan(mercFloorRate(1, BRUTAL_START) * 2);
  });

  it('scales linearly with the merc tier multiplier', () => {
    expect(mercFloorRate(1.3, 60)).toBeCloseTo(mercFloorRate(1, 60) * 1.3);
  });

  it('clamps a missing/zero/undefined depth to 1 so it never underprices', () => {
    const floor1 = mercFloorRate(1, 1);
    expect(mercFloorRate(1, 0)).toBe(floor1);
    expect(mercFloorRate(1, undefined)).toBe(floor1);
    expect(mercFloorRate(1, -5)).toBe(floor1);
  });

  it('treats a missing tier multiplier as 1', () => {
    expect(mercFloorRate(undefined, 60)).toBe(mercFloorRate(1, 60));
    expect(mercFloorRate(0, 60)).toBe(mercFloorRate(1, 60));
  });
});

describe('mercCost', () => {
  it('is the per-floor rate times the duration multiplier, rounded', () => {
    const single = MERC_DURATIONS.find(d => d.floors === 1);
    expect(mercCost(1, 60, single.mult)).toBe(Math.round(mercFloorRate(1, 60)));
    const thirty = MERC_DURATIONS.find(d => d.floors === 30);
    expect(mercCost(1.15, 60, thirty.mult)).toBe(Math.round(mercFloorRate(1.15, 60) * thirty.mult));
  });

  it('returns a whole number of coins', () => {
    for (const dur of MERC_DURATIONS) {
      for (const t of MERC_TYPES) {
        expect(Number.isInteger(mercCost(t.mult, 63, dur.mult))).toBe(true);
      }
    }
  });

  it('longer contracts cost more in total but less per floor (a gentle bulk discount)', () => {
    const depth = 60, mult = 1.15;
    const perFloor = MERC_DURATIONS.map(d => ({ floors: d.floors, total: mercCost(mult, depth, d.mult) }))
      .map(x => ({ ...x, each: x.total / x.floors }));
    // Total rises with contract length…
    for (let i = 1; i < perFloor.length; i++) {
      expect(perFloor[i].total).toBeGreaterThan(perFloor[i - 1].total);
    }
    // …but the per-floor rate falls as the contract lengthens…
    for (let i = 1; i < perFloor.length; i++) {
      expect(perFloor[i].each).toBeLessThan(perFloor[i - 1].each);
    }
    // …and the discount stays gentle: even the longest contract is < 20% off per floor.
    const one = perFloor[0].each, longest = perFloor[perFloor.length - 1].each;
    expect(longest).toBeGreaterThan(one * 0.8);
  });

  it('is a drastic jump over the old flat contract at the depths mercs are hired', () => {
    // Old model: a fixed 5-floor contract at (160 + maxFloor*22) * mult.
    const oldCost = (mult, maxFloor) => Math.round((160 + maxFloor * 22) * mult);
    for (const depth of [BRUTAL_START, BRUTAL_END, ENDLESS]) {
      const oldPerFloor = oldCost(1.15, depth) / 5;
      const newPerFloor = mercCost(1.15, depth, 1); // 1-floor rate
      expect(newPerFloor).toBeGreaterThan(oldPerFloor * 2.5);
    }
  });
});
