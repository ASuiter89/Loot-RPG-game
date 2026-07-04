import { describe, it, expect } from 'vitest';
import { ENEMY_RESIST, DEFAULT_RESIST, RESIST_CAP, resistFor } from '../../src/data/enemyDefense.js';

const entries = Object.entries(ENEMY_RESIST);

describe('ENEMY_RESIST table', () => {
  it('covers the whole roster (161 monsters + 5 bosses)', () => {
    expect(entries.length).toBe(166);
  });

  it('every entry has numeric phys + magic in a sane range', () => {
    for (const [id, r] of entries) {
      expect(typeof r.phys, id).toBe('number');
      expect(typeof r.magic, id).toBe('number');
      expect(r.phys, id).toBeGreaterThanOrEqual(0.35);
      expect(r.phys, id).toBeLessThanOrEqual(2.5);
      expect(r.magic, id).toBeGreaterThanOrEqual(0.35);
      expect(r.magic, id).toBeLessThanOrEqual(2.5);
    }
  });

  it('keeps overall difficulty ~flat: per-enemy average stays near 1', () => {
    for (const [id, r] of entries) {
      const avg = (r.phys + r.magic) / 2;
      expect(avg, id).toBeGreaterThanOrEqual(0.6);
      expect(avg, id).toBeLessThanOrEqual(1.35);
    }
  });

  it('spans a real spread — not everything balanced (rock-paper-scissors)', () => {
    let phys = 0, magic = 0, bal = 0;
    for (const [, r] of entries) {
      const d = r.phys - r.magic;
      if (d > 0.25) phys++; else if (d < -0.25) magic++; else bal++;
    }
    // each bucket meaningfully represented
    expect(phys).toBeGreaterThan(30);
    expect(magic).toBeGreaterThan(30);
    expect(bal).toBeGreaterThan(15);
  });

  it('models the archetypes: constructs resist physical, incorporeals resist magic', () => {
    // a stone/metal construct: high phys, low magic
    expect(ENEMY_RESIST.irongolem.phys).toBeGreaterThan(1.4);
    expect(ENEMY_RESIST.irongolem.magic).toBeLessThan(0.7);
    // an incorporeal spirit: low phys, high magic
    expect(ENEMY_RESIST.wraith.phys).toBeLessThan(0.7);
    expect(ENEMY_RESIST.wraith.magic).toBeGreaterThan(1.4);
  });
});

describe('resistFor', () => {
  it('returns the stored profile for a known type', () => {
    expect(resistFor('irongolem')).toBe(ENEMY_RESIST.irongolem);
  });
  it('falls back to the balanced default for an unknown/blank type', () => {
    expect(resistFor('nonexistent_foe')).toBe(DEFAULT_RESIST);
    expect(resistFor(null)).toBe(DEFAULT_RESIST);
    expect(resistFor(undefined)).toBe(DEFAULT_RESIST);
  });
  it('DEFAULT_RESIST is neutral', () => {
    expect(DEFAULT_RESIST).toEqual({ phys: 1, magic: 1 });
  });
  it('RESIST_CAP is a sane ceiling', () => {
    expect(RESIST_CAP).toBeGreaterThan(0.4);
    expect(RESIST_CAP).toBeLessThan(1);
  });
});
