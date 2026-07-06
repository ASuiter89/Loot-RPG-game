// ── THE PANTHEON OF THE DEEP · MYTHIC UNIQUES ────────────────────────────────
// The exclusive spoils of the capstone bosses. These artifacts NEVER roll from the
// world, a chest, a shrine or an ordinary boss — the ONLY source is a Pantheon
// kill (see src/systems/pinnacle.js → rollPinnacleDrop, whose per-boss loot pool
// lists ids from this file). They are the mechanical apex of the game: a Mythic
// carries the same FIXED signature the ordinary uniques do (one `native` stat +
// exactly six `mods` + a signature `power`), but authored to be build-defining and
// tuned a notch above anything a normal drop can reach.
//
// Entry shape mirrors src/data/uniques.js EXACTLY so the legacy builder
// (buildUnique / isFixedItem in src/legacy/game.js) can stamp one with zero special
// casing — plus a `mythic: true` marker so the shell can tint the tooltip, gate it
// out of the ordinary unique-collection catalog, and file it under the Pantheon
// codex. Only the numeric VALUES roll (scaled to drop depth, once, then lock); the
// stat/attribute/power identity below is permanent.
//
// Rules carried over from uniques.js and enforced by the test:
//   • `mods` is EXACTLY six entries — five `stat` mods + one `attr` mod — all
//     distinct, none equal to `native`, none the slot's auto headline (DMG for
//     weapons; for jewelry the native IS the headline, which is allowed).
//   • Caster gear uses SPELLPWR/CASTSPD (never SKILLPWR/ATKSPD); martial gear the
//     reverse — the two never mix on one piece.
//   • `power` is a real ITEM_POWERS key (validated against the live table on wiring).
//   • `flavor` is one original line — never references any other game or franchise.

// A stat modifier (percent / rating stat, e.g. CRIT, IDMG, SPELLPWR).
const s = (key) => ({ kind: 'stat', key });
// An attribute modifier (might / agility / spirit / luck / vitality).
const a = (key) => ({ kind: 'attr', key });

// Which equipment slot each gear base belongs to (mirrors SLOTS / BASE_SLOT in
// src/legacy/game.js + src/data/uniques.js). Stamped onto every def so a lookup
// never re-derives it and can never drift from the base.
const BASE_SLOT = {
  Greatsword: 'weapon', Staff: 'weapon', Longbow: 'weapon', Scythe: 'weapon',
  'Tower Shield': 'offhand', Crown: 'head', Chestplate: 'chest', Robe: 'chest',
  Amulet: 'amulet', Ring: 'ring',
};

// The raw Mythic definitions — one authored artifact per capstone theme. Slot is
// stamped below so it is never out of sync with `base`.
const DEFS = [
  // ── Thallor, the Drowned Colossus → a tidal warhammer-of-a-greatsword. Built to
  // punish the boss it comes from: apex single-target burst that scales on bosses.
  { id: 'pin_drownedVerdict', base: 'Greatsword', name: 'The Drowned Verdict', cls: 'warrior',
    native: 'BOSSDMG',
    mods: [s('ATK'), s('IDMG'), s('CRITDMG'), s('PEN'), s('HP'), a('might')], power: 'giantsbane',
    flavor: 'it fell with the tide upon a thing that thought itself a mountain, and the mountain drowned' },

  // ── Nyxara, the Starved Void → the caster's answer. A staff that turns the void's
  // own hunger into spell power and mana return.
  { id: 'pin_voidsongScepter', base: 'Staff', name: 'Voidsong Scepter', cls: 'mage',
    native: 'SPELLPWR',
    mods: [s('CRIT'), s('CRITDMG'), s('CASTSPD'), s('MPLEECH'), s('CDR'), a('spirit')], power: 'spellbound',
    flavor: 'it hums the one note the empty dark is always singing, and answers it with fire' },

  // ── Vorgrim, the Ashen Tyrant → a rogue's stormfeather longbow: relentless crit
  // volleys that execute what the ash leaves standing.
  { id: 'pin_stormfeather', base: 'Longbow', name: 'Stormfeather, the Last Volley', cls: 'rogue',
    native: 'CRITDMG',
    mods: [s('CRIT'), s('ATKSPD'), s('DBLSTRIKE'), s('EXEC'), s('PEN'), a('agility')], power: 'deadeye',
    flavor: 'each shaft is fletched with a feather off the storm, and none of them miss the throat twice' },

  // ── Sylvaine, the Thornqueen → the wall that outlasts her endless adds. A tower
  // shield of living bramble that answers every swarm.
  { id: 'pin_tidewall', base: 'Tower Shield', name: 'The Bramblewall', cls: 'templar',
    native: 'DR',
    mods: [s('HP'), s('THORNS'), s('TENAC'), s('BLOCK'), s('HPKILL'), a('vitality')], power: 'aegis',
    flavor: 'plant it once and the horde breaks upon a hedge that grows back faster than they can cut it' },

  // ── Umbriel, the Hollow Choir → a crown for the mind that can hold five phases in
  // its head at once. Peak caster cooldown + burst.
  { id: 'pin_hollowCrown', base: 'Crown', name: 'Crown of the Hollow Choir', cls: 'mage',
    native: 'SPELLPWR',
    mods: [s('CDR'), s('CASTSPD'), s('MP'), s('CRITDMG'), s('MCR'), a('spirit')], power: 'attuned',
    flavor: 'it sings back every voice the deep swallowed, and each one knows a different way to end a foe' },

  // ── Kaethon, the Stormcrowned → the warrior's storm-forged breastplate: a wall of
  // health that grows heavier with every kill.
  { id: 'pin_ashenAegis', base: 'Chestplate', name: 'The Stormforged Aegis', cls: 'warrior',
    native: 'HP',
    mods: [s('DR'), s('TENAC'), s('THORNS'), s('REGEN'), s('HPKILL'), a('vitality')], power: 'warded',
    flavor: 'quenched in the eye of a living storm, it has taken lightning full in the chest and only rung' },

  // ── A cross-class amulet from the deepest kills. Amulet native IS the headline
  // (allowed for jewelry), a heavy incoming-damage bulwark for any archetype.
  { id: 'pin_deepwaterHeart', base: 'Amulet', name: 'The Deepwater Heart', cls: 'any',
    native: 'DR',
    mods: [s('HP'), s('REGEN'), s('TENAC'), s('HPKILL'), s('THORNS'), a('vitality')], power: 'stalwart',
    flavor: 'it beats slow and cold and certain, the way the pressure a mile down beats against a hull' },

  // ── The apex signet — a universal boss-slayer ring, the trophy every Pantheon
  // hunter chases. Native IS the headline for rings.
  { id: 'pin_apexSignet', base: 'Ring', name: 'Signet of the Apex', cls: 'any',
    native: 'BOSSDMG',
    mods: [s('CRIT'), s('CRITDMG'), s('IDMG'), s('PEN'), s('HP'), a('might')], power: 'executioner',
    flavor: 'worn only by those who have stood over every god the deep could raise, and outlived them all' },
];

// Stamp the slot onto every def, mark it Mythic, and freeze — pure, immutable data.
export const PINNACLE_UNIQUES = DEFS.map((d) => Object.freeze({
  ...d, slot: BASE_SLOT[d.base], mythic: true,
}));

// Fast id lookups (built once).
const BY_ID = {};
for (const u of PINNACLE_UNIQUES) BY_ID[u.id] = u;

// The Mythic unique with this stable id, or null.
export function pinnacleUniqueById(id) { return BY_ID[id] || null; }
// Every Mythic unique id (the union of all per-boss loot pools live here).
export function allPinnacleUniqueIds() { return PINNACLE_UNIQUES.map((u) => u.id); }
