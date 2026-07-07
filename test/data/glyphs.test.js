import { describe, it, expect } from 'vitest';
import { GLYPHS } from '../../src/data/glyphs.js';

// Shape / invariant characterization for the glyph tuning. Locks the tier ramp, the
// depth-gate ordering, and the rider list so a future tweak can't (say) leave a tier
// ungated or give a rarer tier a weaker band than a common one.

describe('GLYPHS.tiers', () => {
  it('has five ascending tiers with a colour, reach and a valid value band', () => {
    expect(GLYPHS.tiers).toHaveLength(5);
    for (let i = 0; i < GLYPHS.tiers.length; i++) {
      const t = GLYPHS.tiers[i];
      expect(t.tier).toBe(i + 1);
      expect(typeof t.name).toBe('string');
      expect(t.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(t.radius).toBeGreaterThan(0);
      expect(t.valueBand.min).toBeGreaterThan(0);
      expect(t.valueBand.max).toBeGreaterThanOrEqual(t.valueBand.min);
    }
  });

  it('scales strength and reach monotonically up the tiers', () => {
    for (let i = 1; i < GLYPHS.tiers.length; i++) {
      const lo = GLYPHS.tiers[i - 1];
      const hi = GLYPHS.tiers[i];
      expect(hi.radius).toBeGreaterThanOrEqual(lo.radius);
      expect(hi.valueBand.max).toBeGreaterThan(lo.valueBand.max);
    }
  });
});

describe('GLYPHS.depthGates', () => {
  it('gates every tier, tier 1 always available, deeper tiers deeper-gated', () => {
    expect(GLYPHS.depthGates).toHaveLength(GLYPHS.tiers.length);
    const t1 = GLYPHS.depthGates.find((g) => g.tier === 1);
    expect(t1.minEndlessDepth).toBe(0);
    const sorted = [...GLYPHS.depthGates].sort((a, b) => a.tier - b.tier);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].minEndlessDepth).toBeGreaterThan(sorted[i - 1].minEndlessDepth);
    }
  });
});

describe('GLYPHS.tertiaryBonuses', () => {
  it('is a non-empty list of keyed, labelled riders', () => {
    expect(GLYPHS.tertiaryBonuses.length).toBeGreaterThan(0);
    for (const b of GLYPHS.tertiaryBonuses) {
      expect(typeof b.key).toBe('string');
      expect(b.key.length).toBeGreaterThan(0);
      expect(typeof b.label).toBe('string');
    }
    expect(new Set(GLYPHS.tertiaryBonuses.map((b) => b.key)).size).toBe(GLYPHS.tertiaryBonuses.length);
  });
});
