import { describe, it, expect } from 'vitest';
import { HUD_UPGRADES, HUD_UPGRADE_GROUPS } from '../../src/data/hudUpgrades.js';

// The pieces the Craftsman's Field Kit crafts. This test pins the shape of the
// catalog — the shell gates a real HUD element / loot-bag behaviour on each `key`,
// so a typo'd or duplicated key would silently strand a piece with no way to switch
// it on.

// The piece each key gates, mirrored from the game shell: the seven HUD-overlay
// readouts (updateBars / drawMinimap / renderStatusStrip) plus the four loot-bag
// tools (itemPowerBadge / statDiffLine / sort-filter controls / acquireLoot).
const GATED_KEYS = new Set([
  'vitals', 'floor', 'foes', 'difficulty', 'chests', 'status', 'minimap',
  'rankings', 'compare', 'sortfilter', 'autoloot',
]);
// The bench sections each upgrade may list under.
const GROUP_IDS = new Set(HUD_UPGRADE_GROUPS.map((g) => g.id));

describe('HUD_UPGRADES catalog', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(HUD_UPGRADES)).toBe(true);
    expect(HUD_UPGRADES.length).toBeGreaterThan(0);
  });

  it('covers exactly the HUD pieces the shell gates — no key missing or unknown', () => {
    const keys = HUD_UPGRADES.map((u) => u.key);
    expect(new Set(keys)).toEqual(GATED_KEYS);
  });

  it('has no duplicate keys', () => {
    const keys = HUD_UPGRADES.map((u) => u.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every entry a well-formed shape (name, icon, desc, group, positive integer price)', () => {
    for (const u of HUD_UPGRADES) {
      expect(typeof u.key).toBe('string');
      expect(u.key.length).toBeGreaterThan(0);
      expect(typeof u.name).toBe('string');
      expect(u.name.length).toBeGreaterThan(0);
      expect(typeof u.icon).toBe('string');
      expect(u.icon.length).toBeGreaterThan(0);
      expect(typeof u.hud).toBe('string');
      expect(u.hud.length).toBeGreaterThan(0);
      expect(typeof u.desc).toBe('string');
      expect(u.desc.length).toBeGreaterThan(0);
      expect(GROUP_IDS.has(u.group)).toBe(true);
      expect(Number.isInteger(u.price)).toBe(true);
      expect(u.price).toBeGreaterThan(0);
    }
  });

  it('lists the instruments cheapest-first within each bench group', () => {
    // The bench renders one section per group (readouts, then bag tools); each
    // section reads cheapest → priciest, so ordering is checked per group, not
    // across the whole array.
    for (const g of HUD_UPGRADE_GROUPS) {
      const prices = HUD_UPGRADES.filter((u) => u.group === g.id).map((u) => u.price);
      const sorted = prices.slice().sort((a, b) => a - b);
      expect(prices).toEqual(sorted);
    }
  });

  it('assigns every catalog entry to a real bench group', () => {
    // Every group listed must own at least one upgrade, and every upgrade must sit
    // in a listed group — so the bench never renders an empty or orphaned section.
    const used = new Set(HUD_UPGRADES.map((u) => u.group));
    for (const g of HUD_UPGRADE_GROUPS) expect(used.has(g.id)).toBe(true);
    for (const id of used) expect(GROUP_IDS.has(id)).toBe(true);
  });

  it('never uses an emoji as an icon (real atlas sprite keys only)', () => {
    // Sprite keys are ASCII slugs; an emoji standing in for the asset would break
    // the pixel-art rule and fail to resolve in dlIcon().
    for (const u of HUD_UPGRADES) expect(/^[a-z0-9_]+$/i.test(u.icon)).toBe(true);
  });
});
