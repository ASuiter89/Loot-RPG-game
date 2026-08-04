import { describe, it, expect } from 'vitest';
import { HEALER_BLESSINGS, RESTED_BUFF, HEALER_BUFF_FLOORS, BLESSING_FLOORS } from '../../src/data/healerBuffs.js';

// The fx keys the combat formulas actually read (see foodFx / healerFx wiring in
// src/legacy/game.js). A buff carrying an unknown key would silently do nothing.
const KNOWN_FX = new Set([
  'dmgPct', 'maxHpPct', 'maxMpPct', 'defFlat', 'critPct', 'dodgePct',
  'regen', 'goldPct', 'magicPct', 'lifesteal', 'thorns', 'xpPct', 'dropPct',
]);

function checkBuff(b) {
  expect(typeof b.id).toBe('string');
  expect(b.id.length).toBeGreaterThan(0);
  expect(typeof b.name).toBe('string');
  expect(b.name.length).toBeGreaterThan(0);
  expect(typeof b.icon).toBe('string');
  expect(b.icon.length).toBeGreaterThan(0);
  expect(typeof b.desc).toBe('string');
  expect(b.desc.length).toBeGreaterThan(0);
  expect(b.floors).toBeGreaterThan(0);
  expect(b.fx && typeof b.fx === 'object').toBe(true);
  expect(Object.keys(b.fx).length).toBeGreaterThan(0);
  for (const [k, v] of Object.entries(b.fx)) {
    expect(KNOWN_FX.has(k)).toBe(true);
    expect(typeof v).toBe('number');
    expect(v).toBeGreaterThan(0);
  }
}

describe('RESTED_BUFF', () => {
  it('is a well-formed rested-kind buff granting XP for the shared duration', () => {
    checkBuff(RESTED_BUFF);
    expect(RESTED_BUFF.kind).toBe('rested');
    expect(RESTED_BUFF.fx.xpPct).toBeGreaterThan(0);
    expect(RESTED_BUFF.floors).toBe(HEALER_BUFF_FLOORS);
  });
});

describe('HEALER_BLESSINGS catalog', () => {
  it('has several blessings with unique ids', () => {
    expect(HEALER_BLESSINGS.length).toBeGreaterThanOrEqual(3);
    const ids = HEALER_BLESSINGS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every blessing is well-formed, priced and marked as a blessing', () => {
    for (const b of HEALER_BLESSINGS) {
      checkBuff(b);
      expect(b.kind).toBe('blessing');
      expect(typeof b.base).toBe('number');
      expect(b.base).toBeGreaterThan(0);
    }
  });

  it('every blessing runs the full BLESSING_FLOORS duration', () => {
    expect(BLESSING_FLOORS).toBe(5);
    for (const b of HEALER_BLESSINGS) expect(b.floors).toBe(BLESSING_FLOORS);
  });

  it('a bought blessing outlasts the free Rested bonus', () => {
    expect(BLESSING_FLOORS).toBeGreaterThan(HEALER_BUFF_FLOORS);
  });

  it('blessing ids never collide with the rested id', () => {
    expect(HEALER_BLESSINGS.some((b) => b.id === RESTED_BUFF.id)).toBe(false);
  });

  it('desc never references other games / genre jargon (player-facing copy rule)', () => {
    const banned = /diablo|roguelike|rogue-like|golden sun|zelda|elden|dark souls|poe|path of exile/i;
    for (const b of [RESTED_BUFF, ...HEALER_BLESSINGS]) {
      expect(banned.test(b.desc)).toBe(false);
      expect(banned.test(b.name)).toBe(false);
    }
  });
});
