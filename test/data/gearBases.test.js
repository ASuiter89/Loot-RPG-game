import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SLOT_BASES, BASE_SLOT, WEAPON_REQ, OFFHAND_REQ, ARMOR_REQ, GATE_ATTRS, gateFor } from '../../src/data/gearBases.js';
import { CLASS_DMG_ATTR, CLASS_DMG_ATTR2 } from '../../src/data/attributeScaling.js';

// The playable roster still lives in the legacy monolith (CLASSES), which can't be
// imported under Node — it touches the DOM at module scope. So, like
// test/data/classRoster.test.js, we read the real source as TEXT and parse the two
// fields this file cares about: which weapon CATEGORIES each class may wield, and
// which sub-types belong to each category. The guarantees below then track the
// shipped tables rather than a fixture that drifts away from them.
const src = readFileSync(resolve(process.cwd(), 'src/legacy/game.js'), 'utf8');

/** class key → the weapon categories it can equip (CLASSES[*].weapons). */
const CLASS_WEAPONS = {};
{
  const start = src.indexOf('const CLASSES = {');
  expect(start, 'CLASSES not found in the monolith').toBeGreaterThan(-1);
  const block = src.slice(start, src.indexOf('\n};', start));
  for (const m of block.matchAll(/^ {2}([a-z]+): \{$/gm)) {
    const from = block.indexOf(m[0]);
    const body = block.slice(from, block.indexOf('\n  },', from));
    const weapons = /weapons: \[([^\]]*)\]/.exec(body);
    if (weapons) CLASS_WEAPONS[m[1]] = weapons[1].split(',').map((w) => w.trim().replace(/'/g, '')).filter(Boolean);
  }
}

/** weapon base name → its category (WEAPON_SUBTYPES[*].cat). */
const WEAPON_CAT = {};
{
  const start = src.indexOf('const WEAPON_SUBTYPES = {');
  expect(start, 'WEAPON_SUBTYPES not found in the monolith').toBeGreaterThan(-1);
  const block = src.slice(start, src.indexOf('\n};', start));
  for (const m of block.matchAll(/^ {2}'([^']+)':\s*\{ cat:'([A-Za-z]+)'/gm)) WEAPON_CAT[m[1]] = m[2];
}

const SLOT_KEYS = Object.keys(SLOT_BASES);

describe('gear bases — shape', () => {
  it('parsed a plausible roster (guards the regexes above)', () => {
    expect(Object.keys(CLASS_WEAPONS).length).toBeGreaterThanOrEqual(7);
    expect(Object.keys(WEAPON_CAT).length).toBeGreaterThanOrEqual(24);
  });

  it('names every base exactly once, across all slots', () => {
    const all = SLOT_KEYS.flatMap((s) => SLOT_BASES[s]);
    expect(new Set(all).size, 'a base name is used in two slots').toBe(all.length);
    expect(Object.keys(BASE_SLOT).length).toBe(all.length);
  });

  it('gives every base an attribute gate on a real attribute, with a positive weight', () => {
    for (const slot of SLOT_KEYS) {
      for (const base of SLOT_BASES[slot]) {
        const gate = gateFor(slot, base);
        expect(gate, `${slot}/${base} has no equip gate`).toBeTruthy();
        expect(GATE_ATTRS, `${slot}/${base} gates on an unknown attribute`).toContain(gate.attr);
        expect(gate.w, `${slot}/${base} weight`).toBeGreaterThan(0);
      }
    }
  });

  it('has no gate entry for a base the game never rolls', () => {
    // The bare weapon CATEGORY keys are the deliberate exception: they exist only as
    // the fallback for legacy saves whose item name carries no sub-type word.
    const categories = new Set(Object.values(WEAPON_CAT));
    const strays = Object.keys(WEAPON_REQ).filter((b) => BASE_SLOT[b] !== 'weapon' && !categories.has(b));
    expect(strays, 'WEAPON_REQ entry for an unknown base').toEqual([]);
    expect(Object.keys(OFFHAND_REQ).filter((b) => BASE_SLOT[b] !== 'offhand')).toEqual([]);
    for (const slot of Object.keys(ARMOR_REQ)) {
      expect(Object.keys(ARMOR_REQ[slot]).filter((b) => BASE_SLOT[b] !== slot), `ARMOR_REQ.${slot}`).toEqual([]);
    }
  });

  it('keeps every lookup that matches a base name longest-first', () => {
    // itemAttrReq finds a base by matching its name INSIDE the item's rolled name
    // ("Ancient Greathelm of Power"). Base names legitimately contain each other —
    // Scythe/War Scythe, Helm/Greathelm, Shield/Kite Shield — so the ONLY thing
    // keeping the short one from claiming the long one's item is that each lookup
    // list is sorted longest-first. Drop a sort and gates silently mis-resolve, so
    // guard the three that exist in the shell.
    for (const list of ['SUBTYPE_KEYS', 'OFFHAND_REQ_KEYS', 'ARMOR_REQ_KEYS']) {
      const re = new RegExp(`${list}(\\[s\\])? ?=[^;]*sort\\(\\(a, b\\) => b\\.length - a\\.length\\)`);
      expect(re.test(src), `${list} must be sorted longest-first`).toBe(true);
    }
  });
});

describe('gear bases — equip-gate coverage', () => {
  // RULE 1: whatever a hero mains, there is a base in EVERY slot their own
  // attribute unlocks — so no class is forced to buy a second attribute just to
  // fill a slot.
  it('offers a base gated on all five attributes in every slot', () => {
    const gaps = [];
    for (const slot of SLOT_KEYS) {
      const covered = new Set(SLOT_BASES[slot].map((b) => gateFor(slot, b).attr));
      for (const attr of GATE_ATTRS) if (!covered.has(attr)) gaps.push(`${slot} has no ${attr} base`);
    }
    expect(gaps).toEqual([]);
  });

  // RULE 2: a class's skills scale off its damage attribute(s), so at least one
  // weapon CATEGORY it can wield must gate on each of them. This is the rule the
  // Fortune-Seeker used to fail: its skills ride on Luck, but every ranged weapon
  // gated on Agility, so its signature attribute bought it no weapon at all.
  it('gives every class a weapon gated on each attribute its skills scale off', () => {
    const gaps = [];
    for (const [cls, categories] of Object.entries(CLASS_WEAPONS)) {
      const wieldable = SLOT_BASES.weapon.filter((b) => categories.includes(WEAPON_CAT[b]));
      expect(wieldable.length, `${cls} can wield no weapon at all`).toBeGreaterThan(0);
      const attrs = new Set(wieldable.map((b) => WEAPON_REQ[b].attr));
      for (const attr of [CLASS_DMG_ATTR[cls], CLASS_DMG_ATTR2[cls]]) {
        if (attr && !attrs.has(attr)) gaps.push(`${cls} has no ${attr}-gated weapon (wields ${categories.join('/')})`);
      }
    }
    expect(gaps).toEqual([]);
  });

  it('names a weapon category every class list refers to', () => {
    const categories = new Set(Object.values(WEAPON_CAT));
    for (const [cls, list] of Object.entries(CLASS_WEAPONS)) {
      for (const cat of list) expect(categories, `${cls} wields unknown category ${cat}`).toContain(cat);
    }
  });

  it("keeps the Fortune-Seeker's own Luck weapons on the Gun category", () => {
    // Guns are the class's identity weapon the way Staves are the Mage's: the only
    // Luck-gated weapon line, and the Fortune-Seeker is the class built to want it.
    const guns = SLOT_BASES.weapon.filter((b) => WEAPON_CAT[b] === 'Gun');
    expect(guns.length, 'the Gun category has no sub-types').toBeGreaterThan(0);
    for (const g of guns) expect(WEAPON_REQ[g].attr, `${g} gate`).toBe('luck');
    expect(CLASS_WEAPONS.fortune, 'the Fortune-Seeker cannot wield guns').toContain('Gun');
  });
});
