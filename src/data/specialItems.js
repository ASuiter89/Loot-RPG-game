// ── SPECIAL ITEM KINDS ──
// Beyond its rarity COLOUR, a drop can roll one "special" kind: a rare break in the
// normal affix rules that hands you power the ordinary ladder makes you wait for.
// Each kind bends a DIFFERENT axis, so two specials never read as the same item:
//   • cursed     — a huge boost AND an equally huge felt drawback (see curseRoll.js)
//   • fortunate  — one finder stat (Gold/Magic Find) far past its normal ceiling
//   • deepforged — every value rolled as if found far deeper, with a gate to match
//   • storied    — a full affix spread PLUS one property beyond its rarity's cap
// A drop rolls AT MOST ONE (they come from a single weighted table), and only from
// uncommon up — junk/normal stay plain, and reds (uniques & set pieces) are
// hand-authored artifacts that never pass through the random-affix pipeline.

// Each kind's `weight` is its chance IN PERCENT that an eligible drop rolls it, so the
// column sums to the whole special rate (22% today). Cursed keeps the 12% it has always
// had; the three new kinds are rarer, so a special still feels like a find.
//   sprite    — the atlas tile that marks the name everywhere the item is listed
//   valueMult — gold worth multiplier (a special piece sells for more)
//   flavor    — replaces the tier's random flavour line on the item card
//   blurb     — the one-line "what this kind does" shown on the item card & wiki
export const SPECIAL_ITEM_KINDS = {
  cursed: {
    weight: 12, label: 'Cursed', sprite: 'ic_cursed', valueMult: 1.5,
    flavor: 'Cursed: great power at a price.',
    blurb: 'A huge boost paid for by an equally huge drawback — bound on drop, never reforgeable.',
  },
  fortunate: {
    weight: 4, label: 'Fortunate', sprite: 'ic_money', valueMult: 1.6,
    flavor: 'Fortune clings to it.',
    blurb: 'One finder stat rolled far past its normal ceiling.',
  },
  deepforged: {
    weight: 3, label: 'Deepforged', sprite: 'ic_down', valueMult: 1.5,
    flavor: 'Forged deeper than you have walked.',
    blurb: 'Every value rolled as if found far deeper — its equip gate rises to match.',
  },
  storied: {
    weight: 3, label: 'Storied', sprite: 'scroll', valueMult: 1.4,
    flavor: 'Every mark on it is a story.',
    blurb: 'A full affix spread plus one property past its rarity\'s cap.',
  },
};

// ── FORTUNATE ──
// The finder stats a fortunate roll can land on. Both are ECONOMY stats — they buy
// gold and loot rarity, never combat power — which is why this kind needs no drawback
// to stay fair: a fortunate piece is a farming tool, not a fight-winner.
export const FORTUNE_STATS = ['GOLDFIND', 'MAGICFIND'];
// How many times the stat's normal ceiling a fortunate roll adds ON TOP of a full
// normal roll, by rarity. Runs a little hotter than a curse's swing (see
// CURSE_TIER_MULT) precisely because nothing here wins a fight.
export const FORTUNE_TIER_MULT = { uncommon: 2.5, rare: 3.3, epic: 4.3, legendary: 5.5 };

// ── DEEPFORGED ──
// How much deeper the piece rolls than the floor that dropped it: a PERCENTAGE of its
// own item level (so the jump keeps mattering at depth, where a flat +5 would vanish)
// with a flat floor for the shallow floors, where 35% of a small number is nothing.
export const DEEPFORGE_ILVL = { pct: 0.35, min: 5 };

// ── STORIED ──
// Extra stat properties beyond the rarity's cap. One is plenty: it lifts every rarity
// a full step (an uncommon carries a rare's spread) and pushes a legendary past the
// 5-stat ceiling nothing else in the game can cross.
export const STORIED_EXTRA_STATS = 1;
