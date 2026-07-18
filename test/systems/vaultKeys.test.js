import { describe, it, expect } from 'vitest';
import { hasVaultKey, addVaultKey, spendVaultKey } from '../../src/systems/vaultKeys.js';

describe('vaultKeys', () => {
  describe('hasVaultKey', () => {
    it('is true only when at least one key is carried', () => {
      expect(hasVaultKey(0)).toBe(false);
      expect(hasVaultKey(1)).toBe(true);
      expect(hasVaultKey(5)).toBe(true);
    });

    it('treats garbage / negative counts as none', () => {
      expect(hasVaultKey(undefined)).toBe(false);
      expect(hasVaultKey(null)).toBe(false);
      expect(hasVaultKey(-3)).toBe(false);
      expect(hasVaultKey(NaN)).toBe(false);
    });
  });

  describe('addVaultKey', () => {
    it('increments the carried count', () => {
      expect(addVaultKey(0)).toBe(1);
      expect(addVaultKey(2)).toBe(3);
    });

    it('seeds from garbage as if the count were zero', () => {
      expect(addVaultKey(undefined)).toBe(1);
      expect(addVaultKey(null)).toBe(1);
      expect(addVaultKey(-4)).toBe(1);
    });

    it('lets keys stockpile across repeated pickups', () => {
      let keys = 0;
      for (let i = 1; i <= 4; i++) keys = addVaultKey(keys);
      expect(keys).toBe(4);
    });
  });

  describe('spendVaultKey', () => {
    it('spends one key and reports the door opened', () => {
      expect(spendVaultKey(1)).toEqual({ keys: 0, opened: true });
      expect(spendVaultKey(3)).toEqual({ keys: 2, opened: true });
    });

    it('leaves the count untouched and reports no open when empty', () => {
      expect(spendVaultKey(0)).toEqual({ keys: 0, opened: false });
      expect(spendVaultKey(undefined)).toEqual({ keys: 0, opened: false });
      expect(spendVaultKey(-2)).toEqual({ keys: 0, opened: false });
    });

    it('round-trips: a picked-up key opens exactly one door', () => {
      let keys = addVaultKey(0);        // find a key
      const first = spendVaultKey(keys); // open a door
      expect(first).toEqual({ keys: 0, opened: true });
      const second = spendVaultKey(first.keys); // try another with none left
      expect(second).toEqual({ keys: 0, opened: false });
    });
  });
});
