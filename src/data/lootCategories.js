// One-line description for each LOOT-bag filter tab, shown as a hover tooltip.
// The bag's slot tabs are icon-only (no text label), so this copy is the only place
// the category name and the kinds of gear it collects are spelled out for the player.
//
// Pure data. Keyed by the same slot keys as SLOTS in the game shell, plus 'all' for
// the leading tab. The label + icon are drawn from SLOTS at render time; this table
// supplies only the descriptive blurb. Kept quote-free so it survives the tooltip's
// double-quote escaping (see hoverTip() in src/legacy/game.js).
export const LOOT_CATEGORY_BLURB = {
  all:     'Every item in your bag, whatever the slot.',
  weapon:  'Swords, axes, maces, spears, bows, staves and wands.',
  offhand: 'Shields, tomes, focuses, quivers and parrying daggers.',
  head:    'Helms, caps, crowns, hoods and circlets.',
  chest:   'Chestplates, robes, cuirasses, tunics and mail.',
  hands:   'Gauntlets, gloves, bracers and grips.',
  legs:    'Greaves, leggings, tassets and trousers.',
  ring:    'Rings, bands, signets and loops.',
  amulet:  'Amulets, pendants, necklaces, talismans and charms.',
};
