import { describe, it, expect } from 'vitest';
import {
  HUD_UPGRADE_KEYS,
  hudUpgradeById,
  hudUpgradeCost,
  hudOwns,
  allHudUpgradesOwned,
  hudUpgradesOwnedCount,
} from '../../src/systems/hudUpgrades.js';
import { HUD_UPGRADES } from '../../src/data/hudUpgrades.js';

describe('HUD_UPGRADE_KEYS', () => {
  it('mirrors the catalog keys in order', () => {
    expect(HUD_UPGRADE_KEYS).toEqual(HUD_UPGRADES.map((u) => u.key));
  });
});

describe('hudUpgradeById', () => {
  it('returns the entry for a known key', () => {
    const u = hudUpgradeById('minimap');
    expect(u && u.key).toBe('minimap');
  });
  it('returns null for an unknown key', () => {
    expect(hudUpgradeById('nope')).toBe(null);
  });
  it('tolerates a non-array catalog', () => {
    // `null`/a number bypass the array guard and return null; `undefined` falls
    // through to the default (shipped) catalog, so it still resolves the entry.
    expect(hudUpgradeById('minimap', null)).toBe(null);
    expect(hudUpgradeById('minimap', 42)).toBe(null);
    expect(hudUpgradeById('minimap', undefined) && hudUpgradeById('minimap', undefined).key).toBe('minimap');
  });
});

describe('hudUpgradeCost', () => {
  it('returns the catalog price for a known key', () => {
    for (const u of HUD_UPGRADES) expect(hudUpgradeCost(u.key)).toBe(u.price);
  });
  it('is 0 for an unknown key', () => {
    expect(hudUpgradeCost('nope')).toBe(0);
  });
  it('floors and rejects a non-positive / malformed price', () => {
    const catalog = [{ key: 'a', price: 12.9 }, { key: 'b', price: -5 }, { key: 'c', price: 'x' }, { key: 'd' }];
    expect(hudUpgradeCost('a', catalog)).toBe(12);
    expect(hudUpgradeCost('b', catalog)).toBe(0);
    expect(hudUpgradeCost('c', catalog)).toBe(0);
    expect(hudUpgradeCost('d', catalog)).toBe(0);
  });
});

describe('hudOwns', () => {
  it('reads a truthy flag from the owned-map', () => {
    expect(hudOwns({ minimap: true }, 'minimap')).toBe(true);
    expect(hudOwns({ minimap: true }, 'foes')).toBe(false);
    expect(hudOwns({ foes: false }, 'foes')).toBe(false);
  });
  it('treats a missing / non-object map as owning nothing', () => {
    expect(hudOwns(null, 'minimap')).toBe(false);
    expect(hudOwns(undefined, 'minimap')).toBe(false);
    expect(hudOwns('nope', 'minimap')).toBe(false);
    expect(hudOwns({}, 'minimap')).toBe(false);
  });
});

describe('allHudUpgradesOwned', () => {
  it('grants every catalog key (the pre-Field-Kit migration seed)', () => {
    const owned = allHudUpgradesOwned();
    for (const u of HUD_UPGRADES) expect(owned[u.key]).toBe(true);
    expect(Object.keys(owned).length).toBe(HUD_UPGRADES.length);
    // Every catalog element reads as owned under this seed.
    for (const u of HUD_UPGRADES) expect(hudOwns(owned, u.key)).toBe(true);
  });
  it('tolerates a bad catalog', () => {
    expect(allHudUpgradesOwned(null)).toEqual({});
  });
});

describe('hudUpgradesOwnedCount', () => {
  it('counts only real catalog keys that are owned', () => {
    expect(hudUpgradesOwnedCount({})).toBe(0);
    expect(hudUpgradesOwnedCount(allHudUpgradesOwned())).toBe(HUD_UPGRADES.length);
    expect(hudUpgradesOwnedCount({ minimap: true, foes: true, bogus: true })).toBe(2);
  });
  it('treats a missing map as zero', () => {
    expect(hudUpgradesOwnedCount(null)).toBe(0);
  });
  it('tolerates a non-array catalog', () => {
    expect(hudUpgradesOwnedCount({ minimap: true }, null)).toBe(0);
  });
});
