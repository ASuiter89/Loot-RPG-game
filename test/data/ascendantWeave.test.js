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

  it('is a compact, bounded board (~24 nodes, all cost 1)', () => {
    expect(WEAVE.nodes.length).toBeGreaterThanOrEqual(20);
    expect(WEAVE.nodes.length).toBeLessThanOrEqual(28);
    expect(new Set(WEAVE.nodes.map((n) => n.id)).size).toBe(WEAVE.nodes.length); // unique ids
    for (const n of WEAVE.nodes) expect(n.cost).toBe(1);
  });

  it('every node has a valid arm, ring band, coords and a small payload', () => {
    for (const n of WEAVE.nodes) {
      expect(constIds.has(n.constellation)).toBe(true);
      expect([1, 2, 3]).toContain(n.band);
      expect(typeof n.x).toBe('number');
      expect(typeof n.y).toBe('number');
      expect(n.payload && typeof n.payload).toBe('object');
      const keys = Object.keys(n.payload);
      expect(keys.length).toBeGreaterThan(0);
      for (const k of keys) {
        const v = n.payload[k];
        expect(typeof v).toBe('number');
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(20); // modest / bounded
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

  it('has ~8 keystones, each on a real arm with a gate and a stable id', () => {
    expect(WEAVE.keystones.length).toBeGreaterThanOrEqual(6);
    expect(WEAVE.keystones.length).toBeLessThanOrEqual(10);
    expect(new Set(WEAVE.keystones.map((k) => k.id)).size).toBe(WEAVE.keystones.length);
    for (const ks of WEAVE.keystones) {
      expect(constIds.has(ks.constellation)).toBe(true);
      expect(typeof ks.name).toBe('string');
      expect(typeof ks.desc).toBe('string');
      expect(typeof ks.effectId).toBe('string');
    }
  });

  it('each gate is either an attribute threshold or an in-arm point count', () => {
    for (const ks of WEAVE.keystones) {
      const g = ks.gate;
      expect(g && typeof g).toBe('object');
      const attrGate = g.attr != null && g.total != null;
      const ptsGate = g.n != null;
      expect(attrGate || ptsGate).toBe(true);
      if (attrGate) {
        expect(ATTRS.has(g.attr)).toBe(true);
        expect(g.total).toBeGreaterThan(0);
      }
      if (ptsGate) expect(g.n).toBeGreaterThan(0);
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

describe('WEAVE.sockets', () => {
  it('has a core socket plus positioned, reach-bearing sockets', () => {
    expect(WEAVE.sockets.length).toBeGreaterThanOrEqual(2);
    expect(WEAVE.sockets.some((s) => s.id === 'core')).toBe(true);
    expect(new Set(WEAVE.sockets.map((s) => s.id)).size).toBe(WEAVE.sockets.length);
    for (const s of WEAVE.sockets) {
      expect(typeof s.x).toBe('number');
      expect(typeof s.y).toBe('number');
      expect(s.radius).toBeGreaterThan(0);
    }
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
