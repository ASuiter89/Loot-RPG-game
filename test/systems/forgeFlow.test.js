import { describe, it, expect } from 'vitest';
import { forgeStage, forgeSections } from '../../src/systems/forgeFlow.js';

describe('forgeStage — progressive reveal order', () => {
  it('shows only the item type when nothing is picked', () => {
    expect(forgeStage({ slot: null, cat: null, base: null, isWeapon: false })).toBe('type');
    expect(forgeStage({ slot: null, cat: null, base: null, isWeapon: true })).toBe('type');
  });

  it('reveals the weapon category picker once a weapon slot is picked', () => {
    expect(forgeStage({ slot: 'weapon', cat: null, base: null, isWeapon: true })).toBe('category');
  });

  it('reveals the weapon type list once a category is picked', () => {
    expect(forgeStage({ slot: 'weapon', cat: 'Sword', base: null, isWeapon: true })).toBe('base');
  });

  it('goes straight to the base list for a non-weapon slot (no category step)', () => {
    expect(forgeStage({ slot: 'head', cat: null, base: null, isWeapon: false })).toBe('base');
  });

  it('reaches the ready stage only once a base is chosen', () => {
    expect(forgeStage({ slot: 'weapon', cat: 'Sword', base: 'Longsword', isWeapon: true })).toBe('ready');
    expect(forgeStage({ slot: 'head', cat: null, base: 'Helm', isWeapon: false })).toBe('ready');
  });
});

describe('forgeSections — which sections draw', () => {
  it('opens with only the item-type picker', () => {
    const s = forgeSections({ slot: null, cat: null, base: null, isWeapon: false });
    expect(s.stage).toBe('type');
    expect(s.itemType).toBe(true);
    expect(s.weaponCats).toBe(false);
    expect(s.weaponTypes).toBe(false);
    expect(s.baseList).toBe(false);
    expect(s.rarity).toBe(false);
  });

  it('a weapon slot reveals categories but not yet the type list or rarity', () => {
    const s = forgeSections({ slot: 'weapon', cat: null, base: null, isWeapon: true });
    expect(s.weaponCats).toBe(true);
    expect(s.weaponTypes).toBe(false);
    expect(s.baseList).toBe(false);
    expect(s.rarity).toBe(false);
  });

  it('a weapon category reveals the type list, still no rarity', () => {
    const s = forgeSections({ slot: 'weapon', cat: 'Sword', base: null, isWeapon: true });
    expect(s.weaponCats).toBe(true);
    expect(s.weaponTypes).toBe(true);
    expect(s.rarity).toBe(false);
  });

  it('a non-weapon slot reveals a flat base list, no weapon grids', () => {
    const s = forgeSections({ slot: 'ring', cat: null, base: null, isWeapon: false });
    expect(s.baseList).toBe(true);
    expect(s.weaponCats).toBe(false);
    expect(s.weaponTypes).toBe(false);
    expect(s.rarity).toBe(false);
  });

  it('picking a base reveals rarity + preview + forge for a weapon', () => {
    const s = forgeSections({ slot: 'weapon', cat: 'Sword', base: 'Longsword', isWeapon: true });
    expect(s.weaponCats).toBe(true);
    expect(s.weaponTypes).toBe(true);
    expect(s.rarity).toBe(true);
  });

  it('picking a base reveals rarity + preview + forge for a non-weapon', () => {
    const s = forgeSections({ slot: 'chest', cat: null, base: 'Plate', isWeapon: false });
    expect(s.baseList).toBe(true);
    expect(s.rarity).toBe(true);
  });
});
