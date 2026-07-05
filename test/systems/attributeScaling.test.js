import { describe, it, expect } from 'vitest';
import {
  channelCoef, classDamageAttr, attrDamageFor,
  shieldMax, shieldRechargePerSec, shieldRechargeDelay, healAmount,
  ATTR_DMG_PER_POINT,
} from '../../src/systems/attributeScaling.js';
import {
  ATTR_STAT_CHANNELS, CLASS_SCALE_LADDER, SHIELD, CLASS_DMG_ATTR,
} from '../../src/data/attributeScaling.js';

const CLASSES = ['warrior', 'rogue', 'mage', 'templar'];

describe('channelCoef', () => {
  it('returns 0 for an unknown channel', () => {
    expect(channelCoef('nope', 'warrior')).toBe(0);
  });

  it('applies the ladder by the class rank in the channel ordering', () => {
    for (const key of Object.keys(ATTR_STAT_CHANNELS)) {
      const ch = ATTR_STAT_CHANNELS[key];
      ch.order.forEach((cls, rank) => {
        expect(channelCoef(key, cls)).toBeCloseTo(ch.base * CLASS_SCALE_LADDER[rank], 10);
      });
    }
  });

  it('honours the requested best→worst orderings', () => {
    // Might→Def: warrior best, mage worst.
    expect(channelCoef('def', 'warrior')).toBeGreaterThan(channelCoef('def', 'templar'));
    expect(channelCoef('def', 'templar')).toBeGreaterThan(channelCoef('def', 'rogue'));
    expect(channelCoef('def', 'rogue')).toBeGreaterThan(channelCoef('def', 'mage'));
    // Vitality→HP: templar best.
    expect(channelCoef('hp', 'templar')).toBeGreaterThan(channelCoef('hp', 'warrior'));
    expect(channelCoef('hp', 'warrior')).toBeGreaterThan(channelCoef('hp', 'rogue'));
    expect(channelCoef('hp', 'rogue')).toBeGreaterThan(channelCoef('hp', 'mage'));
    // Vitality→Stamina: warrior best, then rogue, then templar.
    expect(channelCoef('staminaMax', 'warrior')).toBeGreaterThan(channelCoef('staminaMax', 'rogue'));
    expect(channelCoef('staminaMax', 'rogue')).toBeGreaterThan(channelCoef('staminaMax', 'templar'));
    expect(channelCoef('staminaMax', 'templar')).toBeGreaterThan(channelCoef('staminaMax', 'mage'));
    // Agility→Evasion: rogue, mage, warrior, templar.
    expect(channelCoef('evasion', 'rogue')).toBeGreaterThan(channelCoef('evasion', 'mage'));
    expect(channelCoef('evasion', 'mage')).toBeGreaterThan(channelCoef('evasion', 'warrior'));
    expect(channelCoef('evasion', 'warrior')).toBeGreaterThan(channelCoef('evasion', 'templar'));
    // Spirit→spell power: mage best, warrior worst.
    expect(channelCoef('spellPower', 'mage')).toBeGreaterThan(channelCoef('spellPower', 'templar'));
    expect(channelCoef('spellPower', 'templar')).toBeGreaterThan(channelCoef('spellPower', 'rogue'));
    expect(channelCoef('spellPower', 'rogue')).toBeGreaterThan(channelCoef('spellPower', 'warrior'));
  });

  it('preserves the historical curve for the rank-#2 class (ladder[1] === 1.0)', () => {
    expect(CLASS_SCALE_LADDER[1]).toBe(1);
    // e.g. HP for a warrior (rank #2) equals the old global 11/pt.
    expect(channelCoef('hp', 'warrior')).toBeCloseTo(11, 10);
  });

  it('falls back to the base coefficient for a classless/unknown hero', () => {
    expect(channelCoef('hp', undefined)).toBeCloseTo(ATTR_STAT_CHANNELS.hp.base, 10);
    expect(channelCoef('hp', 'necromancer')).toBeCloseTo(ATTR_STAT_CHANNELS.hp.base, 10);
  });
});

describe('classDamageAttr', () => {
  it('maps each class to its single damage attribute', () => {
    expect(classDamageAttr('warrior')).toBe('might');
    expect(classDamageAttr('rogue')).toBe('agility');
    expect(classDamageAttr('mage')).toBe('spirit');
    expect(classDamageAttr('templar')).toBe('vitality');
  });
  it('falls back to might when classless/unknown', () => {
    expect(classDamageAttr(undefined)).toBe('might');
    expect(classDamageAttr('bard')).toBe('might');
  });
  it('data table agrees', () => {
    for (const c of CLASSES) expect(classDamageAttr(c)).toBe(CLASS_DMG_ATTR[c]);
  });
});

describe('attrDamageFor', () => {
  it('is attribute total × per-point', () => {
    expect(attrDamageFor(10, 'warrior')).toBeCloseTo(10 * ATTR_DMG_PER_POINT, 10);
  });
  it('never goes negative', () => {
    expect(attrDamageFor(-5, 'warrior')).toBe(0);
  });
  it('accepts a per-point override', () => {
    expect(attrDamageFor(10, 'mage', 3)).toBe(30);
  });
});

describe('shieldMax', () => {
  it('scales linearly off Spirit and the class multiplier (mage > templar > rogue > warrior)', () => {
    const spirit = 400;
    const m = shieldMax(spirit, 'mage');
    const t = shieldMax(spirit, 'templar');
    const r = shieldMax(spirit, 'rogue');
    const w = shieldMax(spirit, 'warrior');
    expect(m).toBeGreaterThan(t);
    expect(t).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(w);
    expect(m).toBeCloseTo(spirit * SHIELD.perSpirit * SHIELD.classMult.mage, 6);
    expect(w).toBeCloseTo(spirit * SHIELD.perSpirit * SHIELD.classMult.warrior, 6);
  });
  it('is linear in Spirit, independent of HP and UNCAPPED — can exceed any HP pool', () => {
    expect(shieldMax(200, 'mage')).toBeCloseTo(2 * shieldMax(100, 'mage'), 6);
    // A Spirit-stacked build's Veil dwarfs a modest HP pool — there is no HP ceiling.
    expect(shieldMax(5000, 'mage')).toBeGreaterThan(3000);
  });
  it('is 0 at zero Spirit and never negative', () => {
    expect(shieldMax(0, 'mage')).toBe(0);
    expect(shieldMax(-10, 'mage')).toBe(0);
  });
  it('uses the classless default multiplier for unknown classes', () => {
    expect(shieldMax(50, 'druid')).toBeCloseTo(50 * SHIELD.perSpirit * SHIELD.classMultDefault, 6);
  });
});

describe('shieldRechargePerSec', () => {
  it('starts at the base rate with baseline Spirit', () => {
    expect(shieldRechargePerSec(SHIELD.spiritBase, 'warrior')).toBeCloseTo(SHIELD.baseRechargePct, 10);
  });
  it('speeds up with Spirit above baseline, scaled by class', () => {
    const base = shieldRechargePerSec(SHIELD.spiritBase, 'mage');
    const more = shieldRechargePerSec(SHIELD.spiritBase + 100, 'mage');
    expect(more).toBeGreaterThan(base);
    // Mage's per-point speed-up beats a warrior's at the same Spirit.
    expect(shieldRechargePerSec(SHIELD.spiritBase + 100, 'mage'))
      .toBeGreaterThan(shieldRechargePerSec(SHIELD.spiritBase + 100, 'warrior'));
  });
  it('is capped at rechargeMaxPct', () => {
    expect(shieldRechargePerSec(1e6, 'mage')).toBeCloseTo(SHIELD.rechargeMaxPct, 10);
  });
  it('never dips below the base rate for below-baseline Spirit', () => {
    expect(shieldRechargePerSec(0, 'mage')).toBeCloseTo(SHIELD.baseRechargePct, 10);
  });
});

describe('shieldRechargeDelay', () => {
  it('exposes the tuned class-flat delay', () => {
    expect(shieldRechargeDelay()).toBe(SHIELD.rechargeDelay);
  });
});

describe('healAmount', () => {
  it('folds flat + level + Spirit(class-scaled) then rank/spell multipliers', () => {
    const raw = healAmount(24, 2.5, 10, 40, 'templar', 1, 1);
    const expected = (24 + 10 * 2.5 + 40 * channelCoef('heal', 'templar'));
    expect(raw).toBeCloseTo(expected, 6);
  });
  it('scales with rank and spell power', () => {
    const base = healAmount(24, 2.5, 10, 40, 'mage', 1, 1);
    expect(healAmount(24, 2.5, 10, 40, 'mage', 2, 1)).toBeCloseTo(base * 2, 6);
    expect(healAmount(24, 2.5, 10, 40, 'mage', 1, 1.5)).toBeCloseTo(base * 1.5, 6);
  });
  it('gives mages the strongest Spirit→heal scaling', () => {
    const spirit = 80;
    const mageGain = healAmount(0, 0, 0, spirit, 'mage') - healAmount(0, 0, 0, 0, 'mage');
    const warGain = healAmount(0, 0, 0, spirit, 'warrior') - healAmount(0, 0, 0, 0, 'warrior');
    expect(mageGain).toBeGreaterThan(warGain);
  });
  it('treats negative Spirit as zero', () => {
    expect(healAmount(24, 2.5, 10, -50, 'mage')).toBeCloseTo(24 + 25, 6);
  });
});
