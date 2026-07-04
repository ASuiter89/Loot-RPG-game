import { describe, it, expect } from 'vitest';
import { MERC_TYPES, MERC_ART, MERC_DURATIONS, MERC_PRICE } from '../../src/data/mercenaries.js';

describe('MERC_TYPES', () => {
  it('lists distinct, fully-specified merc types', () => {
    expect(MERC_TYPES.length).toBeGreaterThanOrEqual(6);
    const ids = new Set();
    for (const t of MERC_TYPES) {
      expect(typeof t.id).toBe('string');
      expect(typeof t.name).toBe('string');
      expect(typeof t.minion).toBe('string');
      expect(typeof t.desc).toBe('string');
      expect(t.mult).toBeGreaterThan(1);        // every tier costs/hits above baseline
      expect(t.accent).toMatch(/^#[0-9a-f]{6}$/i); // hex accent for the hire card
      ids.add(t.id);
    }
    expect(ids.size).toBe(MERC_TYPES.length);   // ids are unique
  });
});

describe('MERC_ART', () => {
  it('only maps known merc ids to walk sprites', () => {
    const ids = new Set(MERC_TYPES.map(t => t.id));
    for (const id of Object.keys(MERC_ART)) {
      expect(ids.has(id)).toBe(true);
      expect(typeof MERC_ART[id]).toBe('string');
    }
  });
});

describe('MERC_DURATIONS', () => {
  it('offers ascending floor counts starting at a single floor', () => {
    expect(MERC_DURATIONS[0].floors).toBe(1);
    expect(MERC_DURATIONS[0].mult).toBe(1);     // one floor is the unit price
    for (let i = 1; i < MERC_DURATIONS.length; i++) {
      expect(MERC_DURATIONS[i].floors).toBeGreaterThan(MERC_DURATIONS[i - 1].floors);
    }
  });

  it('discounts per floor but never below ~15% off, and never inverts', () => {
    for (const d of MERC_DURATIONS) {
      // cost multiplier is below the floor count (a discount) but above 0.8× of it
      // (the discount stays gentle, unlike the Mystic's steeper pact discount).
      expect(d.mult).toBeLessThanOrEqual(d.floors);
      expect(d.mult).toBeGreaterThan(d.floors * 0.8);
    }
  });
});

describe('MERC_PRICE', () => {
  it('has a positive base and a steep depth term', () => {
    expect(MERC_PRICE.floorBase).toBeGreaterThan(0);
    expect(MERC_PRICE.floorPerDepth).toBeGreaterThan(0);
    // Depth dominates by the time the Sellsword unlocks (Brutal, depth ≥ 51).
    expect(51 * MERC_PRICE.floorPerDepth).toBeGreaterThan(MERC_PRICE.floorBase);
  });
});
