import { describe, it, expect } from 'vitest';
import { ITEM_SETS } from '../../src/data/itemSets.js';
import { setPieceCount, setsCoverAllSlots } from '../../src/systems/itemSets.js';

// Mirrors SLOT_KEYS (Object.keys(SLOTS)) in src/legacy/game.js. A set's slots
// must all be real equipment slots, and between them the sets must cover every
// one so a set piece can roll for any slot the loot table produces.
const SLOT_KEYS = ['weapon', 'offhand', 'head', 'chest', 'hands', 'legs', 'ring', 'amulet'];

// Every stat key sets may grant (mirrors STAT_SHORT in src/legacy/game.js). A
// bonus or power referencing a stat outside this set would render/scale wrong.
const STAT_KEYS = new Set(['ATK', 'DEF', 'SPD', 'LCK', 'HP', 'MP', 'CRIT', 'ACC', 'CRITDMG',
  'REGEN', 'LEECH', 'MPLEECH', 'HPKILL', 'MPKILL', 'THORNS', 'DR', 'BLOCK', 'DODGE', 'IDMG',
  'DBLSTRIKE', 'CLEAVE', 'BOSSDMG', 'EXEC', 'PEN', 'GOLDFIND', 'XPGAIN', 'MAGICFIND', 'MATFIND',
  'SPELLPWR', 'SKILLPWR', 'CASTSPD', 'CDR', 'MCR', 'BLEED', 'STUNPWR', 'ATKSPD', 'TENAC']);

const SETS = Object.entries(ITEM_SETS);

describe('ITEM_SETS data validity', () => {
  it('every set names itself, has a hex colour and a signature power', () => {
    for (const [id, s] of SETS) {
      expect(typeof s.name, id).toBe('string');
      expect(s.name.length, id).toBeGreaterThan(0);
      expect(s.color, id).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(s.power, id).toBeTruthy();
      expect(typeof s.power.name, id).toBe('string');
      expect(typeof s.power.desc, id).toBe('string');
      expect(s.power.desc.length, id).toBeGreaterThan(0);
      expect(s.power.stats, id).toBeTruthy();
    }
  });

  it('slots are real, distinct equipment slots (at least two per set)', () => {
    for (const [id, s] of SETS) {
      expect(Array.isArray(s.slots), id).toBe(true);
      expect(s.slots.length, id).toBeGreaterThanOrEqual(2);
      expect(new Set(s.slots).size, id).toBe(s.slots.length); // no duplicate slot
      for (const slot of s.slots) expect(SLOT_KEYS, `${id}:${slot}`).toContain(slot);
    }
  });

  it("each bonus threshold is an integer in [2, size], and the completion tier (== size) exists", () => {
    for (const [id, s] of SETS) {
      const size = setPieceCount(s);
      const tiers = Object.keys(s.bonus).map(Number);
      for (const t of tiers) {
        expect(Number.isInteger(t), `${id}:${t}`).toBe(true);
        expect(t, `${id}:${t}`).toBeGreaterThanOrEqual(2);
        expect(t, `${id}:${t}`).toBeLessThanOrEqual(size);
      }
      // The top tier is the completion tier: it must equal the set's size, so
      // "Worn: n / size" and the final bonus line agree — and sets larger than 4
      // pieces genuinely define a bonus beyond the 4-piece mark.
      expect(Math.max(...tiers), id).toBe(size);
    }
  });

  it('every stat key granted (bonus tiers + power) is a known stat', () => {
    for (const [id, s] of SETS) {
      for (const tier of Object.values(s.bonus)) {
        for (const k of Object.keys(tier)) expect(STAT_KEYS.has(k), `${id}:${k}`).toBe(true);
      }
      for (const k of Object.keys(s.power.stats)) expect(STAT_KEYS.has(k), `${id}:${k}`).toBe(true);
    }
  });

  it('sets deliberately vary in size', () => {
    const sizes = SETS.map(([, s]) => setPieceCount(s));
    expect(new Set(sizes).size).toBeGreaterThan(1);
  });

  it('between them the sets cover every equipment slot', () => {
    expect(setsCoverAllSlots(SLOT_KEYS, ITEM_SETS)).toBe(true);
  });
});
