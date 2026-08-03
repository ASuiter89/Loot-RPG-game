// ── POINT POOLS — how a level's rewards are NAMED to the player ──────────────
//
// A level-up pays into three separate pools: HERO points (attributes, spent on the
// HERO tab), SKILL points (the passive/active trees) and — from level 20 —
// ASCENDANCY points (the path tree). Four places have to say the same thing about
// them: the level-up banner, the combat log, the shore's "spend your points" nudge,
// and the cave's refusal to open while any are unspent.
//
// Each used to phrase it by hand, in its own words and with its own idea of what
// the attribute pool is even called ("attribute points" / "stat points" / "Hero
// points"). That drift is how the shore ended up announcing a skill point on screen
// and never once naming the FIVE hero points that landed beside it — the log line
// that carried the numbers is hidden on touch, so the reward simply went unseen.
//
// Pure formatting over a few counts — no state, no DOM, no clock.

// The player-facing SINGULAR name of each pool, in the order they're always listed.
// "hero point" (not "attribute"/"stat" point) because HERO is the tab it's spent on
// — the name has to survive the trip from the message to the button.
export const POINT_POOLS = [
  ['attr', 'hero point'],
  ['skill', 'skill point'],
  ['asc', 'ascendancy point'],
];

// The tab each pool is spent on, for messages that point the way.
export const POINT_TABS = { attr: 'HERO', skill: 'SKILLS', asc: 'PATH' };

// `{ attr: 5, skill: 1 }` → `['5 hero points', '1 skill point']`. Pools that are
// zero, missing or not a positive number are left out entirely, so a message never
// reads "0 ascendancy points". Order is always hero → skill → ascendancy.
export function pointPoolList(pools) {
  const p = pools || {};
  const out = [];
  for (const [key, label] of POINT_POOLS) {
    const n = Math.floor(Number(p[key]) || 0);
    if (n > 0) out.push(`${n} ${label}${n === 1 ? '' : 's'}`);
  }
  return out;
}

// The same list as one phrase: `'5 hero points and 1 skill point'`. `joiner` sets
// the word before the last item ('and' by default; pass '·' for a terse HUD line,
// which then separates every item with it). Empty pools give ''.
export function pointPoolPhrase(pools, joiner) {
  const parts = pointPoolList(pools);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  const j = joiner || 'and';
  if (j !== 'and') return parts.join(` ${j} `);
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// Does this hero have anything left to spend? Used to decide whether a nudge is
// worth showing at all.
export function hasUnspentPoints(pools) {
  return pointPoolList(pools).length > 0;
}
