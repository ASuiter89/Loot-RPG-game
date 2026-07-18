import { describe, it, expect } from 'vitest';
import { armorWeight, favouredBases, rollFavouredBase, rollForcedFavouredBase, CLASS_BASE_BIAS, ARMOR_HEAVY_DEF }
  from '../../src/systems/classLoot.js';

// Tiny stand-ins mirroring the game's real data shape, so the lean can be checked
// without dragging in the legacy globals.
const WEAPON_NAMES = ['Greatsword', 'Dagger', 'Staff', 'Wand', 'Longbow'];
const WEAPON_CAT = { Greatsword: 'Sword', Dagger: 'Dagger', Staff: 'Staff', Wand: 'Staff', Longbow: 'Bow' };
const OFFHAND_NAMES = ['Tower Shield', 'Tome', 'Focus', 'Quiver', 'Parrying Dagger'];
const OFFHAND_FAM = { 'Tower Shield': 'shield', Tome: 'caster', Focus: 'caster', Quiver: 'ranged', 'Parrying Dagger': 'dual' };
const CHEST_NAMES = ['Chestplate', 'Robe', 'Cuirass', 'Tunic', 'Mail'];
const CHEST_DEF = { Chestplate: 1.30, Robe: 0.70, Cuirass: 1.10, Tunic: 0.85, Mail: 1.15 };

const lookups = {
  categoryOf: n => WEAPON_CAT[n],
  familyOf: n => OFFHAND_FAM[n],
  weightOf: n => armorWeight(CHEST_DEF[n]),
};

const MAGE = { weapons: ['Staff', 'Dagger'], offhands: ['caster'], armor: 'light' };
const WARRIOR = { weapons: ['Sword', 'Axe'], offhands: ['shield'], armor: 'heavy' };

describe('armorWeight', () => {
  it('reads a base at or above the heavy threshold as heavy', () => {
    expect(armorWeight(ARMOR_HEAVY_DEF)).toBe('heavy');
    expect(armorWeight(1.30)).toBe('heavy');
  });
  it('reads a lighter base as light', () => {
    expect(armorWeight(0.70)).toBe('light');
    expect(armorWeight(1.09)).toBe('light');
  });
  it('treats a base with no DEF (weapon / off-hand / jewellery) as light', () => {
    expect(armorWeight(undefined)).toBe('light');
  });
});

describe('favouredBases', () => {
  it('leans a Mage weapon roll to its favoured categories, incl. Wand (a Staff)', () => {
    expect(favouredBases('weapon', WEAPON_NAMES, MAGE, lookups)).toEqual(['Dagger', 'Staff', 'Wand']);
  });
  it('leans a Mage off-hand to caster families (tome/focus, not quiver/shield)', () => {
    expect(favouredBases('offhand', OFFHAND_NAMES, MAGE, lookups)).toEqual(['Tome', 'Focus']);
  });
  it('leans a Mage chest to light bases (robe/tunic, not plate)', () => {
    expect(favouredBases('chest', CHEST_NAMES, MAGE, lookups)).toEqual(['Robe', 'Tunic']);
  });
  it('leans a Warrior toward shields and heavy plate', () => {
    expect(favouredBases('offhand', OFFHAND_NAMES, WARRIOR, lookups)).toEqual(['Tower Shield']);
    expect(favouredBases('chest', CHEST_NAMES, WARRIOR, lookups)).toEqual(['Chestplate', 'Cuirass', 'Mail']);
  });
  it('has no lean for jewellery — every class wears it the same', () => {
    expect(favouredBases('ring', ['Ring', 'Band'], MAGE, lookups)).toEqual([]);
    expect(favouredBases('amulet', ['Amulet', 'Charm'], WARRIOR, lookups)).toEqual([]);
  });
  it('returns no lean when there is no class or the class omits a pref', () => {
    expect(favouredBases('weapon', WEAPON_NAMES, null, lookups)).toEqual([]);
    expect(favouredBases('offhand', OFFHAND_NAMES, { weapons: ['Staff'] }, lookups)).toEqual([]);
  });
});

describe('rollFavouredBase', () => {
  // rng is consumed in order: first draw is the bias gate, second is the pick.
  const seq = (...vals) => { let i = 0; return () => vals[i++]; };

  it('picks from the favoured set when the gate roll is under the bias', () => {
    const rng = seq(CLASS_BASE_BIAS - 0.01, 0); // gate passes, pick index 0
    expect(rollFavouredBase(['a', 'b', 'c'], ['x', 'y'], rng)).toBe('x');
  });
  it('picks from the full list when the gate roll meets or exceeds the bias', () => {
    const rng = seq(CLASS_BASE_BIAS, 0.99); // gate fails, pick last of full list
    expect(rollFavouredBase(['a', 'b', 'c'], ['x', 'y'], rng)).toBe('c');
  });
  it('falls back to a plain random pick when nothing is favoured', () => {
    let calls = 0;
    const rng = () => { calls++; return 0.5; }; // only the pick draw should run
    expect(rollFavouredBase(['a', 'b', 'c'], [], rng)).toBe('b');
    expect(calls).toBe(1); // no wasted gate draw when there is no favoured set
  });
});

describe('rollForcedFavouredBase', () => {
  it('ALWAYS picks from the favoured set — no bias gate to fall through', () => {
    // Even an rng that would fail rollFavouredBase's gate every time still lands
    // inside the favoured pool, and consumes a single draw (the pick).
    let calls = 0;
    const rng = () => { calls++; return 0.99; };
    expect(rollForcedFavouredBase(['a', 'b', 'c'], ['x', 'y'], rng)).toBe('y');
    expect(calls).toBe(1);
  });
  it('picks each favoured entry by index off the one draw', () => {
    expect(rollForcedFavouredBase(['a', 'b', 'c'], ['x', 'y', 'z'], () => 0)).toBe('x');
    expect(rollForcedFavouredBase(['a', 'b', 'c'], ['x', 'y', 'z'], () => 0.5)).toBe('y');
  });
  it('falls back to the full list when the class favours nothing', () => {
    expect(rollForcedFavouredBase(['a', 'b', 'c'], [], () => 0.5)).toBe('b');
    expect(rollForcedFavouredBase(['a', 'b', 'c'], null, () => 0)).toBe('a');
  });
});
