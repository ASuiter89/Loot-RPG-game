import { describe, it, expect } from 'vitest';
import { MIRRORFORGE } from '../../src/data/mirrorforge.js';

// The data module is pure values — validate its shape/invariants so a bad edit
// (a missing cost, a negative weight, a broken band) fails CI instead of shipping.
describe('MIRRORFORGE data shape', () => {
  it('exposes a finite FP budget formula', () => {
    for (const k of ['base', 'perRank', 'perIlvl']) {
      expect(typeof MIRRORFORGE.fp[k]).toBe('number');
      expect(MIRRORFORGE.fp[k]).toBeGreaterThanOrEqual(0);
    }
  });

  it('defines a cost for every action, each with fp + a mats object', () => {
    for (const action of ['attune', 'exalt', 'divine', 'corrupt', 'mirror']) {
      const c = MIRRORFORGE.costs[action];
      expect(c, action).toBeTruthy();
      expect(typeof c.fp).toBe('number');
      expect(c.fp).toBeGreaterThanOrEqual(0);
      expect(c.mats && typeof c.mats).toBe('object');
      for (const k in c.mats) expect(c.mats[k]).toBeGreaterThanOrEqual(0);
    }
  });

  it('gates Aether behind Mirror only (the deep material sink)', () => {
    expect(MIRRORFORGE.costs.mirror.mats.aether).toBeGreaterThan(0);
    for (const a of ['attune', 'exalt', 'divine', 'corrupt']) {
      expect(MIRRORFORGE.costs[a].mats.aether || 0).toBe(0);
    }
  });

  it('has a well-formed corrupt outcome table with the four kinds', () => {
    const kinds = new Set(MIRRORFORGE.corruptOutcomes.map(o => o.kind));
    for (const k of ['addAffix', 'radiant', 'signature', 'curse']) expect(kinds.has(k)).toBe(true);
    for (const o of MIRRORFORGE.corruptOutcomes) {
      expect(typeof o.id).toBe('string');
      expect(o.weight).toBeGreaterThan(0);
    }
    // The addAffix outcome carries the band it rolls in.
    const add = MIRRORFORGE.corruptOutcomes.find(o => o.kind === 'addAffix');
    expect(add.band.max).toBeGreaterThanOrEqual(add.band.min);
  });

  it('has a bounded radiant curve and a positive aether depth gate', () => {
    const r = MIRRORFORGE.radiant;
    expect(r.chanceBase).toBeGreaterThanOrEqual(0);
    expect(r.perDepth).toBeGreaterThan(0);
    expect(r.cap).toBeGreaterThan(r.chanceBase);
    expect(r.band.max).toBeGreaterThanOrEqual(r.band.min);
    expect(MIRRORFORGE.aether.minEndlessDepth).toBeGreaterThan(0);
  });

  it('has sane action tunables in range', () => {
    expect(MIRRORFORGE.exaltFraction).toBeGreaterThan(0);
    expect(MIRRORFORGE.exaltFraction).toBeLessThanOrEqual(1);
    expect(MIRRORFORGE.aetherDecile).toBeGreaterThan(0.5);
    expect(MIRRORFORGE.aetherDecile).toBeLessThan(1);
    expect(MIRRORFORGE.attuneTargetFloor).toBeGreaterThanOrEqual(0);
    expect(MIRRORFORGE.attuneTargetFloor).toBeLessThanOrEqual(1);
  });
});
