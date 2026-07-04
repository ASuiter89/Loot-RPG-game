import { describe, it, expect } from 'vitest';
import { ITEM_SETS } from '../../src/data/itemSets.js';
import { setPieceCount, setsCoverAllSlots, setSlots } from '../../src/systems/itemSets.js';

// ── Canonical gear taxonomy (mirrors SLOTS in src/legacy/game.js) ──
const SLOT_BASES = {
  weapon: ['Shortsword', 'Arming Sword', 'Rapier', 'Greatsword', 'Claymore', 'Hatchet', 'War Axe',
    'Greataxe', 'Battleaxe', 'Dagger', 'Stiletto', 'Kris', 'Mace', 'Morningstar', 'Maul', 'Spear',
    'Halberd', 'Pike', 'Staff', 'Wand', 'Shortbow', 'Longbow', 'Scythe', 'War Scythe'],
  offhand: ['Buckler', 'Kite Shield', 'Tower Shield', 'Tome', 'Focus', 'Quiver', 'Parrying Dagger'],
  head: ['Helm', 'Cap', 'Crown', 'Hood', 'Circlet'],
  chest: ['Chestplate', 'Robe', 'Cuirass', 'Tunic', 'Mail'],
  hands: ['Gauntlets', 'Gloves', 'Bracers', 'Grips'],
  legs: ['Greaves', 'Leggings', 'Tassets', 'Trousers'],
  ring: ['Ring', 'Band', 'Signet', 'Loop'],
  amulet: ['Amulet', 'Pendant', 'Necklace', 'Talisman', 'Charm'],
};
const BASE_SLOT = {};
for (const [slot, bases] of Object.entries(SLOT_BASES)) for (const b of bases) BASE_SLOT[b] = slot;
const SLOT_KEYS = Object.keys(SLOT_BASES);

// Bases whose family is CASTER (may use SPELLPWR/CASTSPD; never SKILLPWR/ATKSPD).
const CASTER_BASES = new Set(['Staff', 'Wand', 'Tome', 'Focus', 'Crown', 'Circlet',
  'Robe', 'Gloves', 'Leggings', 'Loop', 'Necklace']);
const MARTIAL_ONLY = ['SKILLPWR', 'ATKSPD'];
const CASTER_ONLY = ['SPELLPWR', 'CASTSPD'];

// Stat / attribute / power / class enumerations (mirror src/legacy/game.js + uniques.test).
const STAT_KEYS = new Set(['ATK', 'DEF', 'SPD', 'HP', 'MP', 'CRIT', 'CRITDMG', 'REGEN', 'ACC',
  'LEECH', 'MPLEECH', 'HPKILL', 'MPKILL', 'THORNS', 'DR', 'BLOCK', 'DODGE', 'IDMG', 'DBLSTRIKE',
  'CLEAVE', 'BOSSDMG', 'EXEC', 'PEN', 'GOLDFIND', 'XPGAIN', 'MAGICFIND', 'MATFIND', 'SPELLPWR',
  'SKILLPWR', 'CASTSPD', 'CDR', 'MCR', 'BLEED', 'STUNPWR', 'ATKSPD', 'TENAC']);
const ATTR_KEYS = new Set(['might', 'agility', 'spirit', 'vitality', 'luck']);
const POWER_KEYS = new Set(['vampiric', 'arcing', 'greedy', 'stalwart', 'attuned', 'brutal',
  'savage', 'keen', 'duelist', 'rending', 'giantsbane', 'cleaving', 'flurry', 'frenzied',
  'executioner', 'brutish', 'warlord', 'reckless', 'bloodthirsty', 'siphoning', 'ironhide',
  'warded', 'thornmail', 'evasive', 'bulwark', 'aegis', 'mending', 'spellbound', 'warmage',
  'spellblade', 'quickened', 'hasty', 'focused', 'tenacious', 'hemorrhage', 'concussive',
  'fleet', 'deadeye', 'fortunate', 'prospector', 'scholar', 'salvager']);
const CLASSES = new Set(['warrior', 'rogue', 'mage', 'templar', 'any']);
const FORBIDDEN_GAME = /\b(diablo|golden sun|roguelike|rogue-like|zelda|elden|dark souls|final fantasy|world of warcraft|warcraft|runescape|path of exile)\b/i;

// Stats a slot's headline OWNS automatically — a native/mod must never claim one.
function mandatoryHeadline(slot, base) {
  if (slot === 'weapon') return ['DMG'];
  if (slot === 'hands') return ['DEF', 'ATK'];
  if (slot === 'head' || slot === 'chest' || slot === 'legs') return ['DEF'];
  if (slot === 'offhand') {
    if (['Buckler', 'Kite Shield', 'Tower Shield'].includes(base)) return ['DEF', 'BLOCK'];
    if (['Tome', 'Focus'].includes(base)) return ['SPELLPWR'];
    if (base === 'Quiver') return ['ATK'];
    if (base === 'Parrying Dagger') return ['ATK', 'BLOCK'];
  }
  return []; // ring / amulet — the native IS the headline
}

const SETS = Object.entries(ITEM_SETS);
const ALL_PIECES = SETS.flatMap(([sid, s]) => s.pieces.map(p => ({ sid, set: s, p })));

describe('ITEM_SETS — set-level shape & coverage', () => {
  it('is a healthy roster of distinct sets (~20)', () => {
    expect(SETS.length).toBeGreaterThanOrEqual(20);
    const ids = SETS.map(([id]) => id);
    const names = SETS.map(([, s]) => s.name);
    const colors = SETS.map(([, s]) => s.color);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(colors).size, 'duplicate set colour').toBe(colors.length);
  });

  it('every set names itself, has a hex colour, a class and a completion power', () => {
    for (const [id, s] of SETS) {
      expect(typeof s.name, id).toBe('string');
      expect(s.name.length, id).toBeGreaterThan(0);
      expect(s.color, id).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(CLASSES.has(s.cls), `${id} bad cls ${s.cls}`).toBe(true);
      expect(s.power && s.power.name && s.power.stats && s.power.desc, `${id} completion power`).toBeTruthy();
      for (const k of Object.keys(s.power.stats)) expect(STAT_KEYS.has(k), `${id} power stat ${k}`).toBe(true);
      expect(FORBIDDEN_GAME.test(s.power.desc), `${id} power desc references another game`).toBe(false);
    }
  });

  it('bonus thresholds are integers in [2, size]; the top tier == size', () => {
    for (const [id, s] of SETS) {
      const size = setPieceCount(s);
      const tiers = Object.keys(s.bonus).map(Number);
      for (const t of tiers) {
        expect(Number.isInteger(t), `${id}:${t}`).toBe(true);
        expect(t, `${id}:${t}`).toBeGreaterThanOrEqual(2);
        expect(t, `${id}:${t}`).toBeLessThanOrEqual(size);
      }
      expect(Math.max(...tiers), `${id} top tier != size`).toBe(size);
      for (const tier of Object.values(s.bonus)) {
        for (const k of Object.keys(tier)) expect(STAT_KEYS.has(k), `${id} bonus stat ${k}`).toBe(true);
      }
    }
  });

  it('sets vary in size and cover every equipment slot', () => {
    const sizes = SETS.map(([, s]) => setPieceCount(s));
    expect(new Set(sizes).size, 'sets should vary in size').toBeGreaterThan(1);
    expect(Math.max(...sizes)).toBeGreaterThanOrEqual(5);
    expect(setsCoverAllSlots(SLOT_KEYS, ITEM_SETS)).toBe(true);
  });

  it("each set's pieces are one-per-slot for the slots it covers", () => {
    for (const [id, s] of SETS) {
      const slots = setSlots(s);
      expect(new Set(slots).size, `${id} has two pieces for one slot`).toBe(slots.length);
      expect(slots.length, `${id} size mismatch`).toBe(setPieceCount(s));
    }
  });
});

describe('ITEM_SETS — every piece is a valid fixed artifact (mirrors unique rules)', () => {
  it('piece ids are all globally unique and resolvable', () => {
    const ids = ALL_PIECES.map(x => x.p.id);
    expect(new Set(ids).size, 'duplicate piece id').toBe(ids.length);
    for (const { p } of ALL_PIECES) {
      expect(typeof p.id).toBe('string');
      expect(p.id.length).toBeGreaterThan(1);
    }
  });

  it('names are all distinct (no near-duplicates) and never just the base word', () => {
    const names = ALL_PIECES.map(x => x.p.name);
    expect(new Set(names).size, 'duplicate piece name').toBe(names.length);
    const norm = names.map(n => n.toLowerCase().replace(/[^a-z]/g, ''));
    expect(new Set(norm).size, 'near-duplicate piece name').toBe(norm.length);
    for (const { p } of ALL_PIECES) {
      expect(p.name.trim(), `name is just the base word: ${p.name}`).not.toBe(p.base);
      expect(p.name.trim().length).toBeGreaterThan(2);
    }
  });

  for (const { sid, p } of ALL_PIECES) {
    describe(`${sid} · ${p.name} (${p.base})`, () => {
      it('base is real and its stamped slot matches', () => {
        expect(BASE_SLOT[p.base], `unknown base ${p.base}`).toBeTruthy();
        expect(p.slot).toBe(BASE_SLOT[p.base]);
      });

      it('native is a valid stat, avoids the headline, never DMG', () => {
        expect(STAT_KEYS.has(p.native), `bad native ${p.native}`).toBe(true);
        const head = mandatoryHeadline(p.slot, p.base);
        expect(head, `native ${p.native} collides with headline`).not.toContain(p.native);
        expect(p.native).not.toBe('DMG');
      });

      it('has exactly 6 mods: 5 stats + 1 attribute, all distinct, none the native/headline', () => {
        expect(Array.isArray(p.mods)).toBe(true);
        expect(p.mods.length).toBe(6);
        const stats = p.mods.filter(m => m.kind === 'stat');
        const attrs = p.mods.filter(m => m.kind === 'attr');
        expect(attrs.length, 'exactly one attribute mod').toBe(1);
        expect(stats.length, 'exactly five stat mods').toBe(5);
        for (const m of stats) expect(STAT_KEYS.has(m.key), `bad stat mod ${m.key}`).toBe(true);
        for (const m of attrs) expect(ATTR_KEYS.has(m.key), `bad attr mod ${m.key}`).toBe(true);
        const keys = stats.map(m => m.key);
        expect(new Set(keys).size, 'duplicate stat mod').toBe(keys.length);
        expect(keys).not.toContain('DMG');
        expect(keys, 'a stat mod duplicates the native').not.toContain(p.native);
        for (const h of mandatoryHeadline(p.slot, p.base)) {
          expect(keys, `stat mod ${h} collides with headline`).not.toContain(h);
        }
      });

      it('respects the caster/martial family gate', () => {
        const keys = [p.native, ...p.mods.filter(m => m.kind === 'stat').map(m => m.key)];
        if (CASTER_BASES.has(p.base)) {
          for (const bad of MARTIAL_ONLY) expect(keys, `caster piece carries ${bad}`).not.toContain(bad);
        } else {
          for (const bad of CASTER_ONLY) expect(keys, `martial piece carries ${bad}`).not.toContain(bad);
        }
      });

      it('has a valid signature power and clean flavour', () => {
        expect(POWER_KEYS.has(p.power), `bad power ${p.power}`).toBe(true);
        expect(typeof p.flavor).toBe('string');
        expect(p.flavor.trim().length, 'flavor too short').toBeGreaterThan(8);
        expect(FORBIDDEN_GAME.test(p.name), `name references another game: ${p.name}`).toBe(false);
        expect(FORBIDDEN_GAME.test(p.flavor), `flavor references another game`).toBe(false);
      });
    });
  }
});

describe('ITEM_SETS — pieces feel distinct', () => {
  it('no two pieces share the same native + mods + power signature', () => {
    const sigs = ALL_PIECES.map(({ p }) => {
      const stats = p.mods.filter(m => m.kind === 'stat').map(m => m.key).sort().join(',');
      const attr = p.mods.filter(m => m.kind === 'attr').map(m => m.key).join(',');
      return `${p.native}|${stats}|${attr}|${p.power}`;
    });
    expect(new Set(sigs).size, 'two pieces are structurally identical').toBe(sigs.length);
  });

  it('no single power dominates the roster', () => {
    const counts = {};
    for (const { p } of ALL_PIECES) counts[p.power] = (counts[p.power] || 0) + 1;
    expect(Math.max(...Object.values(counts)), `a power is reused too often: ${JSON.stringify(counts)}`).toBeLessThanOrEqual(8);
  });

  it('within a set, every piece carries a different power', () => {
    for (const [id, s] of SETS) {
      const powers = s.pieces.map(p => p.power);
      expect(new Set(powers).size, `${id} repeats a power across its pieces`).toBe(powers.length);
    }
  });
});
