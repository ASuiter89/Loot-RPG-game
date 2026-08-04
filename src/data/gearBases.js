// ── GEAR BASES & THEIR EQUIP GATES ───────────────────────────────────────────
// The canonical list of every base item type the game rolls, per slot, plus the
// ATTRIBUTE REQUIREMENT each base demands to wear it. Pure data — no logic, no
// imports. The legacy shell reads both tables (SLOTS[*].names and the itemAttrReq
// resolver); test/data/gearBases.test.js gates the coverage rules below.
//
// ── Why a base gates on an attribute ────────────────────────────────────────
// Every gear slot — weapon, off-hand, armour AND jewelry — demands a minimum in
// ONE attribute, computed live from the base and the piece's ilvl (never stored
// on the item, so old saves and the Enchanter's rerolls need no migration). The
// required attribute is the one that base's natural wearer leans on, which nudges
// each class toward gear that fits it. `w` is the per-type WEIGHT: the gate is
// round(8 + ilvl * slope * w), with the slope steepening as you descend, so
// heavier bases demand a bigger stake and off-class dabbling gates out harder the
// deeper you go (see attrReqValue in src/legacy/game.js for the full formula).
//
// ── The coverage rules ──────────────────────────────────────────────────────
// Two invariants keep every class in gear it can actually wear with the
// attributes its own build already pays for:
//
//   1. EVERY SLOT OFFERS ALL FIVE ATTRIBUTES. Each slot carries at least one base
//      gated on each of Might, Agility, Spirit, Vitality and Luck — so whatever a
//      hero mains, there is a piece in every slot their own attribute unlocks.
//   2. EVERY CLASS HAS A WEAPON ON ITS IDENTITY ATTRIBUTE. Skills scale off a
//      class's damage attribute(s), so at least one weapon CATEGORY the class can
//      wield must gate on each of them. (This is what the Gun category exists for:
//      the Fortune-Seeker's skills ride on Luck, but every ranged weapon used to
//      gate on Agility, so its signature stat bought it no weapon at all.)
//
// A hero can still carry an "off-class" piece — they just have to invest that
// attribute first. The rules only guarantee that they never HAVE to.

/** Every base item name that rolls for a slot. Mirrored by SLOTS in the shell. */
export const SLOT_BASES = {
  weapon: [
    'Shortsword', 'Arming Sword', 'Rapier', 'Runeblade', 'Greatsword', 'Claymore',
    'Hatchet', 'War Axe', 'Greataxe', 'Battleaxe',
    'Dagger', 'Stiletto', 'Kris',
    'Mace', 'Morningstar', 'Maul', 'Warhammer',
    'Spear', 'Halberd', 'Pike',
    'Staff', 'Wand',
    'Shortbow', 'Longbow',
    'Flintlock', 'Hand Cannon',
    'Scythe', 'War Scythe',
  ],
  offhand: ['Buckler', 'Kite Shield', 'Tower Shield', 'Spiked Shield', 'Tome', 'Focus',
    'Quiver', 'Bandolier', 'Parrying Dagger'],
  head:   ['Helm', 'Greathelm', 'Cap', 'Crown', 'Hood', 'Circlet'],
  chest:  ['Chestplate', 'Robe', 'Cuirass', 'Tunic', 'Mail', 'Coat'],
  hands:  ['Gauntlets', 'Gloves', 'Bracers', 'Grips', 'Handwraps'],
  legs:   ['Greaves', 'Leggings', 'Tassets', 'Trousers', 'Breeches'],
  ring:   ['Ring', 'Band', 'Signet', 'Loop', 'Coil'],
  amulet: ['Amulet', 'Pendant', 'Necklace', 'Talisman', 'Charm'],
};

/** base name → the slot it belongs to (derived, so it can never drift). */
export const BASE_SLOT = {};
for (const [slot, bases] of Object.entries(SLOT_BASES)) for (const b of bases) BASE_SLOT[b] = slot;

// ── WEAPONS ─────────────────────────────────────────────────────────────────
// Keyed by SUB-TYPE first; the bare CATEGORY keys at the bottom are the legacy
// fallback for old saves whose weapon name carries no sub-type word. Heavy melee
// leans on Might, finesse and ranged on Agility, casting on Spirit, the braced
// two-handers on Vitality, and firearms on Luck — every shot a wager.
export const WEAPON_REQ = {
  // Swords
  'Shortsword': { attr: 'might',   w: 0.90 }, 'Arming Sword': { attr: 'might',   w: 1.00 },
  'Rapier':     { attr: 'agility', w: 0.78 }, 'Greatsword':   { attr: 'might',   w: 1.45 },
  'Claymore':   { attr: 'might',   w: 1.40 },
  // ... and the spell-etched blade a hybrid blade-caster carries (Spirit)
  'Runeblade':  { attr: 'spirit',  w: 0.92 },
  // Axes
  'Hatchet':    { attr: 'might',   w: 0.95 }, 'War Axe':      { attr: 'might',   w: 1.10 },
  'Greataxe':   { attr: 'might',   w: 1.55 }, 'Battleaxe':    { attr: 'might',   w: 1.45 },
  // Daggers (finesse → Agility)
  'Dagger':     { attr: 'agility', w: 0.78 }, 'Stiletto':     { attr: 'agility', w: 0.75 },
  'Kris':       { attr: 'agility', w: 0.82 },
  // Maces — plus the Warhammer, braced rather than swung (Vitality)
  'Mace':       { attr: 'might',   w: 1.05 }, 'Morningstar':  { attr: 'might',   w: 1.12 },
  'Maul':       { attr: 'might',   w: 1.50 }, 'Warhammer':    { attr: 'vitality', w: 1.32 },
  // Spears
  'Spear':      { attr: 'might',   w: 0.95 }, 'Halberd':      { attr: 'might',   w: 1.40 },
  'Pike':       { attr: 'might',   w: 1.30 },
  // Staves (casting → Spirit)
  'Staff':      { attr: 'spirit',  w: 1.00 }, 'Wand':         { attr: 'spirit',  w: 0.85 },
  // Bows (ranged → Agility)
  'Shortbow':   { attr: 'agility', w: 0.88 }, 'Longbow':      { attr: 'agility', w: 0.95 },
  // Guns (powder & chance → Luck)
  'Flintlock':  { attr: 'luck',    w: 0.86 }, 'Hand Cannon':  { attr: 'luck',    w: 1.28 },
  // Scythes
  'Scythe':     { attr: 'might',   w: 1.15 }, 'War Scythe':   { attr: 'might',   w: 1.42 },
  // Bare-category fallbacks for legacy weapons whose name has no sub-type word.
  // (Dagger/Mace/Spear/Staff/Scythe already appear above as identically-named
  // sub-types, so only Sword/Axe/Bow/Gun need a category-only entry here.)
  'Sword':      { attr: 'might',   w: 1.00 }, 'Axe':          { attr: 'might',   w: 1.05 },
  'Bow':        { attr: 'agility', w: 0.90 }, 'Gun':          { attr: 'luck',    w: 0.95 },
};

// ── OFF-HANDS ───────────────────────────────────────────────────────────────
// Each gates on the stat its family rewards: plain shields → Vitality (a tank
// commitment that scales with the shield's heft), the bashing Spiked Shield →
// Might, caster off-hands → Spirit, quiver / parry-blade → Agility, and the
// gunner's Bandolier → Luck.
export const OFFHAND_REQ = {
  'Buckler':      { attr: 'vitality', w: 0.55 }, 'Kite Shield':  { attr: 'vitality', w: 0.80 },
  'Tower Shield': { attr: 'vitality', w: 1.10 }, 'Spiked Shield': { attr: 'might',   w: 0.76 },
  'Tome':         { attr: 'spirit',   w: 0.90 }, 'Focus':        { attr: 'spirit',   w: 0.70 },
  'Quiver':       { attr: 'agility',  w: 0.70 }, 'Bandolier':    { attr: 'luck',     w: 0.72 },
  'Parrying Dagger': { attr: 'agility', w: 0.75 },
};

// ── ARMOUR & JEWELRY ────────────────────────────────────────────────────────
// Keyed by SLOT then base word. Each base's gate pairs with its signature innate
// (see BASE_STATS in the shell): the gate is the PRICE of the base's identity, and
// your primary attribute routes you to the base that rewards it. Every slot spreads
// across all five attributes — a Vitality tank piece, a Might bruiser piece, an
// Agility evasion piece, a Spirit caster piece and a Luck finder's piece — so no
// class is ever forced to buy a second attribute just to fill a slot. Weights are
// gentler than weapons' (armour is mandatory, so its gate shouldn't be brutal) and
// jewelry gentler still. Matched against the item's OWN slot only, so base words
// never collide across slots.
export const ARMOR_REQ = {
  head: {
    'Helm': { attr: 'vitality', w: 0.80 }, 'Greathelm': { attr: 'might', w: 0.86 },
    'Cap': { attr: 'luck', w: 0.46 }, 'Hood': { attr: 'agility', w: 0.55 },
    'Crown': { attr: 'spirit', w: 0.62 }, 'Circlet': { attr: 'spirit', w: 0.55 },
  },
  chest: {
    'Chestplate': { attr: 'vitality', w: 0.95 }, 'Cuirass': { attr: 'might', w: 0.78 },
    'Mail': { attr: 'might', w: 0.82 }, 'Tunic': { attr: 'agility', w: 0.55 },
    'Robe': { attr: 'spirit', w: 0.55 }, 'Coat': { attr: 'luck', w: 0.52 },
  },
  hands: {
    'Gauntlets': { attr: 'might', w: 0.60 }, 'Bracers': { attr: 'vitality', w: 0.48 },
    'Grips': { attr: 'agility', w: 0.46 }, 'Gloves': { attr: 'spirit', w: 0.42 },
    'Handwraps': { attr: 'luck', w: 0.44 },
  },
  legs: {
    'Greaves': { attr: 'vitality', w: 0.78 }, 'Tassets': { attr: 'might', w: 0.62 },
    'Trousers': { attr: 'agility', w: 0.48 }, 'Leggings': { attr: 'spirit', w: 0.46 },
    'Breeches': { attr: 'luck', w: 0.46 },
  },
  ring: {
    'Signet': { attr: 'might', w: 0.42 }, 'Band': { attr: 'vitality', w: 0.42 },
    'Loop': { attr: 'spirit', w: 0.42 }, 'Ring': { attr: 'luck', w: 0.42 },
    'Coil': { attr: 'agility', w: 0.42 },
  },
  amulet: {
    'Necklace': { attr: 'spirit', w: 0.48 }, 'Pendant': { attr: 'vitality', w: 0.45 },
    'Talisman': { attr: 'luck', w: 0.42 }, 'Amulet': { attr: 'might', w: 0.45 },
    'Charm': { attr: 'agility', w: 0.40 },
  },
};

/** The five attributes a gate can demand — the axis the coverage rules run over. */
export const GATE_ATTRS = ['might', 'agility', 'spirit', 'vitality', 'luck'];

/**
 * The {attr, w} gate a base demands, or null when the name isn't a known base.
 * `slot` disambiguates armour/jewelry (a "Ring" and a chest "Mail" live in
 * separate tables); weapons and off-hands are keyed globally.
 */
export function gateFor(slot, base) {
  if (slot === 'weapon') return WEAPON_REQ[base] || null;
  if (slot === 'offhand') return OFFHAND_REQ[base] || null;
  return (ARMOR_REQ[slot] && ARMOR_REQ[slot][base]) || null;
}
