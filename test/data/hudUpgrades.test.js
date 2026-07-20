import { describe, it, expect } from 'vitest';
import { HUD_UPGRADES, HUD_UPGRADE_GROUPS } from '../../src/data/hudUpgrades.js';

// The pieces the Craftsman's Field Kit crafts. This test pins the shape of the
// catalog — the shell gates a real HUD element / loot-bag behaviour on each `key`,
// so a typo'd or duplicated key would silently strand a piece with no way to switch
// it on.

// The piece each key gates, mirrored from the game shell: the eight HUD-overlay
// readouts (updateBars / drawMinimap / renderStatusStrip), the seven loot-bag tools
// (item level/value/salvage yield + itemPowerBadge / statDiffLine / sort-filter
// controls / acquireLoot), and the two character-&-skill sheet readouts
// (heroStatsPanelHTML / skillMilestonesHtml).
const GATED_KEYS = new Set([
  'vitals', 'floor', 'xpnums', 'foes', 'difficulty', 'chests', 'status', 'minimap',
  'ilvl', 'value', 'scrapval', 'rankings', 'compare', 'sortfilter', 'autoloot',
  'statsheet', 'surges',
]);
// The bench sections each upgrade may list under.
const GROUP_IDS = new Set(HUD_UPGRADE_GROUPS.map((g) => g.id));
// The mixed-cost components an upgrade may charge — gold plus the crafting materials,
// mirrored from the shell's wallet (CRAFT_MAT_KEYS + gold).
const COST_KEYS = new Set(['gold', 'scrap', 'glimmer', 'core', 'chaos']);

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

  it('gives every entry a well-formed shape (name, icon, desc, group, mixed cost)', () => {
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
      // cost is a mixed { gold, scrap, glimmer, core, chaos } object — every component
      // is a known key and a positive integer, and a real gold price is always charged.
      expect(u.cost && typeof u.cost).toBe('object');
      expect(Number.isInteger(u.cost.gold)).toBe(true);
      expect(u.cost.gold).toBeGreaterThan(0);
      for (const [k, v] of Object.entries(u.cost)) {
        expect(COST_KEYS.has(k)).toBe(true);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThan(0);
      }
    }
  });

  it('lists the instruments cheapest-first (by gold) within each bench group', () => {
    // The bench renders one section per group (readouts, then bag tools); each
    // section reads cheapest → priciest by gold, so ordering is checked per group,
    // not across the whole array.
    for (const g of HUD_UPGRADE_GROUPS) {
      const golds = HUD_UPGRADES.filter((u) => u.group === g.id).map((u) => u.cost.gold);
      const sorted = golds.slice().sort((a, b) => a - b);
      expect(golds).toEqual(sorted);
    }
  });

  it('draws finer materials for the pricier tools (Core only on the priciest of a group)', () => {
    // The Craftsman's build costs escalate: a Core (a Hardened-difficulty drop) only
    // ever gates the single priciest tool in a group, so no early readout is stranded
    // behind a material the player cannot yet farm.
    for (const g of HUD_UPGRADE_GROUPS) {
      const group = HUD_UPGRADES.filter((u) => u.group === g.id);
      group.forEach((u, i) => {
        if (u.cost.core) expect(i).toBe(group.length - 1);
      });
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
