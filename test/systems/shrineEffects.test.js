import { describe, it, expect } from 'vitest';
import {
  defaultShrineBuffs,
  shrineFxFrom,
  activeShrineBuffs,
  pickShrineKind,
} from '../../src/systems/shrineEffects.js';
import { SHRINE_DEFS } from '../../src/data/shrines.js';

// A tiny catalog to test the helpers in isolation, injected via the `defs` param.
const DEFS = {
  power:  { name: 'Power',  icon: 'ui_power', floors: 3, weight: 4, classic: true },
  blood:  { name: 'Blood',  icon: 'ic_heart', weight: 4, classic: true, instant: true },
  greed:  { name: 'Greed',  icon: 'ic_coffer', floors: 3, weight: 1, fx: { goldPct: 0.6 } },
  sorc:   { name: 'Sorc',   icon: 'ic_wand',  floors: 3, weight: 1, fx: { spellUp: 0.3, skillUp: 0.3 } },
  greed2: { name: 'Greed2', icon: 'ic_money', floors: 3, weight: 1, fx: { goldPct: 0.4 } },
  vigor:  { name: 'Vigor',  icon: 'potion_g', floors: 3, weight: 1, stamina: true, fx: {} },
};

describe('defaultShrineBuffs', () => {
  it('has a 0 slot for every non-instant kind and skips instants', () => {
    const b = defaultShrineBuffs(DEFS);
    expect(b).toEqual({ power: 0, greed: 0, sorc: 0, greed2: 0, vigor: 0 });
    expect('blood' in b).toBe(false);
  });

  it('covers the real catalog: excludes only instant kinds', () => {
    const b = defaultShrineBuffs();
    for (const kind in SHRINE_DEFS) {
      expect(kind in b).toBe(!SHRINE_DEFS[kind].instant);
    }
  });
});

describe('shrineFxFrom', () => {
  it('returns 0 with no buffs map', () => {
    expect(shrineFxFrom(null, 'goldPct', DEFS)).toBe(0);
    expect(shrineFxFrom(undefined, 'goldPct', DEFS)).toBe(0);
  });

  it('is 0 when the boon is not active', () => {
    expect(shrineFxFrom({ greed: 0 }, 'goldPct', DEFS)).toBe(0);
  });

  it('reads the magnitude of an active boon', () => {
    expect(shrineFxFrom({ greed: 3 }, 'goldPct', DEFS)).toBeCloseTo(0.6);
  });

  it('sums the same key across multiple active boons (stacking)', () => {
    expect(shrineFxFrom({ greed: 2, greed2: 1 }, 'goldPct', DEFS)).toBeCloseTo(1.0);
  });

  it('reads independent keys from a multi-key boon', () => {
    expect(shrineFxFrom({ sorc: 1 }, 'spellUp', DEFS)).toBeCloseTo(0.3);
    expect(shrineFxFrom({ sorc: 1 }, 'skillUp', DEFS)).toBeCloseTo(0.3);
  });

  it('is 0 for an unknown key or a classic/stamina boon without that key', () => {
    expect(shrineFxFrom({ greed: 3 }, 'nope', DEFS)).toBe(0);
    expect(shrineFxFrom({ power: 3, vigor: 3 }, 'goldPct', DEFS)).toBe(0);
  });
});

describe('activeShrineBuffs', () => {
  it('returns [] with no buffs map', () => {
    expect(activeShrineBuffs(null, DEFS)).toEqual([]);
  });

  it('lists only active kinds, in catalog order, with an s_ id', () => {
    const rows = activeShrineBuffs({ greed: 2, power: 1, sorc: 0 }, DEFS);
    expect(rows.map(r => r.kind)).toEqual(['power', 'greed']);
    expect(rows[0]).toEqual({ kind: 'power', id: 's_power', name: 'Power', icon: 'ui_power', floors: 1 });
    expect(rows[1].id).toBe('s_greed');
    expect(rows[1].floors).toBe(2);
  });
});

describe('pickShrineKind', () => {
  it('picks the first kind at roll 0 and the last at roll ~1', () => {
    expect(pickShrineKind(0, DEFS)).toBe('power');
    expect(pickShrineKind(1, DEFS)).toBe('vigor');
    expect(pickShrineKind(0.999999, DEFS)).toBe('vigor');
  });

  it('is weighted: the total weight sums the per-kind weights', () => {
    // DEFS weights: power4 + blood4 + greed1 + sorc1 + greed2 1 + vigor1 = 12.
    // roll 3/12 lands just past power(4)? 0.25*12 = 3 → still inside power [0,4).
    expect(pickShrineKind(3 / 12, DEFS)).toBe('power');
    // 0.35*12 = 4.2 → past power(4), into blood [4,8).
    expect(pickShrineKind(0.35, DEFS)).toBe('blood');
  });

  it('only ever returns a real catalog kind for the shipped defs', () => {
    const kinds = new Set(Object.keys(SHRINE_DEFS));
    for (let i = 0; i < 50; i++) {
      expect(kinds.has(pickShrineKind(i / 50))).toBe(true);
    }
  });
});

describe('SHRINE_DEFS catalog', () => {
  it('every boon has a name, an icon and either floors or instant', () => {
    for (const kind in SHRINE_DEFS) {
      const d = SHRINE_DEFS[kind];
      expect(typeof d.name).toBe('string');
      expect(typeof d.icon).toBe('string');
      expect(d.instant === true || typeof d.floors === 'number').toBe(true);
    }
  });

  it('ships at least 15 non-classic boons beyond the classics', () => {
    const fresh = Object.values(SHRINE_DEFS).filter(d => !d.classic);
    expect(fresh.length).toBeGreaterThanOrEqual(15);
  });

  it('non-classic, non-stamina boons carry at least one fx magnitude', () => {
    for (const kind in SHRINE_DEFS) {
      const d = SHRINE_DEFS[kind];
      if (d.classic || d.stamina) continue;
      expect(Object.keys(d.fx || {}).length).toBeGreaterThan(0);
    }
  });
});
