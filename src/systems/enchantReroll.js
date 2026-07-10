// Enchanter "Reroll all" — how many bonus modifiers a reforge should roll. Pure,
// stateless, RNG-free so it's unit-testable; the actual affix rolling stays in the
// legacy shell (it needs the slot pools + injected RNG).
//
// "Reroll all" REFORGES the properties a piece already carries — it gambles their
// types/values, but it must NEVER ADD slots (that is Augment's job, priced per
// slot). So the number of stat/attr modifiers it rolls equals the piece's CURRENT
// bonus count. The old behaviour rolled a FRESH random count up to the rarity cap,
// which let a blank piece (0 modifiers) sprout up to a full set of modifiers for a
// single flat fee — cheaper and stronger than augmenting each slot. Preserving the
// current count keeps a blank piece blank and a 2-mod piece a 2-mod piece.

// Reforge count per pool: the piece's current non-locked stat/attr count, clamped
// to the rarity cap as a safety net (a normally-generated piece is always within
// cap; the clamp only guards an anomalous over-cap piece). Pass the item's current
// counts ({ statN, attrN } from itemAffixCounts) and its tier caps ({ stat, attr }).
export function rerollAllCounts(current = {}, caps = {}) {
  const clamp = (n, cap) => Math.min(Math.max(0, n | 0), Math.max(0, cap | 0));
  return {
    stat: clamp(current.statN, caps.stat),
    attr: clamp(current.attrN, caps.attr),
  };
}

// "Reroll all" only does anything when the piece has at least one bonus modifier to
// reforge — a blank piece has nothing to gamble, so the button stays disabled and
// the handler no-ops rather than silently charging for nothing.
export function canRerollAll(current = {}) {
  return (Math.max(0, current.statN | 0) + Math.max(0, current.attrN | 0)) > 0;
}
