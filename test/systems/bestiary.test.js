import { describe, it, expect } from 'vitest';
import {
  fieldRevealThreshold, isBestiaryFieldKnown, speciesDiscovered, bestiaryRevealRatio,
} from '../../src/systems/bestiary.js';

// Mirror of the legacy FNV-ish hash so the tests exercise realistic thresholds.
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const FULL = 10;

describe('bestiary field reveal', () => {
  it('threshold is stable and within 1..full', () => {
    const t1 = fieldRevealThreshold('rat', 'hp', hashStr, FULL);
    const t2 = fieldRevealThreshold('rat', 'hp', hashStr, FULL);
    expect(t1).toBe(t2);
    expect(t1).toBeGreaterThanOrEqual(1);
    expect(t1).toBeLessThanOrEqual(FULL);
  });

  it('reveals a field once kills reach its threshold', () => {
    const key = 'rat', field = 'dmg';
    const t = fieldRevealThreshold(key, field, hashStr, FULL);
    expect(isBestiaryFieldKnown(key, field, t - 1, false, hashStr, FULL)).toBe(false);
    expect(isBestiaryFieldKnown(key, field, t, false, hashStr, FULL)).toBe(true);
  });

  it('a fully-farmed species reveals every field', () => {
    for (const f of ['lvl', 'hp', 'dmg', 'armor', 'mres', 'style', 'reach']) {
      expect(isBestiaryFieldKnown('rat', f, FULL, false, hashStr, FULL)).toBe(true);
    }
  });

  it('a boss stays sealed until the first kill, then fully known', () => {
    expect(isBestiaryFieldKnown('ratking', 'hp', 0, true, hashStr, FULL)).toBe(false);
    expect(isBestiaryFieldKnown('ratking', 'hp', 1, true, hashStr, FULL)).toBe(true);
    // even a field with a high regular threshold is known at 1 boss kill
    expect(isBestiaryFieldKnown('ratking', 'dmg', 1, true, hashStr, FULL)).toBe(true);
  });
});

describe('bestiary discovery + ratio', () => {
  it('speciesDiscovered flips at the first kill', () => {
    expect(speciesDiscovered(0)).toBe(false);
    expect(speciesDiscovered(1)).toBe(true);
    expect(speciesDiscovered(undefined)).toBe(false);
  });

  it('regular reveal ratio climbs linearly and caps at 1', () => {
    expect(bestiaryRevealRatio(0, false, FULL)).toBe(0);
    expect(bestiaryRevealRatio(5, false, FULL)).toBeCloseTo(0.5);
    expect(bestiaryRevealRatio(FULL, false, FULL)).toBe(1);
    expect(bestiaryRevealRatio(FULL + 7, false, FULL)).toBe(1);
  });

  it('boss reveal ratio is binary', () => {
    expect(bestiaryRevealRatio(0, true, FULL)).toBe(0);
    expect(bestiaryRevealRatio(1, true, FULL)).toBe(1);
    expect(bestiaryRevealRatio(9, true, FULL)).toBe(1);
  });
});
