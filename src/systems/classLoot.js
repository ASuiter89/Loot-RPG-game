// Class-relevant loot lean — decide which of a slot's base types a class favours,
// so a merchant, gambler or drop tilts toward build-appropriate gear (a Mage sees
// staves, wands, robes and tomes far more than quivers or plate) while still
// leaving a healthy share fully random. Pure: callers inject the data lookups and
// the RNG, so there are no globals here and it unit-tests cleanly.

// How strongly loot leans toward the class's favoured bases: this share of rolls
// draws from the favoured set, the rest roll fully at random — so off-favoured
// pieces you've invested a stat for still turn up.
export const CLASS_BASE_BIAS = 0.6;

// An armour base guarding at/above this DEF reads as "heavy" (plate, mail); below
// it as "light" (robe, cloth). Lets a class's armour lean pick the fitting look.
export const ARMOR_HEAVY_DEF = 1.1;

// Slots whose bases split by armour weight. Jewellery has no DEF, so it stays
// uniform — everyone wears rings the same — and weapons/off-hands lean by their
// own axis (category / family), handled below.
export const ARMOR_BIAS_SLOTS = ['head', 'chest', 'hands', 'legs'];

// 'heavy' | 'light' for an armour base, from its DEF (undefined DEF reads light).
export function armorWeight(def) {
  return typeof def === 'number' && def >= ARMOR_HEAVY_DEF ? 'heavy' : 'light';
}

// The subset of `names` a class favours for `slot`, or [] when the slot has no
// class lean (jewellery) or the class defines none for it. The classifiers are
// injected so this stays free of game globals:
//   categoryOf(name) → a weapon's category (Sword, Staff, …)
//   familyOf(name)   → an off-hand's family (shield, caster, ranged, dual)
//   weightOf(name)   → an armour base's weight ('heavy' | 'light')
export function favouredBases(slot, names, prefs, { categoryOf, familyOf, weightOf }) {
  if (!prefs) return [];
  if (slot === 'weapon' && prefs.weapons && prefs.weapons.length) {
    return names.filter(n => prefs.weapons.includes(categoryOf(n)));
  }
  if (slot === 'offhand' && prefs.offhands && prefs.offhands.length) {
    return names.filter(n => prefs.offhands.includes(familyOf(n)));
  }
  if (prefs.armor && ARMOR_BIAS_SLOTS.includes(slot)) {
    return names.filter(n => weightOf(n) === prefs.armor);
  }
  return [];
}

// Roll a base name for a slot: `bias` of the time from the favoured subset, else
// fully random. `rng` returns 0..1 (Math.random in production, a seeded stream in
// tests); falls back to a plain random pick when nothing is favoured.
export function rollFavouredBase(names, favoured, rng, bias = CLASS_BASE_BIAS) {
  const roll = arr => arr[Math.floor(rng() * arr.length)];
  return (favoured && favoured.length && rng() < bias) ? roll(favoured) : roll(names);
}
