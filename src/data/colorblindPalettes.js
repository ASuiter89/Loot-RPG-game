// Colour-vision (colourblind) loot palettes — pure data.
//
// The loot tiers normally read by COLOUR alone (grey → white → green → blue →
// purple → orange → red, plus a teal set class). For the ~8% of players with a
// colour-vision deficiency several of those hues collapse (red/orange/green for
// red-green types; blue/teal for blue-yellow), so rarity becomes unreadable.
//
// A colour-vision MODE does two things (wired in src/legacy/game.js):
//   1. re-tints the tier tokens to hues that stay separable under that deficiency
//      (this table), applied to the `--<tier>` CSS custom properties and to the
//      canvas tier colours; and
//   2. turns on a per-tier SHAPE pip beside item names — a second, non-text
//      channel — so rarity also reads by silhouette (see .cb-pip in styles.css).
//
// Default play uses neither: with no mode selected the stock palette and no pip
// are shown, so the standard view is byte-identical.

// The tier keys, in rarity order. These MATCH the semantic tier tokens in
// src/styles.css (`--junk` … `--set`) so a palette entry maps 1:1 onto a token.
export const TIER_KEYS = ['junk', 'normal', 'uncommon', 'rare', 'epic', 'legendary', 'unique', 'set'];

// The selectable modes. '' is Off (stock palette, no pip). The three deficiency
// types cover the common forms: deuteranopia + protanopia are the two red-green
// kinds (by far the most common); tritanopia is the blue-yellow kind.
export const CB_MODES = [
  { id: '', label: 'Off' },
  { id: 'deuter', label: 'Deuteranopia' },
  { id: 'protan', label: 'Protanopia' },
  { id: 'tritan', label: 'Tritanopia' },
];

// Per-mode tier palettes. Neutrals (junk grey, normal white) are safe for every
// deficiency and stay put; the coloured tiers move to hues that survive it:
//   • red-green (deuter/protan) — greens become gold, reds become magenta (a
//     magenta keeps a blue component the red-green eye still sees), warm tiers
//     spread by lightness, cool tiers stay put.
//   • blue-yellow (tritan) — reds/greens are reliable and stay; blues/teals and
//     the orange spread apart, purple shifts to magenta on the red-green axis.
// Shapes (the pip) carry the rest, so these need only be as separable as practical.
export const CB_PALETTES = {
  deuter: {
    junk: '#6b6b6b', normal: '#f0f0f0', uncommon: '#c9a227', rare: '#3d7bff',
    epic: '#c46bff', legendary: '#ff9d2e', unique: '#ff4fc3', set: '#16c7ff',
  },
  protan: {
    junk: '#6b6b6b', normal: '#f0f0f0', uncommon: '#c2a83a', rare: '#4f7dff',
    epic: '#bd6bff', legendary: '#ffb02e', unique: '#ff57c8', set: '#23cfe0',
  },
  tritan: {
    junk: '#6b6b6b', normal: '#f0f0f0', uncommon: '#2ecc57', rare: '#0aa2ff',
    epic: '#d24bff', legendary: '#ff7a4d', unique: '#e11d2b', set: '#12b39a',
  },
};
