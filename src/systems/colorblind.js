// Colour-vision (colourblind) mode resolution — pure logic over the palette data.
//
// Keeps the "which palette / which colour" decisions out of the DOM/canvas layer:
// the legacy shell reads the persisted mode, asks these helpers for the active
// palette and each tier's colour, and applies them. Injecting nothing, touching
// nothing — just the palette table + a mode string in, a colour out.
import { CB_MODES, CB_PALETTES, TIER_KEYS } from '../data/colorblindPalettes.js';

// Every selectable mode id, Off ('') first.
export function cbModeIds() {
  return CB_MODES.map((m) => m.id);
}

// True for a real colour-vision mode (not Off / not an unknown string).
export function isCbMode(id) {
  return typeof id === 'string' && id !== '' && Object.prototype.hasOwnProperty.call(CB_PALETTES, id);
}

// Coerce any stored/loaded value to a valid mode, defaulting to Off. Guards
// against a corrupted save or a retired mode id reading back as garbage.
export function normalizeCbMode(v) {
  return isCbMode(v) ? v : '';
}

// The tier→hex palette for a mode, or null when Off / unknown (⇒ stock colours).
export function paletteFor(mode) {
  return isCbMode(mode) ? CB_PALETTES[mode] : null;
}

// Resolve a tier key's display colour under a mode, falling back to `base` (the
// stock hex) when Off or when the key isn't a tier we re-tint. `key` is a TIERS
// key ('rare', …) or 'set'.
export function cbTierColor(key, mode, base) {
  const p = paletteFor(mode);
  if (p && key && p[key]) return p[key];
  return base;
}

// The tier keys we re-tint, in rarity order (re-exported for the apply loop).
export function cbTierKeys() {
  return TIER_KEYS;
}
