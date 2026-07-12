import { describe, it, expect } from 'vitest';
import { LOOT_CATEGORY_BLURB } from '../../src/data/lootCategories.js';

// The LOOT-bag filter tabs: the leading "All" tab plus one per equipment slot. These
// keys mirror SLOTS in the game shell — if a new slot is added there, its blurb belongs
// here too, and this list keeps the two in lockstep.
const EXPECTED_KEYS = ['all', 'weapon', 'offhand', 'head', 'chest', 'hands', 'legs', 'ring', 'amulet'];

describe('LOOT_CATEGORY_BLURB', () => {
  it('covers exactly the All tab and every equipment slot', () => {
    expect(Object.keys(LOOT_CATEGORY_BLURB).sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it('gives every tab a non-empty blurb that reads as a sentence', () => {
    for (const key of EXPECTED_KEYS) {
      const blurb = LOOT_CATEGORY_BLURB[key];
      expect(typeof blurb).toBe('string');
      expect(blurb.trim().length).toBeGreaterThan(0);
      expect(blurb).toMatch(/[.!]$/);
    }
  });

  it('never carries a double quote that would break the tooltip escaping', () => {
    for (const blurb of Object.values(LOOT_CATEGORY_BLURB)) {
      expect(blurb).not.toContain('"');
    }
  });
});
