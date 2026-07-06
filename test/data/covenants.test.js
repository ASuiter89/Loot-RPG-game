import { describe, it, expect } from 'vitest';
import { COVENANTS, DREAD_TUNING } from '../../src/data/covenants.js';

const CATEGORIES = new Set(['offense', 'defense', 'swarm', 'tempo', 'elite']);

describe('COVENANTS catalog', () => {
  it('has 14–16 covenants', () => {
    expect(COVENANTS.length).toBeGreaterThanOrEqual(14);
    expect(COVENANTS.length).toBeLessThanOrEqual(16);
  });

  it('every id is unique and non-empty', () => {
    const ids = COVENANTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(typeof id === 'string' && id.length).toBeTruthy();
  });

  it('every def has a name, plain desc, sprite key and valid category', () => {
    for (const c of COVENANTS) {
      expect(typeof c.name).toBe('string');
      expect(c.name.length).toBeGreaterThan(0);
      expect(typeof c.desc).toBe('string');
      expect(c.desc.length).toBeGreaterThan(0);
      expect(typeof c.sprite).toBe('string');
      expect(c.sprite.length).toBeGreaterThan(0);
      expect(CATEGORIES.has(c.category)).toBe(true);
    }
  });

  it('desc never references other games / genre jargon (player-facing copy rule)', () => {
    const banned = /diablo|golden sun|roguelike|risk of rain|ror2|poe|path of exile/i;
    for (const c of COVENANTS) expect(banned.test(c.desc)).toBe(false);
  });

  it('dread is an integer in 1..6', () => {
    for (const c of COVENANTS) {
      expect(Number.isInteger(c.dread)).toBe(true);
      expect(c.dread).toBeGreaterThanOrEqual(1);
      expect(c.dread).toBeLessThanOrEqual(6);
    }
  });

  it('unlockOrder is a non-negative integer and the first few are 0 (starter curses)', () => {
    for (const c of COVENANTS) {
      expect(Number.isInteger(c.unlockOrder)).toBe(true);
      expect(c.unlockOrder).toBeGreaterThanOrEqual(0);
    }
    expect(COVENANTS.filter((c) => c.unlockOrder === 0).length).toBeGreaterThanOrEqual(2);
  });

  it('is ordered so unlockOrder AND dread are both non-decreasing (a clean ramp)', () => {
    for (let i = 1; i < COVENANTS.length; i++) {
      expect(COVENANTS[i].unlockOrder).toBeGreaterThanOrEqual(COVENANTS[i - 1].unlockOrder);
      expect(COVENANTS[i].dread).toBeGreaterThanOrEqual(COVENANTS[i - 1].dread);
    }
  });

  it('spreads across all five categories', () => {
    const seen = new Set(COVENANTS.map((c) => c.category));
    for (const cat of CATEGORIES) expect(seen.has(cat)).toBe(true);
  });

  it('every param a covenant sets is a real affliction knob within its legal range', () => {
    const KNOWN = new Set(Object.keys(DREAD_TUNING.neutralParams));
    for (const c of COVENANTS) {
      const p = c.params || {};
      expect(Object.keys(p).length).toBeGreaterThan(0); // must actually do something
      for (const k in p) {
        expect(KNOWN.has(k)).toBe(true);
        const v = p[k];
        expect(typeof v).toBe('number');
        expect(Number.isFinite(v)).toBe(true);
        if (k === 'healingMult') { expect(v).toBeGreaterThan(0); expect(v).toBeLessThanOrEqual(1); }
        else if (k === 'eliteChanceAdd') { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
        else if (k === 'malaiseRate') { expect(v).toBeGreaterThanOrEqual(0); }
        else { expect(v).toBeGreaterThanOrEqual(1); } // all the *Mult knobs
      }
    }
  });

  it('is mitigable pressure, never a hard lockout (no zeroing knob)', () => {
    // No covenant nulls the hero out: healing is always > 0, no multiplier is 0.
    for (const c of COVENANTS) {
      const p = c.params || {};
      for (const k in p) expect(p[k]).not.toBe(0);
      if ('healingMult' in p) expect(p.healingMult).toBeGreaterThan(0);
    }
  });

  it('at least one tempo covenant carries a malaiseRate, and non-tempo ones do not', () => {
    const tempoWithRamp = COVENANTS.filter((c) => c.category === 'tempo' && (c.params.malaiseRate || 0) > 0);
    expect(tempoWithRamp.length).toBeGreaterThanOrEqual(1);
    for (const c of COVENANTS) {
      if (c.category !== 'tempo') expect(c.params.malaiseRate || 0).toBe(0);
    }
  });
});

describe('DREAD_TUNING', () => {
  it('neutralParams is a full, no-op baseline', () => {
    const N = DREAD_TUNING.neutralParams;
    expect(N.enemyHpMult).toBe(1);
    expect(N.enemyDmgMult).toBe(1);
    expect(N.densityMult).toBe(1);
    expect(N.healingMult).toBe(1);
    expect(N.dropQtyMult).toBe(1);
    expect(N.rarityMult).toBe(1);
    expect(N.bossPointMult).toBe(1);
    expect(N.eliteChanceAdd).toBe(0);
    expect(N.malaiseRate).toBe(0);
  });

  it('clamps summed elite chance below a certainty', () => {
    expect(DREAD_TUNING.maxEliteChance).toBeGreaterThan(0);
    expect(DREAD_TUNING.maxEliteChance).toBeLessThan(1);
  });
});
