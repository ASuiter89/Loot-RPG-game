import { describe, it, expect } from 'vitest';
import { isSsf, walletGain, walletSpend } from '../../src/systems/ssf.js';

const KEYS = ['scrap', 'glimmer', 'core', 'chaos'];

describe('isSsf', () => {
  it('is true only for a player flagged ssf', () => {
    expect(isSsf({ ssf: true })).toBe(true);
    expect(isSsf({ ssf: false })).toBe(false);
    expect(isSsf({})).toBe(false);        // pre-SSF saves carry no flag at all
    expect(isSsf(null)).toBe(false);
    expect(isSsf(undefined)).toBe(false);
  });
});

describe('walletGain', () => {
  it('adds to an existing count and creates a missing key', () => {
    const w = { scrap: 3 };
    walletGain(w, 'scrap', 2);
    walletGain(w, 'core', 1);
    expect(w).toEqual({ scrap: 5, core: 1 });
  });

  it('returns the wallet it mutated', () => {
    const w = {};
    expect(walletGain(w, 'chaos', 1)).toBe(w);
  });

  it('floors fractional amounts and ignores zero/negative/NaN', () => {
    const w = { scrap: 4 };
    walletGain(w, 'scrap', 2.9);           // → +2
    expect(w.scrap).toBe(6);
    walletGain(w, 'scrap', 0);
    walletGain(w, 'scrap', -5);
    walletGain(w, 'scrap', NaN);
    walletGain(w, 'scrap', undefined);
    expect(w.scrap).toBe(6);
    expect(w.glimmer).toBeUndefined();     // no phantom key from a no-op gain
  });
});

describe('walletSpend', () => {
  it('subtracts each material component of a mixed cost', () => {
    const w = { scrap: 10, glimmer: 4, core: 2, chaos: 1 };
    const spent = walletSpend(w, { gold: 500, scrap: 6, glimmer: 1 }, KEYS);
    expect(spent).toBe(true);
    expect(w).toEqual({ scrap: 4, glimmer: 3, core: 2, chaos: 1 }); // gold untouched — not a wallet key
  });

  it('clamps at zero instead of going negative', () => {
    const w = { scrap: 2 };
    walletSpend(w, { scrap: 5 }, KEYS);
    expect(w.scrap).toBe(0);
  });

  it('reports false for a gold-only or empty cost (nothing to persist)', () => {
    const w = { scrap: 3 };
    expect(walletSpend(w, { gold: 100 }, KEYS)).toBe(false);
    expect(walletSpend(w, {}, KEYS)).toBe(false);
    expect(w.scrap).toBe(3);
  });

  it('ignores negative/NaN cost components', () => {
    const w = { scrap: 3, core: 1 };
    expect(walletSpend(w, { scrap: -2, core: NaN }, KEYS)).toBe(false);
    expect(w).toEqual({ scrap: 3, core: 1 });
  });
});
