import { describe, it, expect } from 'vitest';
import {
  HUD_UPGRADE_KEYS,
  HUD_COST_KEYS,
  hudUpgradeById,
  hudUpgradeCost,
  hudUpgradeCostOf,
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

describe('HUD_COST_KEYS', () => {
  it('lists gold plus the crafting materials in wallet order', () => {
    expect(HUD_COST_KEYS).toEqual(['gold', 'scrap', 'glimmer', 'core', 'chaos']);
  });
});

describe('hudUpgradeCostOf', () => {
  it('returns the catalog cost object for a known key', () => {
    for (const u of HUD_UPGRADES) expect(hudUpgradeCostOf(u.key)).toEqual(u.cost);
  });
  it('is an empty object for an unknown key', () => {
    expect(hudUpgradeCostOf('nope')).toEqual({});
  });
  it('keeps only positive integer components, flooring fractions', () => {
    const catalog = [
      { key: 'a', cost: { gold: 120.9, scrap: 10, glimmer: 0, core: -2, chaos: 'x' } },
      { key: 'b', cost: {} },
      { key: 'c' },
      { key: 'd', cost: { gold: 0 } },
    ];
    expect(hudUpgradeCostOf('a', catalog)).toEqual({ gold: 120, scrap: 10 });
    expect(hudUpgradeCostOf('b', catalog)).toEqual({});
    expect(hudUpgradeCostOf('c', catalog)).toEqual({});
    expect(hudUpgradeCostOf('d', catalog)).toEqual({});
  });
});

describe('hudUpgradeCost', () => {
  it('returns the gold component of a known key', () => {
    for (const u of HUD_UPGRADES) expect(hudUpgradeCost(u.key)).toBe(u.cost.gold);
  });
  it('is 0 for an unknown key', () => {
    expect(hudUpgradeCost('nope')).toBe(0);
  });
  it('floors and rejects a non-positive / malformed gold', () => {
    const catalog = [{ key: 'a', cost: { gold: 12.9 } }, { key: 'b', cost: { gold: -5 } }, { key: 'c', cost: { gold: 'x' } }, { key: 'd' }];
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
