import { describe, it, expect } from 'vitest';
import {
  BLESSING_COST_GROWTH,
  BLESSING_COST_CAP,
  blessingCost,
  blessingById,
  healerBuffFx,
  upsertHealerBuff,
  tickHealerBuffs,
  affectsMaxPools,
  sanitizeHealerBuffs,
} from '../../src/systems/healerBuffs.js';
import { HEALER_BLESSINGS, RESTED_BUFF } from '../../src/data/healerBuffs.js';

describe('blessingCost', () => {
  it('is the base at level 1', () => {
    expect(blessingCost(600, 1)).toBe(600);
  });

  it('climbs by the growth factor each level', () => {
    expect(blessingCost(600, 2)).toBe(Math.round(600 * BLESSING_COST_GROWTH));
    expect(blessingCost(1000, 3)).toBe(Math.round(1000 * BLESSING_COST_GROWTH ** 2));
  });

  it('is monotonically non-decreasing with level', () => {
    let prev = -1;
    for (let lvl = 1; lvl <= 60; lvl++) {
      const c = blessingCost(600, lvl);
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
  });

  it('clamps to the cap at high level', () => {
    expect(blessingCost(800, 200)).toBe(BLESSING_COST_CAP);
  });

  it('floors bad inputs to 0 and treats level<1 as level 1', () => {
    expect(blessingCost(-500, 5)).toBe(0);
    expect(blessingCost(NaN, 5)).toBe(0);
    expect(blessingCost(600, 0)).toBe(600);
    expect(blessingCost(600, -3)).toBe(600);
    expect(blessingCost(600, undefined)).toBe(600);
  });
});

describe('blessingById', () => {
  it('finds a shipped blessing', () => {
    expect(blessingById('bless_might')).toBe(HEALER_BLESSINGS.find((b) => b.id === 'bless_might'));
  });

  it('returns null for unknown ids and bad catalogs', () => {
    expect(blessingById('nope')).toBeNull();
    expect(blessingById('bless_might', [])).toBeNull();
    expect(blessingById('bless_might', null)).toBeNull();
  });

  it('honours a custom catalog', () => {
    const cat = [{ id: 'x' }, { id: 'y' }];
    expect(blessingById('y', cat)).toBe(cat[1]);
  });
});

describe('healerBuffFx', () => {
  const buffs = [
    { id: 'rested', fx: { xpPct: 0.25 }, floors: 2 },
    { id: 'bless_might', fx: { dmgPct: 0.3 }, floors: 1 },
    { id: 'bless_vigor', fx: { dmgPct: 0.1, maxHpPct: 0.25 }, floors: 3 },
  ];

  it('sums a key across all active buffs', () => {
    expect(healerBuffFx(buffs, 'dmgPct')).toBeCloseTo(0.4);
    expect(healerBuffFx(buffs, 'xpPct')).toBeCloseTo(0.25);
    expect(healerBuffFx(buffs, 'maxHpPct')).toBeCloseTo(0.25);
  });

  it('is 0 for a key nobody carries', () => {
    expect(healerBuffFx(buffs, 'critPct')).toBe(0);
  });

  it('ignores expired (floors<=0) entries', () => {
    const list = [
      { id: 'a', fx: { dmgPct: 0.5 }, floors: 0 },
      { id: 'b', fx: { dmgPct: 0.2 }, floors: -1 },
      { id: 'c', fx: { dmgPct: 0.1 }, floors: 1 },
    ];
    expect(healerBuffFx(list, 'dmgPct')).toBeCloseTo(0.1);
  });

  it('tolerates junk input', () => {
    expect(healerBuffFx(null, 'dmgPct')).toBe(0);
    expect(healerBuffFx(undefined, 'dmgPct')).toBe(0);
    expect(healerBuffFx([null, {}, { fx: null, floors: 2 }, { fx: { dmgPct: 'x' }, floors: 2 }], 'dmgPct')).toBe(0);
  });
});

describe('upsertHealerBuff', () => {
  it('adds a buff to an empty/absent list without mutating the input', () => {
    const start = [];
    const out = upsertHealerBuff(start, { id: 'rested', kind: 'rested', fx: { xpPct: 0.25 }, floors: 3 });
    expect(out).toHaveLength(1);
    expect(start).toHaveLength(0);
    expect(upsertHealerBuff(undefined, { id: 'x', fx: {}, floors: 1 })).toHaveLength(1);
  });

  it('deep-copies fx so the source definition can never be aliased', () => {
    const def = { id: 'bless_might', kind: 'blessing', fx: { dmgPct: 0.3 }, floors: 3 };
    const out = upsertHealerBuff([], def);
    out[0].fx.dmgPct = 999;
    expect(def.fx.dmgPct).toBe(0.3);
  });

  it('refreshes a buff with the same id (replaces, not duplicates)', () => {
    const list = [{ id: 'rested', kind: 'rested', fx: { xpPct: 0.25 }, floors: 1 }];
    const out = upsertHealerBuff(list, { id: 'rested', kind: 'rested', fx: { xpPct: 0.25 }, floors: 3 });
    expect(out).toHaveLength(1);
    expect(out[0].floors).toBe(3);
  });

  it('keeps only one blessing at a time but leaves non-blessings alone', () => {
    const list = [
      { id: 'rested', kind: 'rested', fx: { xpPct: 0.25 }, floors: 2 },
      { id: 'bless_might', kind: 'blessing', fx: { dmgPct: 0.3 }, floors: 2 },
    ];
    const out = upsertHealerBuff(list, { id: 'bless_focus', kind: 'blessing', fx: { critPct: 0.2 }, floors: 3 });
    const ids = out.map((b) => b.id).sort();
    expect(ids).toEqual(['bless_focus', 'rested']);
  });

  it('ignores a buff with no id', () => {
    const list = [{ id: 'a', fx: {}, floors: 1 }];
    expect(upsertHealerBuff(list, null)).toEqual(list);
    expect(upsertHealerBuff(list, { fx: {}, floors: 1 })).toEqual(list);
  });
});

describe('tickHealerBuffs', () => {
  it('ages each buff by one floor and keeps survivors', () => {
    const { buffs, expired } = tickHealerBuffs([
      { id: 'a', fx: {}, floors: 3 },
      { id: 'b', fx: {}, floors: 2 },
    ]);
    expect(buffs.map((b) => [b.id, b.floors])).toEqual([['a', 2], ['b', 1]]);
    expect(expired).toHaveLength(0);
  });

  it('drops buffs that reach zero and reports them as expired', () => {
    const { buffs, expired } = tickHealerBuffs([
      { id: 'a', fx: {}, floors: 1 },
      { id: 'b', fx: {}, floors: 2 },
    ]);
    expect(buffs.map((b) => b.id)).toEqual(['b']);
    expect(expired.map((b) => b.id)).toEqual(['a']);
  });

  it('does not mutate the input array or its objects', () => {
    const input = [{ id: 'a', fx: {}, floors: 2 }];
    tickHealerBuffs(input);
    expect(input[0].floors).toBe(2);
  });

  it('tolerates junk input', () => {
    expect(tickHealerBuffs(null)).toEqual({ buffs: [], expired: [] });
    const { buffs } = tickHealerBuffs([null, { id: 'a', fx: {}, floors: 2 }]);
    expect(buffs.map((b) => b.id)).toEqual(['a']);
  });
});

describe('affectsMaxPools', () => {
  it('is true when any buff carries maxHpPct or maxMpPct', () => {
    expect(affectsMaxPools([{ fx: { maxHpPct: 0.25 } }])).toBe(true);
    expect(affectsMaxPools([{ fx: { dmgPct: 0.3 } }, { fx: { maxMpPct: 0.1 } }])).toBe(true);
  });

  it('is false otherwise', () => {
    expect(affectsMaxPools([{ fx: { dmgPct: 0.3 } }, { fx: { critPct: 0.2 } }])).toBe(false);
    expect(affectsMaxPools([])).toBe(false);
    expect(affectsMaxPools(null)).toBe(false);
  });
});

describe('sanitizeHealerBuffs', () => {
  it('keeps valid buffs and normalizes their fields', () => {
    const out = sanitizeHealerBuffs([
      { id: 'bless_might', kind: 'blessing', name: 'Might', icon: 'w_sword', fx: { dmgPct: 0.3 }, floors: 2, desc: 'x' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'bless_might', kind: 'blessing', floors: 2 });
  });

  it('drops malformed / expired entries', () => {
    const out = sanitizeHealerBuffs([
      null,
      {},
      { id: 'a', fx: null, floors: 2 },
      { id: 'b', fx: {}, floors: 0 },
      { id: 'c', fx: { dmgPct: 0.1 }, floors: 1 },
    ]);
    expect(out.map((b) => b.id)).toEqual(['c']);
  });

  it('defaults missing name/icon/kind/desc and deep-copies fx', () => {
    const fx = { dmgPct: 0.3 };
    const out = sanitizeHealerBuffs([{ id: 'x', fx, floors: 1 }]);
    expect(out[0].kind).toBe('blessing');
    expect(out[0].name).toBe('x');
    expect(out[0].icon).toBe('ic_heart');
    out[0].fx.dmgPct = 9;
    expect(fx.dmgPct).toBe(0.3);
  });

  it('preserves the rested kind', () => {
    const out = sanitizeHealerBuffs([{ id: 'rested', kind: 'rested', fx: { xpPct: 0.25 }, floors: 3 }]);
    expect(out[0].kind).toBe('rested');
  });

  it('returns [] for non-arrays', () => {
    expect(sanitizeHealerBuffs(null)).toEqual([]);
    expect(sanitizeHealerBuffs('nope')).toEqual([]);
  });
});

describe('round-trip with the shipped catalog', () => {
  it('a bought blessing survives sanitize and reports its fx', () => {
    const def = HEALER_BLESSINGS[0];
    let buffs = upsertHealerBuff([], { ...def });
    buffs = upsertHealerBuff(buffs, { ...RESTED_BUFF });
    buffs = sanitizeHealerBuffs(buffs);
    expect(healerBuffFx(buffs, 'xpPct')).toBeCloseTo(RESTED_BUFF.fx.xpPct);
    expect(healerBuffFx(buffs, Object.keys(def.fx)[0])).toBeCloseTo(def.fx[Object.keys(def.fx)[0]]);
  });
});
