import { describe, it, expect } from 'vitest';
import {
  fieldRevealThreshold, isBestiaryFieldKnown, speciesDiscovered, bestiaryRevealRatio,
  emptyDex, sanitizeDex, deeperSpecimen, foldLegacyBestiary, recordKill,
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

describe('account-wide bestiary ledger', () => {
  it('emptyDex is a fresh, isolated ledger', () => {
    const a = emptyDex(), b = emptyDex();
    expect(a).toEqual({ kills: {}, lore: {}, ts: 0 });
    a.kills.rat = 1;
    expect(b.kills.rat).toBeUndefined(); // not a shared reference
  });

  it('sanitizeDex coerces / drops garbage', () => {
    expect(sanitizeDex(null)).toEqual({ kills: {}, lore: {}, ts: 0 });
    expect(sanitizeDex('nope')).toEqual({ kills: {}, lore: {}, ts: 0 });
    const d = sanitizeDex({
      kills: { rat: 5, bad: -2, nan: 'x', frac: 3.9 },
      lore: { rat: { level: 12, hp: 100, dmg: 8, armor: 10, mres: 5 }, junk: 7, empty: null },
      ts: 42,
    });
    expect(d.kills).toEqual({ rat: 5, frac: 3 }); // floors, drops <=0 and NaN
    expect(d.lore.rat).toEqual({ level: 12, hp: 100, dmg: 8, armor: 10, mres: 5 });
    expect(d.lore.junk).toBeUndefined();
    expect(d.lore.empty).toBeUndefined();
    expect(d.ts).toBe(42);
  });

  it('sanitizeDex repairs a malformed ts and non-finite lore numbers', () => {
    const d = sanitizeDex({ kills: {}, lore: { rat: { level: Infinity, hp: NaN } }, ts: -1 });
    expect(d.ts).toBe(0);
    expect(d.lore.rat).toEqual({ level: 0, hp: 0, dmg: 0, armor: 0, mres: 0 });
  });

  it('deeperSpecimen keeps the higher level (ties keep incumbent)', () => {
    const shallow = { level: 3, hp: 30, dmg: 4, armor: 1, mres: 0 };
    const deep = { level: 9, hp: 90, dmg: 12, armor: 5, mres: 3 };
    expect(deeperSpecimen(null, shallow)).toEqual(shallow);
    expect(deeperSpecimen(shallow, null)).toEqual(shallow);
    expect(deeperSpecimen(shallow, deep)).toEqual(deep);
    expect(deeperSpecimen(deep, shallow)).toEqual(deep); // shallower ignored
    expect(deeperSpecimen(shallow, { level: 3, hp: 999 }).hp).toBe(999); // tie -> take newest
    expect(deeperSpecimen(null, null)).toBe(null);
  });

  it('foldLegacyBestiary SUMs kills and keeps the deeper lore', () => {
    const dex = emptyDex();
    foldLegacyBestiary(dex, { rat: 4, bat: 2 }, { rat: { level: 5, hp: 50 } });
    foldLegacyBestiary(dex, { rat: 3, wolf: 1 }, { rat: { level: 9, hp: 90 }, wolf: { level: 7 } });
    expect(dex.kills).toEqual({ rat: 7, bat: 2, wolf: 1 }); // 4+3 cumulative
    expect(dex.lore.rat.level).toBe(9); // deeper of the two
    expect(dex.lore.wolf.level).toBe(7);
  });

  it('foldLegacyBestiary tolerates missing maps', () => {
    const dex = emptyDex();
    expect(() => foldLegacyBestiary(dex, undefined, undefined)).not.toThrow();
    expect(dex).toEqual(emptyDex());
  });

  it('recordKill increments the count and tracks the deepest specimen', () => {
    const dex = emptyDex();
    recordKill(dex, 'rat', { level: 3, hp: 30, dmg: 4, armor: 1, mres: 0 });
    recordKill(dex, 'rat', { level: 8, hp: 80, dmg: 9, armor: 4, mres: 2 });
    recordKill(dex, 'rat', { level: 2, hp: 20, dmg: 3, armor: 0, mres: 0 }); // shallower
    expect(dex.kills.rat).toBe(3);
    expect(dex.lore.rat.level).toBe(8); // deepest of the three
  });

  it('recordKill works without a specimen (boss/legacy foe)', () => {
    const dex = emptyDex();
    recordKill(dex, 'ratking', null);
    expect(dex.kills.ratking).toBe(1);
    expect(dex.lore.ratking).toBeUndefined();
  });
});
