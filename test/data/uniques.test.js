import { describe, it, expect } from 'vitest';
import { UNIQUES, uniqueById, uniqueForBase, uniquesForSlot, allUniqueBases } from '../../src/data/uniques.js';

// ── The canonical gear taxonomy (mirrors SLOTS in src/legacy/game.js) ──
// Every base below must have EXACTLY ONE hand-crafted unique — the unique version
// of that exact gear type. This table is the source of truth the test gates on, so
// adding a new base to the game (and forgetting its unique) fails here.
const SLOT_BASES = {
  weapon: ['Shortsword', 'Arming Sword', 'Rapier', 'Greatsword', 'Claymore',
    'Hatchet', 'War Axe', 'Greataxe', 'Battleaxe', 'Dagger', 'Stiletto', 'Kris',
    'Mace', 'Morningstar', 'Maul', 'Spear', 'Halberd', 'Pike', 'Staff', 'Wand',
    'Shortbow', 'Longbow', 'Scythe', 'War Scythe'],
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
const ALL_BASES = Object.keys(BASE_SLOT);

// Bases whose family is CASTER (may use SPELLPWR / CASTSPD; never SKILLPWR / ATKSPD).
// Everything else is MARTIAL (may use SKILLPWR / ATKSPD; never SPELLPWR / CASTSPD).
const CASTER_BASES = new Set(['Staff', 'Wand', 'Tome', 'Focus', 'Crown', 'Circlet',
  'Robe', 'Gloves', 'Leggings', 'Loop', 'Necklace']);
const MARTIAL_ONLY = ['SKILLPWR', 'ATKSPD'];
const CASTER_ONLY = ['SPELLPWR', 'CASTSPD'];

// Stat keys buildUnique/affixStatValue can roll (mirrors AFFIX_CURVES + CRITDMG).
const STAT_KEYS = new Set(['ATK', 'DEF', 'SPD', 'HP', 'MP', 'CRIT', 'CRITDMG', 'REGEN', 'ACC',
  'LEECH', 'MPLEECH', 'HPKILL', 'MPKILL', 'THORNS', 'DR', 'BLOCK', 'DODGE', 'IDMG', 'DBLSTRIKE',
  'CLEAVE', 'BOSSDMG', 'EXEC', 'PEN', 'GOLDFIND', 'XPGAIN', 'MAGICFIND', 'MATFIND', 'SPELLPWR',
  'SKILLPWR', 'CASTSPD', 'CDR', 'MCR', 'BLEED', 'STUNPWR', 'ATKSPD', 'TENAC']);
const ATTR_KEYS = new Set(['might', 'agility', 'spirit', 'vitality', 'luck']);
// Signature powers (mirrors ITEM_POWERS keys in src/legacy/game.js).
const POWER_KEYS = new Set(['vampiric', 'arcing', 'greedy', 'stalwart', 'attuned', 'brutal',
  'savage', 'keen', 'duelist', 'rending', 'giantsbane', 'cleaving', 'flurry', 'frenzied',
  'executioner', 'brutish', 'warlord', 'reckless', 'bloodthirsty', 'siphoning', 'ironhide',
  'warded', 'thornmail', 'evasive', 'bulwark', 'aegis', 'mending', 'spellbound', 'warmage',
  'spellblade', 'quickened', 'hasty', 'focused', 'tenacious', 'hemorrhage', 'concussive',
  'fleet', 'deadeye', 'fortunate', 'prospector', 'scholar', 'salvager']);
const CLASSES = new Set(['warrior', 'rogue', 'mage', 'templar', 'any']);

// Stats a slot's headline OWNS automatically — a native/mod must never claim one
// (it's baked in and would collide). Mirrors uniqueMandatoryHeadline + the off-hand
// families in applyBaseStats.
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

describe('UNIQUES data — shape & coverage', () => {
  it('is a non-empty array with one unique per gear type (58 total)', () => {
    expect(Array.isArray(UNIQUES)).toBe(true);
    expect(UNIQUES.length).toBe(ALL_BASES.length);
    const bases = allUniqueBases().slice().sort();
    expect(bases).toEqual(ALL_BASES.slice().sort());
  });

  it('every base maps to exactly one unique, in its correct slot', () => {
    for (const base of ALL_BASES) {
      const u = uniqueForBase(base);
      expect(u, `no unique for base ${base}`).toBeTruthy();
      expect(u.base).toBe(base);
      expect(u.slot, `unique for ${base} has wrong slot`).toBe(BASE_SLOT[base]);
    }
    // No stray unique for an unknown base.
    for (const u of UNIQUES) expect(ALL_BASES, `unknown base ${u.base}`).toContain(u.base);
  });

  it('ids and names are all unique (no near-duplicate names)', () => {
    const ids = UNIQUES.map(u => u.id);
    expect(new Set(ids).size, 'duplicate id').toBe(ids.length);
    const names = UNIQUES.map(u => u.name);
    expect(new Set(names).size, 'duplicate name').toBe(names.length);
    // Case/space-insensitive collision guard so two names can't be trivially alike.
    const norm = names.map(n => n.toLowerCase().replace(/[^a-z]/g, ''));
    expect(new Set(norm).size, 'near-duplicate name (differs only by case/punct)').toBe(norm.length);
    // Every id resolves back through the lookup.
    for (const u of UNIQUES) expect(uniqueById(u.id)).toBe(u);
  });
});

describe('UNIQUES data — every field is valid', () => {
  for (const u of UNIQUES) {
    describe(`${u.name} (${u.base})`, () => {
      it('has valid id/name/cls/flavor', () => {
        expect(typeof u.id).toBe('string');
        expect(u.id.length).toBeGreaterThan(1);
        expect(typeof u.name).toBe('string');
        expect(u.name.trim().length).toBeGreaterThan(2);
        expect(u.name.trim(), 'name must not be just the base word').not.toBe(u.base);
        expect(CLASSES.has(u.cls), `bad cls ${u.cls}`).toBe(true);
        expect(typeof u.flavor).toBe('string');
        expect(u.flavor.trim().length, 'flavor too short').toBeGreaterThan(8);
      });

      it('has a valid native signature stat that avoids the headline', () => {
        expect(STAT_KEYS.has(u.native), `bad native ${u.native}`).toBe(true);
        const head = mandatoryHeadline(u.slot, u.base);
        expect(head, `native ${u.native} collides with headline`).not.toContain(u.native);
        expect(u.native, 'native must never be DMG').not.toBe('DMG');
      });

      it('has exactly 6 mods: 5 stats + 1 attribute, all distinct', () => {
        expect(Array.isArray(u.mods)).toBe(true);
        expect(u.mods.length).toBe(6);
        const stats = u.mods.filter(m => m.kind === 'stat');
        const attrs = u.mods.filter(m => m.kind === 'attr');
        expect(attrs.length, 'exactly one attribute mod').toBe(1);
        expect(stats.length, 'exactly five stat mods').toBe(5);
        for (const m of stats) expect(STAT_KEYS.has(m.key), `bad stat mod ${m.key}`).toBe(true);
        for (const m of attrs) expect(ATTR_KEYS.has(m.key), `bad attr mod ${m.key}`).toBe(true);
        const statKeys = stats.map(m => m.key);
        expect(new Set(statKeys).size, 'duplicate stat mod').toBe(statKeys.length);
        expect(statKeys, 'a stat mod must never be DMG').not.toContain('DMG');
        // Mods never duplicate the native or a headline stat.
        expect(statKeys, 'a stat mod duplicates the native').not.toContain(u.native);
        for (const h of mandatoryHeadline(u.slot, u.base)) {
          expect(statKeys, `stat mod ${h} collides with headline`).not.toContain(h);
        }
      });

      it('respects the caster/martial family gate', () => {
        const keys = [u.native, ...u.mods.filter(m => m.kind === 'stat').map(m => m.key)];
        if (CASTER_BASES.has(u.base)) {
          for (const bad of MARTIAL_ONLY) expect(keys, `caster item carries ${bad}`).not.toContain(bad);
        } else {
          for (const bad of CASTER_ONLY) expect(keys, `martial item carries ${bad}`).not.toContain(bad);
        }
      });

      it('has a valid signature power', () => {
        expect(POWER_KEYS.has(u.power), `bad power ${u.power}`).toBe(true);
      });

      it('never references another game (player-facing copy)', () => {
        const forbidden = /\b(diablo|golden sun|roguelike|rogue-like|zelda|elden|dark souls|final fantasy|world of warcraft|warcraft|runescape|path of exile)\b/i;
        expect(forbidden.test(u.name), `name references another game: ${u.name}`).toBe(false);
        expect(forbidden.test(u.flavor), `flavor references another game: ${u.flavor}`).toBe(false);
      });
    });
  }
});

describe('UNIQUES data — each unique feels distinct', () => {
  it('no two uniques share the same native + mods + power signature', () => {
    const sigs = UNIQUES.map(u => {
      const stats = u.mods.filter(m => m.kind === 'stat').map(m => m.key).sort().join(',');
      const attr = u.mods.filter(m => m.kind === 'attr').map(m => m.key).join(',');
      return `${u.native}|${stats}|${attr}|${u.power}`;
    });
    expect(new Set(sigs).size, 'two uniques are structurally identical').toBe(sigs.length);
  });

  it('spreads signature powers around (no single power dominates)', () => {
    const counts = {};
    for (const u of UNIQUES) counts[u.power] = (counts[u.power] || 0) + 1;
    const max = Math.max(...Object.values(counts));
    // With 58 uniques and 42 powers, a well-spread set never leans hard on one power.
    expect(max, `a power is reused too often: ${JSON.stringify(counts)}`).toBeLessThanOrEqual(6);
  });

  it('uniquesForSlot returns exactly the bases that slot owns', () => {
    for (const [slot, bases] of Object.entries(SLOT_BASES)) {
      const got = uniquesForSlot(slot).map(u => u.base).sort();
      expect(got, `slot ${slot}`).toEqual(bases.slice().sort());
    }
    expect(uniquesForSlot('nope')).toEqual([]);
  });
});
