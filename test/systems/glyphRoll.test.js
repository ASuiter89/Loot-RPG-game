import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../../src/utils/rng.js';
import { GLYPHS } from '../../src/data/glyphs.js';
import { rollGlyph, glyphPower } from '../../src/systems/glyphRoll.js';

describe('glyphPower', () => {
  it('turns a rolled value v into a ×(1+v) multiplier', () => {
    expect(glyphPower({ value: 0.2 })).toBeCloseTo(1.2, 10);
    expect(glyphPower({ value: 0.5 })).toBeCloseTo(1.5, 10);
  });

  it('is a no-op (×1) for a missing / malformed / negative glyph', () => {
    expect(glyphPower(null)).toBe(1);
    expect(glyphPower(undefined)).toBe(1);
    expect(glyphPower({})).toBe(1);
    expect(glyphPower({ value: NaN })).toBe(1);
    expect(glyphPower({ value: -0.4 })).toBe(1); // can't shrink a node
  });
});

describe('rollGlyph — tier selection by Endless depth', () => {
  it('rolls tier 1 at depth 0', () => {
    const g = rollGlyph(mulberry32(1), 0);
    expect(g.tier).toBe(1);
  });

  it('takes the HIGHEST tier the depth unlocks', () => {
    expect(rollGlyph(mulberry32(2), 5).tier).toBe(2);
    expect(rollGlyph(mulberry32(2), 12).tier).toBe(3);
    expect(rollGlyph(mulberry32(2), 34).tier).toBe(4); // one short of tier 5's gate
    expect(rollGlyph(mulberry32(2), 35).tier).toBe(5);
    expect(rollGlyph(mulberry32(2), 9999).tier).toBe(5);
  });

  it('clamps garbage / negative depth down to the entry tier', () => {
    expect(rollGlyph(mulberry32(3), -50).tier).toBe(1);
    expect(rollGlyph(mulberry32(3), NaN).tier).toBe(1);
    expect(rollGlyph(mulberry32(3), undefined).tier).toBe(1);
  });
});

describe('rollGlyph — the rolled glyph', () => {
  it('rolls its value inside the chosen tier band and a real tertiary', () => {
    const g = rollGlyph(mulberry32(42), 40); // tier 5
    const band = GLYPHS.tiers[4].valueBand;
    expect(g.value).toBeGreaterThanOrEqual(band.min);
    expect(g.value).toBeLessThanOrEqual(band.max);
    expect(g.radius).toBe(GLYPHS.tiers[4].radius);
    expect(GLYPHS.tertiaryBonuses.map((b) => b.key)).toContain(g.tertiary);
    expect(g.id.startsWith('glyph_5_')).toBe(true);
    expect(g.name).toBe(GLYPHS.tiers[4].name);
    expect(g.color).toBe(GLYPHS.tiers[4].color);
  });

  it('is deterministic — same seed + depth reproduces the exact glyph', () => {
    const a = rollGlyph(mulberry32(777), 20);
    const b = rollGlyph(mulberry32(777), 20);
    expect(a).toEqual(b);
  });

  it('advances the stream — a shared rng yields distinct rolls', () => {
    const rng = mulberry32(9);
    const a = rollGlyph(rng, 40);
    const b = rollGlyph(rng, 40);
    expect(a.value === b.value && a.tertiary === b.tertiary && a.id === b.id).toBe(false);
  });

  it('degrades to a fixed roll when rng is not a function', () => {
    const g = rollGlyph(null, 40);
    // value = band.min (roll()==0), tertiary = first rider, suffix from 0 → "0"
    expect(g.value).toBeCloseTo(GLYPHS.tiers[4].valueBand.min, 10);
    expect(g.tertiary).toBe(GLYPHS.tertiaryBonuses[0].key);
    expect(g.id).toBe('glyph_5_0');
  });
});

describe('rollGlyph — custom tuning + degenerate tables', () => {
  it('honours an injected tuning table (last param)', () => {
    const custom = {
      tiers: [{ tier: 1, name: 'Solo', color: '#123456', radius: 9, valueBand: { min: 0.5, max: 0.5 } }],
      tertiaryBonuses: [{ key: 'only', label: 'Only' }],
      depthGates: [{ tier: 1, minEndlessDepth: 0 }],
    };
    const g = rollGlyph(mulberry32(5), 100, custom);
    expect(g.tier).toBe(1);
    expect(g.value).toBeCloseTo(0.5, 10); // min == max degenerate band
    expect(g.tertiary).toBe('only');
    expect(g.radius).toBe(9);
  });

  it('falls back to the lowest existing tier if depth unlocks nothing', () => {
    const custom = {
      tiers: [{ tier: 3, name: 'Only-3', color: '#000000', radius: 5, valueBand: { min: 0.1, max: 0.2 } }],
      tertiaryBonuses: [],
      depthGates: [{ tier: 3, minEndlessDepth: 999 }],
    };
    const g = rollGlyph(mulberry32(5), 0, custom);
    expect(g.tier).toBe(3);      // fell back to tiers[0]
    expect(g.tertiary).toBe(''); // no riders
  });

  it('returns a harmless blank glyph when the table has no tiers', () => {
    const g = rollGlyph(mulberry32(5), 0, { tiers: [], tertiaryBonuses: [], depthGates: [] });
    expect(g.tier).toBe(0);
    expect(g.value).toBe(0);
    expect(g.radius).toBe(0);
    expect(glyphPower(g)).toBe(1);
  });
});
