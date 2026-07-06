import { describe, it, expect } from 'vitest';
import { TITLES, FRAMES, BADGES } from '../../src/data/titles.js';

// Pure cosmetic tables — validate shape so a bad edit fails CI, not a player's HUD.
describe('TITLES', () => {
  it('is a non-empty list of { id, text } with unique string ids', () => {
    expect(Array.isArray(TITLES)).toBe(true);
    expect(TITLES.length).toBeGreaterThan(0);
    const ids = new Set();
    for (const t of TITLES) {
      expect(typeof t.id).toBe('string');
      expect(t.id.length).toBeGreaterThan(0);
      expect(typeof t.text).toBe('string');
      expect(t.text.length).toBeGreaterThan(0);
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
    }
  });
});

describe('FRAMES and BADGES', () => {
  it('each carry a unique id, a placeholder sprite key, and a numeric tier', () => {
    for (const table of [FRAMES, BADGES]) {
      expect(Array.isArray(table)).toBe(true);
      expect(table.length).toBeGreaterThan(0);
      const ids = new Set();
      for (const c of table) {
        expect(typeof c.id).toBe('string');
        expect(typeof c.sprite).toBe('string');
        expect(c.sprite.length).toBeGreaterThan(0);
        expect(Number.isInteger(c.tier)).toBe(true);
        expect(c.tier).toBeGreaterThan(0);
        expect(ids.has(c.id)).toBe(false);
        ids.add(c.id);
      }
    }
  });
});
