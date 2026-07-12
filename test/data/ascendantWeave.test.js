import { describe, it, expect } from 'vitest';
import { WEAVE } from '../../src/data/ascendantWeave.js';

// Shape / invariant characterization for the Weave board data. If a future edit adds
// a node with a dangling prereq, a keystone pointing at a missing arm, or breaks the
// entry-node contract, these fail loudly instead of shipping a board you can't clear.

const ATTRS = new Set(['might', 'vitality', 'agility', 'spirit', 'luck']);

describe('WEAVE.constellations', () => {
  it('has five arms, one per attribute, with unique ids', () => {
    expect(WEAVE.constellations).toHaveLength(5);
    const attrs = WEAVE.constellations.map((c) => c.attr);
    expect(new Set(attrs)).toEqual(ATTRS);
    const ids = WEAVE.constellations.map((c) => c.id);
    expect(new Set(ids).size).toBe(5);
    for (const c of WEAVE.constellations) {
      expect(typeof c.name).toBe('string');
      expect(c.name.length).toBeGreaterThan(0);
      expect(typeof c.angle).toBe('number');
    }
  });
});

describe('WEAVE.nodes', () => {
  const ids = new Set(WEAVE.nodes.map((n) => n.id));
  const constIds = new Set(WEAVE.constellations.map((c) => c.id));

  it('is a bounded board (~35 nodes, all cost 1)', () => {
    expect(WEAVE.nodes.length).toBeGreaterThanOrEqual(30);
    expect(WEAVE.nodes.length).toBeLessThanOrEqual(45);
    expect(new Set(WEAVE.nodes.map((n) => n.id)).size).toBe(WEAVE.nodes.length); // unique ids
    for (const n of WEAVE.nodes) expect(n.cost).toBe(1);
  });

  it('every node has a valid arm, ring band, coords and a bounded payload', () => {
    for (const n of WEAVE.nodes) {
      expect(constIds.has(n.constellation)).toBe(true);
      expect([1, 2, 3, 4]).toContain(n.band);
      expect(typeof n.x).toBe('number');
      expect(typeof n.y).toBe('number');
      // coords stay inside the 0..100 board so nothing renders off-canvas
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(100);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(100);
      expect(n.payload && typeof n.payload).toBe('object');
      const keys = Object.keys(n.payload);
      expect(keys.length).toBeGreaterThan(0);
      for (const k of keys) {
        const v = n.payload[k];
        expect(typeof v).toBe('number');
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(40); // bounded — apex nodes pay a little more
      }
    }
  });

  it('every prereq references an existing node id', () => {
    for (const n of WEAVE.nodes) {
      for (const r of n.req || []) expect(ids.has(r)).toBe(true);
      for (const r of n.reqAny || []) expect(ids.has(r)).toBe(true);
    }
  });

  it('band-1 nodes are entry points (no prereqs); deeper bands always gate', () => {
    for (const n of WEAVE.nodes) {
      const hasReq = (n.req && n.req.length) || (n.reqAny && n.reqAny.length);
      if (n.band === 1) expect(hasReq).toBeFalsy();
      else expect(hasReq).toBeTruthy();
    }
  });

  it('gives each arm at least one entry node so the board is enterable', () => {
    for (const c of WEAVE.constellations) {
      const entries = WEAVE.nodes.filter((n) => n.constellation === c.id && n.band === 1);
      expect(entries.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('WEAVE.keystones', () => {
  const constIds = new Set(WEAVE.constellations.map((c) => c.id));

  it('has many keystones, each on a real arm with a gate and a stable id', () => {
    expect(WEAVE.keystones.length).toBeGreaterThanOrEqual(20);
    expect(WEAVE.keystones.length).toBeLessThanOrEqual(32);
    expect(new Set(WEAVE.keystones.map((k) => k.id)).size).toBe(WEAVE.keystones.length);
    for (const ks of WEAVE.keystones) {
      expect(constIds.has(ks.constellation)).toBe(true);
      expect(typeof ks.name).toBe('string');
      expect(typeof ks.desc).toBe('string');
      expect(typeof ks.effectId).toBe('string');
    }
    // every arm carries at least a couple of keystones so no arm is a dead end
    for (const c of WEAVE.constellations) {
      const n = WEAVE.keystones.filter((k) => k.constellation === c.id).length;
      expect(n).toBeGreaterThanOrEqual(2);
    }
  });

  it('each gate combines one or more real conditions (attr total, in-arm pts, board pts)', () => {
    for (const ks of WEAVE.keystones) {
      const g = ks.gate;
      expect(g && typeof g).toBe('object');
      const attrGate = g.attr != null && g.total != null;
      const ptsGate = g.n != null;
      const boardGate = g.boardPts != null;
      expect(attrGate || ptsGate || boardGate).toBe(true); // at least one real condition
      if (attrGate) {
        expect(ATTRS.has(g.attr)).toBe(true);
        expect(g.total).toBeGreaterThan(0);
      }
      if (ptsGate) expect(g.n).toBeGreaterThan(0);
      if (boardGate) expect(g.boardPts).toBeGreaterThan(0);
    }
  });

  it('each keystone folds either a bounded stat mult or a flat effect', () => {
    for (const ks of WEAVE.keystones) {
      const hasMult = typeof ks.mult === 'number' && !!ks.statKey;
      const hasEffect = !!(ks.effect && typeof ks.effect === 'object');
      expect(hasMult || hasEffect).toBe(true);
      if (hasMult) {
        expect(ks.mult).toBeGreaterThan(1);
        expect(ks.mult).toBeLessThanOrEqual(1.25); // build-definer, not a blowout
      }
    }
  });
});

describe('WEAVE has no glyph sockets (feature removed)', () => {
  it('does not carry a sockets table', () => {
    expect(WEAVE.sockets).toBeUndefined();
  });
});

describe('WEAVE.weaveDepth (cosmetic prestige tuning)', () => {
  it('carries a positive base and non-negative step, plus flavour titles', () => {
    expect(WEAVE.weaveDepth.base).toBeGreaterThan(0);
    expect(WEAVE.weaveDepth.step).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(WEAVE.weaveDepth.titles)).toBe(true);
    expect(WEAVE.weaveDepth.titles.length).toBeGreaterThan(0);
  });
});
