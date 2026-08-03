// Hero level required to reach each TIER of a skill tree. Index = tier (the node's
// `band`), value = the minimum hero level a node in that tier can be learned or
// ranked at. Pure tuning data — the trees themselves live in src/legacy/game.js and
// read this ladder through systems/skillTiers.js.

// Base class trees (the PASSIVE and ACTIVE webs). Both webs share one ladder, so a
// tier's spells and passives open together.
//
// Tier 1 sits at level 6. It was 4, which landed the second wave of spells a couple
// of fights into floor 1 — before the hero had settled into their roots — so the
// opening tier now carries the first few levels on its own.
export const SKILL_TIER_LEVELS = [1, 6, 9, 16, 24, 30];

// Ascendancy PATH trees. Cosmetic only: path nodes are gated purely by the earlier
// skills in their own tree, so nothing ever checks a path node's level.
export const ASC_TIER_LEVELS = [20, 25, 31];
