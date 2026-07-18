// Hero-name normalization + validation for the new-game name screen.
// Pure string helpers so the naming rule (non-empty, single-spaced, capped
// length) is unit-tested away from the DOM/pointer wiring in legacy/game.js.

export const HERO_NAME_MAX = 16;

// Canonical stored form of a typed name: trim the ends, collapse internal
// whitespace runs to one space, cap at HERO_NAME_MAX characters. Non-string
// input (null/undefined/number from a stray caller) coerces to '' first.
export function normalizeHeroName(raw) {
  return String(raw == null ? '' : raw)
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, HERO_NAME_MAX);
}

// A quest can't begin without a real name — blank or whitespace-only input is
// rejected so the player is nudged to fill the box in rather than silently
// shipping a default hero name.
export function isValidHeroName(raw) {
  return normalizeHeroName(raw).length > 0;
}
