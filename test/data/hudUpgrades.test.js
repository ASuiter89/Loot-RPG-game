import { describe, it, expect } from 'vitest';
import { HUD_UPGRADES } from '../../src/data/hudUpgrades.js';

// The seven HUD pieces the Merchant's Field Kit reveals. This test pins the shape
// of the catalog — the shell gates a real HUD element on each `key`, so a typo'd or
// duplicated key would silently strand an element with no way to switch it on.

// The HUD element each key gates, mirrored from the game shell (updateBars /
// drawMinimap / renderStatusStrip). Every catalog key MUST be one the shell reads.
const GATED_KEYS = new Set(['vitals', 'floor', 'foes', 'difficulty', 'chests', 'status', 'minimap']);

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

  it('gives every entry a well-formed shape (name, icon, desc, positive integer price)', () => {
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
      expect(Number.isInteger(u.price)).toBe(true);
      expect(u.price).toBeGreaterThan(0);
    }
  });

  it('lists the instruments cheapest-first', () => {
    const prices = HUD_UPGRADES.map((u) => u.price);
    const sorted = prices.slice().sort((a, b) => a - b);
    expect(prices).toEqual(sorted);
  });

  it('never uses an emoji as an icon (real atlas sprite keys only)', () => {
    // Sprite keys are ASCII slugs; an emoji standing in for the asset would break
    // the pixel-art rule and fail to resolve in dlIcon().
    for (const u of HUD_UPGRADES) expect(/^[a-z0-9_]+$/i.test(u.icon)).toBe(true);
  });
});
