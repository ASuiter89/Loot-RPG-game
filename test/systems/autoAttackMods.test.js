import { describe, it, expect } from 'vitest';
import {
  autoModCap, clampAutoMods, autoModMult, nodeAutoMod, sumNodeAutoMods,
  pierceTargets, ricochetChain, multishotTargets, describeAutoMods,
} from '../../src/systems/autoAttackMods.js';
import {
  AUTO_MOD_KEYS, AUTO_MOD_CAPS, AUTO_MOD_TUNING, AUTO_MOD_BOUNCE, AUTO_MOD_NODES, AUTO_MOD_INFO,
} from '../../src/data/autoAttackMods.js';

// A foe is just a tile in this layer — the real objects carry far more.
const foe = (x, y, extra) => ({ x, y, ...(extra || {}) });
// Wide-open room: everything sees everything.
const openLos = () => true;

describe('autoModCap', () => {
  it('returns each modifier\'s ceiling and 0 for an unknown key', () => {
    for (const k of AUTO_MOD_KEYS) expect(autoModCap(k)).toBe(AUTO_MOD_CAPS[k]);
    expect(autoModCap('nonsense')).toBe(0);
  });
});

describe('clampAutoMods', () => {
  it('is all-zero and any:false for an empty build', () => {
    const m = clampAutoMods({});
    for (const k of AUTO_MOD_KEYS) expect(m[k]).toBe(0);
    expect(m.any).toBe(false);
    expect(clampAutoMods(null).any).toBe(false);
    expect(clampAutoMods(undefined).any).toBe(false);
  });

  it('clamps every modifier to its cap no matter how much is stacked', () => {
    const m = clampAutoMods({ pierce: 99, ricochet: 99, multishot: 99, bounce: 99 });
    for (const k of AUTO_MOD_KEYS) expect(m[k]).toBe(AUTO_MOD_CAPS[k]);
    expect(m.any).toBe(true);
  });

  it('floors fractional grants and ignores negatives', () => {
    const m = clampAutoMods({ pierce: 1.9, ricochet: -3 });
    expect(m.pierce).toBe(1);
    expect(m.ricochet).toBe(0);
  });

  it('gives a lone Rebound a ricochet to bend, so the power is never dead', () => {
    const m = clampAutoMods({ bounce: 1 });
    expect(m.bounce).toBe(1);
    expect(m.ricochet).toBe(1);
    expect(m.any).toBe(true);
  });

  it('does not shrink an existing ricochet when bounce is added', () => {
    expect(clampAutoMods({ bounce: 1, ricochet: 3 }).ricochet).toBe(3);
  });

  it('ignores keys that are not modifiers', () => {
    const m = clampAutoMods({ pierce: 1, nonsense: 5 });
    expect(m.nonsense).toBeUndefined();
    expect(m.pierce).toBe(1);
  });
});

describe('autoModMult', () => {
  it('pays the first extra hit the kind\'s opening fraction', () => {
    for (const kind of ['pierce', 'ricochet', 'multishot']) {
      expect(autoModMult(kind, 1)).toBeCloseTo(AUTO_MOD_TUNING[kind].first, 10);
    }
  });

  it('tapers each further hop and never exceeds the swing that spawned it', () => {
    for (const kind of ['pierce', 'ricochet', 'multishot']) {
      const a = autoModMult(kind, 1), b = autoModMult(kind, 2), c = autoModMult(kind, 3);
      expect(a).toBeLessThan(1);
      expect(b).toBeLessThan(a);
      expect(c).toBeLessThan(b);
      expect(c).toBeGreaterThan(0);
    }
  });

  it('is 0 for a kind that deals no damage of its own, or a bad hop', () => {
    expect(autoModMult('bounce', 1)).toBe(0);
    expect(autoModMult('nonsense', 1)).toBe(0);
    expect(autoModMult('pierce', 0)).toBe(0);
    expect(autoModMult('pierce', undefined)).toBe(0);
  });
});

describe('nodeAutoMod / sumNodeAutoMods', () => {
  it('grants nothing below the node\'s threshold and the grant at or above it', () => {
    const [id, entry] = Object.entries(AUTO_MOD_NODES)[0];
    expect(nodeAutoMod(id, entry.at - 1)).toBeNull();
    expect(nodeAutoMod(id, entry.at)).toEqual(entry.grant);
    expect(nodeAutoMod(id, entry.at + 5)).toEqual(entry.grant);
  });

  it('is null for an unlearned or unknown node', () => {
    expect(nodeAutoMod('w_p12', 0)).toBeNull();
    expect(nodeAutoMod('not_a_node', 10)).toBeNull();
  });

  it('sums every earned grant across a hero\'s learned ranks', () => {
    // Two Warrior nodes: Cleaving Force (pierce) earned, Titanic Might (multishot) not.
    const raw = sumNodeAutoMods({ w_p12: AUTO_MOD_NODES.w_p12.at, w_p42: 1, r_p14: 99 });
    expect(raw.pierce).toBe(2);          // w_p12 + r_p14, both past threshold
    expect(raw.multishot ?? 0).toBe(0);  // w_p42 is only rank 1
  });

  it('handles a hero with no skills at all', () => {
    expect(sumNodeAutoMods(null)).toEqual({});
    expect(sumNodeAutoMods({})).toEqual({});
  });
});

describe('AUTO_MOD_NODES data', () => {
  it('only grants known modifier keys, by whole numbers, at a reachable rank', () => {
    for (const [id, e] of Object.entries(AUTO_MOD_NODES)) {
      expect(e.at, `${id} threshold`).toBeGreaterThanOrEqual(1);
      expect(e.at, `${id} threshold within a skill's 10 ranks`).toBeLessThanOrEqual(10);
      for (const [k, v] of Object.entries(e.grant)) {
        expect(AUTO_MOD_KEYS.includes(k), `${id} grants unknown ${k}`).toBe(true);
        expect(Number.isInteger(v), `${id} grants a fractional ${k}`).toBe(true);
        expect(v, `${id} grants a positive ${k}`).toBeGreaterThan(0);
      }
    }
  });

  it('reaches every class, at least twice each', () => {
    const perClass = {};
    for (const id of Object.keys(AUTO_MOD_NODES)) {
      const cls = id.split('_')[0];
      perClass[cls] = (perClass[cls] || 0) + 1;
    }
    // w warrior · r rogue · m mage · t templar · f fortune · z windblade · l bloodletter
    for (const cls of ['w', 'r', 'm', 't', 'f', 'z', 'l']) {
      expect(perClass[cls] || 0, `class ${cls} has too few shape nodes`).toBeGreaterThanOrEqual(2);
    }
  });

  it('names and blurbs every modifier for the UI', () => {
    for (const k of AUTO_MOD_KEYS) {
      expect(typeof AUTO_MOD_INFO[k].label).toBe('string');
      expect(AUTO_MOD_INFO[k].blurb.length).toBeGreaterThan(10);
    }
  });
});

describe('pierceTargets', () => {
  const hero = { x: 0, y: 0 };

  it('catches the foes lined up behind the mark, nearest-first', () => {
    const t = foe(2, 0), a = foe(3, 0), b = foe(4, 0);
    expect(pierceTargets(hero, t, [b, a], 2)).toEqual([a, b]);
  });

  it('never hits the mark again, nor anything short of it', () => {
    const t = foe(3, 0);
    const near = foe(1, 0);          // between hero and mark
    const beyond = foe(4, 0);
    expect(pierceTargets(hero, t, [near, t, beyond], 3)).toEqual([beyond]);
  });

  it('stops at the shot\'s remaining travel', () => {
    const t = foe(1, 0);
    const inside = foe(1 + AUTO_MOD_TUNING.pierce.reach, 0);
    const outside = foe(2 + AUTO_MOD_TUNING.pierce.reach, 0);
    expect(pierceTargets(hero, t, [inside, outside], 3)).toEqual([inside]);
  });

  it('skips a foe standing off the line', () => {
    const t = foe(2, 0);
    expect(pierceTargets(hero, t, [foe(3, 2)], 3)).toEqual([]);
    expect(pierceTargets(hero, t, [foe(3, 0)], 3)).toHaveLength(1);
  });

  it('works down a diagonal, not just an axis', () => {
    const t = foe(2, 2), behind = foe(3, 3);
    expect(pierceTargets({ x: 0, y: 0 }, t, [behind], 3)).toEqual([behind]);
  });

  it('honours the requested count', () => {
    const t = foe(1, 0);
    const rank = [foe(2, 0), foe(3, 0), foe(4, 0)];
    expect(pierceTargets(hero, t, rank, 1)).toEqual([rank[0]]);
    expect(pierceTargets(hero, t, rank, 0)).toEqual([]);
  });

  it('returns nothing without a hero, a mark, a line, or foes', () => {
    expect(pierceTargets(null, foe(1, 0), [foe(2, 0)], 2)).toEqual([]);
    expect(pierceTargets(hero, null, [foe(2, 0)], 2)).toEqual([]);
    expect(pierceTargets(hero, foe(0, 0), [foe(1, 0)], 2)).toEqual([]); // mark on the hero
    expect(pierceTargets(hero, foe(1, 0), null, 2)).toEqual([]);
    expect(pierceTargets(hero, foe(1, 0), [null, {}], 2)).toEqual([]);
  });

  it('accepts explicit reach and width overrides', () => {
    const t = foe(1, 0);
    expect(pierceTargets(hero, t, [foe(9, 0)], 3, 8)).toHaveLength(1);
    expect(pierceTargets(hero, t, [foe(2, 1)], 3, 3, 2)).toHaveLength(1);
  });
});

describe('ricochetChain', () => {
  it('hops nearest-first from foe to foe, never repeating one', () => {
    const start = foe(0, 0), a = foe(1, 0), b = foe(2, 0), c = foe(3, 0);
    const chain = ricochetChain(start, [c, b, a], 3, openLos, false);
    expect(chain).toEqual([a, b, c]);
  });

  it('stops when the requested hops run out', () => {
    const start = foe(0, 0), a = foe(1, 0), b = foe(2, 0);
    expect(ricochetChain(start, [a, b], 1, openLos, false)).toEqual([a]);
  });

  it('stops when nothing is within a hop', () => {
    const start = foe(0, 0);
    const far = foe(50, 50);
    expect(ricochetChain(start, [far], 3, openLos, false)).toEqual([]);
  });

  it('needs line of sight for an ordinary carom', () => {
    const start = foe(0, 0), a = foe(1, 0);
    expect(ricochetChain(start, [a], 2, () => false, false)).toEqual([]);
  });

  it('ignores line of sight when it bounces off the walls', () => {
    const start = foe(0, 0), a = foe(1, 0);
    expect(ricochetChain(start, [a], 2, () => false, true)).toEqual([a]);
  });

  it('reaches further per hop when it bounces', () => {
    const start = foe(0, 0);
    const far = foe(AUTO_MOD_TUNING.ricochet.hop + AUTO_MOD_BOUNCE.hopBonus, 0);
    expect(ricochetChain(start, [far], 1, openLos, false)).toEqual([]);
    expect(ricochetChain(start, [far], 1, openLos, true)).toEqual([far]);
  });

  it('returns nothing without a start, hops, foes or a LOS predicate', () => {
    expect(ricochetChain(null, [foe(1, 0)], 2, openLos)).toEqual([]);
    expect(ricochetChain(foe(0, 0), [foe(1, 0)], 0, openLos)).toEqual([]);
    expect(ricochetChain(foe(0, 0), null, 2, openLos)).toEqual([]);
    expect(ricochetChain(foe(0, 0), [foe(1, 0)], 2, null)).toEqual([]);
  });

  it('never chains back to the foe it started on', () => {
    const start = foe(0, 0), a = foe(1, 0);
    expect(ricochetChain(start, [start, a], 3, openLos, false)).toEqual([a]);
  });
});

describe('multishotTargets', () => {
  const hero = { x: 0, y: 0 };

  it('picks the nearest foes inside reach, nearest-first', () => {
    const a = foe(1, 0), b = foe(2, 0), c = foe(3, 0);
    expect(multishotTargets(hero, [c, b, a], 2, 5, null)).toEqual([a, b]);
  });

  it('drops foes past the weapon\'s reach', () => {
    expect(multishotTargets(hero, [foe(9, 0)], 2, 3, null)).toEqual([]);
  });

  it('drops foes the hero cannot see', () => {
    const seen = foe(1, 0), hidden = foe(2, 0);
    const canSee = (f) => f === seen;
    expect(multishotTargets(hero, [seen, hidden], 2, 5, canSee)).toEqual([seen]);
  });

  it('returns nothing without a hero, count, reach or foes', () => {
    expect(multishotTargets(null, [foe(1, 0)], 2, 5, null)).toEqual([]);
    expect(multishotTargets(hero, [foe(1, 0)], 0, 5, null)).toEqual([]);
    expect(multishotTargets(hero, [foe(1, 0)], 2, 0, null)).toEqual([]);
    expect(multishotTargets(hero, null, 2, 5, null)).toEqual([]);
    expect(multishotTargets(hero, [null, {}], 2, 5, null)).toEqual([]);
  });
});

describe('describeAutoMods', () => {
  it('is empty when the hero has no shape', () => {
    expect(describeAutoMods(clampAutoMods({}))).toBe('');
    expect(describeAutoMods(null)).toBe('');
  });

  it('lists each modifier with its count, and Rebound without one', () => {
    const s = describeAutoMods(clampAutoMods({ pierce: 2, ricochet: 1, multishot: 1, bounce: 1 }));
    expect(s).toBe('Pierce 2 · Ricochet 1 · Multishot 1 · Rebound');
  });

  it('names only what is actually on', () => {
    expect(describeAutoMods(clampAutoMods({ pierce: 1 }))).toBe('Pierce 1');
  });
});
