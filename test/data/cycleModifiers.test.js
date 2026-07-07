import { describe, it, expect } from 'vitest';
import { CYCLE_MODIFIERS } from '../../src/data/cycleModifiers.js';

const KNOWN_KNOBS = new Set(['lootTierShift', 'bountyPayoutMult', 'enemyAffix', 'densityMult', 'xpMult']);

describe('CYCLE_MODIFIERS shape', () => {
  it('is a non-empty array of uniquely-id\'d rows', () => {
    expect(Array.isArray(CYCLE_MODIFIERS)).toBe(true);
    expect(CYCLE_MODIFIERS.length).toBeGreaterThan(0);
    const ids = new Set();
    for (const m of CYCLE_MODIFIERS) {
      expect(typeof m.id).toBe('string');
      expect(ids.has(m.id)).toBe(false);
      ids.add(m.id);
    }
  });

  it('every row has name, desc and a params object using only known knobs of the right type', () => {
    for (const m of CYCLE_MODIFIERS) {
      expect(typeof m.name).toBe('string');
      expect(typeof m.desc).toBe('string');
      expect(m.params && typeof m.params).toBe('object');
      for (const key of Object.keys(m.params)) {
        expect(KNOWN_KNOBS.has(key)).toBe(true);
        const v = m.params[key];
        if (key === 'enemyAffix') expect(typeof v).toBe('string');
        else if (key === 'lootTierShift') expect(Number.isInteger(v)).toBe(true);
        else expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('includes a neutral "open" baseline with no knobs set', () => {
    const open = CYCLE_MODIFIERS.find((m) => m.id === 'open');
    expect(open).toBeTruthy();
    expect(Object.keys(open.params)).toHaveLength(0);
  });
});
