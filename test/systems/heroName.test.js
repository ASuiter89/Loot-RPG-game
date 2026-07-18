import { describe, it, expect } from 'vitest';
import { normalizeHeroName, isValidHeroName, HERO_NAME_MAX } from '../../src/systems/heroName.js';

describe('normalizeHeroName', () => {
  it('trims the ends and collapses internal whitespace runs to one space', () => {
    expect(normalizeHeroName('  Sir  Reginald  ')).toBe('Sir Reginald');
    expect(normalizeHeroName('Gray\t\tWolf')).toBe('Gray Wolf');
  });

  it('caps the result at HERO_NAME_MAX characters', () => {
    const long = 'A'.repeat(40);
    expect(normalizeHeroName(long)).toHaveLength(HERO_NAME_MAX);
    expect(normalizeHeroName(long)).toBe('A'.repeat(HERO_NAME_MAX));
  });

  it('returns an empty string for blank or whitespace-only input', () => {
    expect(normalizeHeroName('')).toBe('');
    expect(normalizeHeroName('    ')).toBe('');
    expect(normalizeHeroName('\n\t ')).toBe('');
  });

  it('coerces non-string input to an empty string safely', () => {
    expect(normalizeHeroName(null)).toBe('');
    expect(normalizeHeroName(undefined)).toBe('');
    expect(normalizeHeroName(42)).toBe('42');
  });
});

describe('isValidHeroName', () => {
  it('accepts any input that normalizes to a non-empty name', () => {
    expect(isValidHeroName('Adventurer')).toBe(true);
    expect(isValidHeroName('  x  ')).toBe(true);
  });

  it('rejects blank, whitespace-only, and nullish input', () => {
    expect(isValidHeroName('')).toBe(false);
    expect(isValidHeroName('   ')).toBe(false);
    expect(isValidHeroName(null)).toBe(false);
    expect(isValidHeroName(undefined)).toBe(false);
  });
});
