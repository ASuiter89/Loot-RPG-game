import { describe, it, expect } from 'vitest';
import {
  emptyGrid,
  recordBossClear,
  highestRung,
  classCleared,
  classProgress,
  marksEarned,
  sanitizeGrid,
} from '../../src/systems/dreadChecklist.js';

const BOSSES = ['warden', 'hydra', 'lich', 'titan'];

describe('emptyGrid', () => {
  it('is a fresh empty object', () => {
    expect(emptyGrid()).toEqual({});
  });
});

describe('recordBossClear', () => {
  it('records a rung and returns a NEW grid (input untouched)', () => {
    const g0 = emptyGrid();
    const g1 = recordBossClear(g0, 'mage', 'warden', 4);
    expect(highestRung(g1, 'mage', 'warden')).toBe(4);
    expect(g0).toEqual({});          // immutable
    expect(g1).not.toBe(g0);
  });

  it('keeps the MAX — a later easy clear never lowers the record', () => {
    let g = recordBossClear(emptyGrid(), 'mage', 'warden', 7);
    g = recordBossClear(g, 'mage', 'warden', 3);
    expect(highestRung(g, 'mage', 'warden')).toBe(7);
    g = recordBossClear(g, 'mage', 'warden', 9);
    expect(highestRung(g, 'mage', 'warden')).toBe(9);
  });

  it('separates classes and bosses', () => {
    let g = recordBossClear(emptyGrid(), 'mage', 'warden', 4);
    g = recordBossClear(g, 'rogue', 'warden', 2);
    g = recordBossClear(g, 'mage', 'hydra', 6);
    expect(highestRung(g, 'mage', 'warden')).toBe(4);
    expect(highestRung(g, 'rogue', 'warden')).toBe(2);
    expect(highestRung(g, 'mage', 'hydra')).toBe(6);
  });

  it('ignores a missing class/boss or a non-positive dread', () => {
    const base = recordBossClear(emptyGrid(), 'mage', 'warden', 4);
    expect(recordBossClear(base, null, 'warden', 5)).toEqual(base);
    expect(recordBossClear(base, 'mage', null, 5)).toEqual(base);
    expect(recordBossClear(base, 'mage', 'hydra', 0)).toEqual(base);
    expect(recordBossClear(base, 'mage', 'hydra', -3)).toEqual(base);
    expect(recordBossClear(base, 'mage', 'hydra', NaN)).toEqual(base);
  });
});

describe('highestRung', () => {
  it('is 0 for an unknown class/boss or a garbage grid', () => {
    const g = recordBossClear(emptyGrid(), 'mage', 'warden', 4);
    expect(highestRung(g, 'mage', 'nope')).toBe(0);
    expect(highestRung(g, 'nope', 'warden')).toBe(0);
    expect(highestRung(null, 'mage', 'warden')).toBe(0);
  });
});

describe('classCleared & classProgress', () => {
  let g;
  it('counts only roster bosses beaten at dread>0', () => {
    g = emptyGrid();
    g = recordBossClear(g, 'mage', 'warden', 4);
    g = recordBossClear(g, 'mage', 'hydra', 2);
    g = recordBossClear(g, 'mage', 'ghost', 5); // not in roster → ignored
    expect(classCleared(g, 'mage', BOSSES)).toBe(2);
    expect(classCleared(g, 'mage', [])).toBe(0);
    expect(classCleared(g, 'rogue', BOSSES)).toBe(0);
  });

  it('summarises cleared/total/bestDread', () => {
    const p = classProgress(g, 'mage', BOSSES);
    expect(p).toEqual({ cleared: 2, total: 4, bestDread: 4 });
    expect(classProgress(g, 'mage', null)).toEqual({ cleared: 0, total: 0, bestDread: 0 });
  });
});

describe('marksEarned', () => {
  // Custom milestone set exercising all three scopes.
  const MS = [
    { id: 'any1', dread: 1, scope: 'any', need: 1 },
    { id: 'any5', dread: 5, scope: 'any', need: 1 },
    { id: 'count3@2', dread: 2, scope: 'count', need: 3 },
    { id: 'every3@3', dread: 3, scope: 'every', need: 3 },
  ];

  it('is 0 on an empty grid', () => {
    expect(marksEarned(emptyGrid(), MS)).toBe(0);
  });

  it('satisfies an ANY mark from the single best rung', () => {
    const g = recordBossClear(emptyGrid(), 'mage', 'warden', 6);
    // any1 (>=1) and any5 (>=5) met; count3@2 needs 3 records; every3@3 needs 3 records
    expect(marksEarned(g, MS)).toBe(2);
  });

  it('satisfies a COUNT mark only with enough distinct records at the bar', () => {
    let g = emptyGrid();
    g = recordBossClear(g, 'mage', 'warden', 2);
    g = recordBossClear(g, 'mage', 'hydra', 2);
    // only 2 records >=2 so far → count3@2 not met (but any1 is)
    expect(marksEarned(g, MS)).toBe(1);
    g = recordBossClear(g, 'mage', 'lich', 4);
    // now 3 records >=2 → count3@2 met; any1 met; every3@3 needs all>=3 but warden/hydra are 2
    expect(marksEarned(g, MS)).toBe(2);
  });

  it('satisfies an EVERY mark only when all records clear the bar', () => {
    let g = emptyGrid();
    g = recordBossClear(g, 'mage', 'warden', 4);
    g = recordBossClear(g, 'mage', 'hydra', 5);
    g = recordBossClear(g, 'rogue', 'lich', 3);
    // 3 records, all >=3 → every3@3 met; any1 met; any5 met (best is 5); count3@2 met (all>=2)
    expect(marksEarned(g, MS)).toBe(4);
    // Add a low record → every3@3 breaks (a record below the bar), count still 3+ at >=2? new is 1 (<2)
    g = recordBossClear(g, 'rogue', 'titan', 1);
    expect(marksEarned(g, MS)).toBe(3); // lost every3@3
  });

  it('defaults to the real MARK_MILESTONES and never throws on garbage', () => {
    expect(marksEarned(null)).toBe(0);
    expect(typeof marksEarned(emptyGrid())).toBe('number');
    expect(marksEarned(emptyGrid(), null)).toBeGreaterThanOrEqual(0);
  });

  it('treats an unknown scope as ANY', () => {
    const g = recordBossClear(emptyGrid(), 'mage', 'warden', 3);
    expect(marksEarned(g, [{ id: 'weird', dread: 2, scope: 'zzz', need: 1 }])).toBe(1);
  });
});

describe('sanitizeGrid', () => {
  it('drops non-object rows, non-positive/NaN rungs and empties', () => {
    const raw = {
      mage: { warden: 4, hydra: 0, lich: -2, ghost: 'x', ok: 3 },
      rogue: 'garbage',
      empty: { a: 0 },
    };
    const out = sanitizeGrid(raw);
    expect(out).toEqual({ mage: { warden: 4, ok: 3 } });
  });

  it('returns {} for a non-object blob (old saves)', () => {
    expect(sanitizeGrid(null)).toEqual({});
    expect(sanitizeGrid(42)).toEqual({});
    expect(sanitizeGrid(undefined)).toEqual({});
  });
});
