// Skill-icon tile palette. Kept deliberately separate from the in-game CLASSES
// colours (the HUD palette) — these drive ONLY the generated skill-icon tiles.
//
// Design brief (from the request):
//   - Background: a NEUTRAL dark fill so varied, colourful icon art never blends
//     into it. Kept subtly tinted toward each class so tiles still read as
//     class-consistent rather than a flat identical grey.
//   - Border: a BOLD, vivid version of the class colour — the primary class cue.
//
// Class colours: warrior = red, rogue = green, mage = yellow, templar = blue.
export const CLASS_TILE = {
  warrior: { border: '#e5442f', bg: '#4a231d' },
  rogue:   { border: '#3fc063', bg: '#1c3d28' },
  mage:    { border: '#f2c62c', bg: '#463a15' },
  templar: { border: '#3f8bef', bg: '#1b3053' },
};

// class letter (skill id / icon-key prefix) -> class key
export const CLASS_OF = { w: 'warrior', r: 'rogue', m: 'mage', t: 'templar' };

export function classForIcon(iconKey) {
  // icon keys look like sk_<letter>[a]_name  (e.g. sk_w_hardiness, sk_wa_brace)
  const m = /^sk_([a-z])/.exec(iconKey || '');
  return m ? CLASS_OF[m[1]] : null;
}
