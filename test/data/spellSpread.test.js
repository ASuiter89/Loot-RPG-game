import { describe, it, expect } from 'vitest';
import { SPELL_SPREAD, DEFAULT_SPELL_SPREAD, spellSpreadFor } from '../../src/data/spellSpread.js';

describe('spellSpread data', () => {
  it('exposes a sane default and per-spell overrides', () => {
    expect(DEFAULT_SPELL_SPREAD).toBeGreaterThan(0);
    expect(DEFAULT_SPELL_SPREAD).toBeLessThan(1);
    expect(Object.keys(SPELL_SPREAD).length).toBeGreaterThan(0);
  });

  it('keeps every authored spread a fraction in (0, 0.95] so a range never zeroes or inverts', () => {
    for (const [id, s] of Object.entries(SPELL_SPREAD)) {
      expect(s, id).toBeGreaterThan(0);
      expect(s, id).toBeLessThanOrEqual(0.95);
    }
  });

  it('gives spells distinct spreads (not all the same value)', () => {
    const distinct = new Set(Object.values(SPELL_SPREAD));
    expect(distinct.size).toBeGreaterThan(3);
  });
});

describe('spellSpreadFor', () => {
  it('returns the authored spread for a known spell', () => {
    expect(spellSpreadFor('m_a00')).toBe(SPELL_SPREAD.m_a00);
    expect(spellSpreadFor('m_a53')).toBe(SPELL_SPREAD.m_a53);
  });
  it('falls back to the default for unknown or missing ids', () => {
    expect(spellSpreadFor('does_not_exist')).toBe(DEFAULT_SPELL_SPREAD);
    expect(spellSpreadFor(undefined)).toBe(DEFAULT_SPELL_SPREAD);
    expect(spellSpreadFor(null)).toBe(DEFAULT_SPELL_SPREAD);
  });
});
