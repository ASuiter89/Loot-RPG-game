import { describe, it, expect } from 'vitest';
import { SALVAGE_MATERIALS } from '../../src/data/salvageTuning.js';
import {
  salvageVariance, salvageIlvlCurve, materialChance, salvageRanges,
} from '../../src/systems/salvage.js';

// TIERS order the ranks map to: junk 0 · white 1 · green 2 · blue 3 · purple 4 ·
// orange 5 · red 6.
const mat = (key) => SALVAGE_MATERIALS.find((m) => m.key === key);
const chanceOf = (ranges, key) => (ranges.find((r) => r.key === key) || {}).chance;

describe('salvageVariance', () => {
  it('is deterministic and bounded to [0,1)', () => {
    for (const [id, salt] of [[1, 1], [42, 7], [999.5, 213]]) {
      const v = salvageVariance(id, salt);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(salvageVariance(id, salt)).toBe(v); // stable
    }
  });

  it('tolerates a missing id', () => {
    const v = salvageVariance(undefined, 3);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});

describe('salvageIlvlCurve', () => {
  it('is 1 at ilvl 1 and rises with item level', () => {
    expect(salvageIlvlCurve(1)).toBe(1);
    expect(salvageIlvlCurve(25)).toBeGreaterThan(salvageIlvlCurve(9));
  });

  it('a lower strength flattens the curve', () => {
    expect(salvageIlvlCurve(50, 0.5)).toBeLessThan(salvageIlvlCurve(50, 1));
  });

  it('clamps a garbage ilvl to 1', () => {
    expect(salvageIlvlCurve(0)).toBe(1);
    expect(salvageIlvlCurve(undefined)).toBe(1);
  });
});

describe('materialChance', () => {
  it('is 0 below the material minRank', () => {
    expect(materialChance(mat('glimmer'), 0)).toBe(0);   // grey junk sheds no glimmer
    expect(materialChance(mat('core'), 1)).toBe(0);      // white sheds no core
    expect(materialChance(mat('chaos'), 3)).toBe(0);     // blue sheds no chaos
  });

  it('scrap is guaranteed at every rank', () => {
    for (let r = 0; r <= 6; r++) expect(materialChance(mat('scrap'), r)).toBe(1);
  });

  it('glimmer climbs steeply with rarity so simple gear rarely sheds it', () => {
    const g = mat('glimmer');
    expect(materialChance(g, 1)).toBeCloseTo(0.10);   // white — occasional
    expect(materialChance(g, 2)).toBeCloseTo(0.25);   // green — modest
    expect(materialChance(g, 3)).toBeCloseTo(0.40);   // blue — decent
    expect(materialChance(g, 1)).toBeLessThan(materialChance(g, 6));
  });

  it('core is a mere sliver from a green, real odds only from blue up', () => {
    const c = mat('core');
    expect(materialChance(c, 2)).toBeCloseTo(0.05);   // green — slim
    expect(materialChance(c, 3)).toBeCloseTo(0.19);   // blue — real
    expect(materialChance(c, 2)).toBeLessThan(materialChance(c, 4));
  });

  it('clamps to chanceMax and never goes negative', () => {
    const hot = { minRank: 0, chanceBase: 0.5, chancePerRank: 0.5, chanceFrom: 0, chanceMax: 0.7 };
    expect(materialChance(hot, 3)).toBe(0.7);          // 0.5 + 0.5·3 = 2.0 → clamped
    const neg = { minRank: 0, chanceBase: -1, chancePerRank: 0, chanceFrom: 0, chanceMax: 1 };
    expect(materialChance(neg, 0)).toBe(0);
  });
});

describe('salvageRanges', () => {
  const item = { id: 12345, ilvl: 20 };

  it('grey junk melts to pure Scrap', () => {
    const r = salvageRanges({ ...item }, 0);
    expect(r.map((x) => x.key)).toEqual(['scrap']);
    expect(r[0].chance).toBe(1);
  });

  it('white sheds Scrap + Glimmer only', () => {
    const keys = salvageRanges({ ...item }, 1).map((x) => x.key);
    expect(keys).toEqual(['scrap', 'glimmer']);
  });

  it('green adds a Core chance; purple adds Chaos', () => {
    expect(salvageRanges({ ...item }, 2).map((x) => x.key)).toEqual(['scrap', 'glimmer', 'core']);
    expect(salvageRanges({ ...item }, 4).map((x) => x.key)).toEqual(['scrap', 'glimmer', 'core', 'chaos']);
  });

  it('every band yields at least one, with hi strictly above lo', () => {
    for (const r of salvageRanges({ ...item }, 6)) {
      expect(r.lo).toBeGreaterThanOrEqual(1);
      expect(r.hi).toBeGreaterThan(r.lo);
      expect(r.chance).toBeGreaterThan(0);
      expect(r.chance).toBeLessThanOrEqual(1);
    }
  });

  it('the same item sheds Glimmer more readily the rarer it is', () => {
    // Same id → same per-material jitter, so the climb is purely the rarity curve.
    const white = chanceOf(salvageRanges({ ...item }, 1), 'glimmer');
    const blue = chanceOf(salvageRanges({ ...item }, 3), 'glimmer');
    const red = chanceOf(salvageRanges({ ...item }, 6), 'glimmer');
    expect(white).toBeLessThan(blue);
    expect(blue).toBeLessThan(red);
  });

  it('Scrap stays guaranteed regardless of per-item jitter', () => {
    for (const id of [1, 2, 7, 88, 500]) {
      expect(chanceOf(salvageRanges({ id, ilvl: 5 }, 5), 'scrap')).toBe(1);
    }
  });
});
