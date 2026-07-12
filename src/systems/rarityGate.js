// Early-game rarity gating — loot colour arrives in waves as you beat the first
// bosses, instead of the opening floors dropping greens and blues immediately.
//
// The dungeon used to hand out colour from floor 1, so the loot ladder had no
// early sense of progression. Now colour is withheld until you've earned it:
// GREENS (uncommon) unlock the instant you defeat the first guardian on floor 5,
// and BLUES (rare) — plus every rarer tier, which can never sensibly precede a
// blue — follow one boss later, on floor 10. Below the first boss the dungeon
// drops only greys and whites, so a green becomes a real milestone.
//
// Pure: takes the progression signals it needs (the boss first-kill ledger and
// the deepest floor reached) and returns which rarity tiers are still locked. The
// legacy monolith owns the mutable `player` and calls lockedTiers() from rollTier.

// Which boss floor unlocks each colour. Guardians sit on every 5th floor; floor 5
// is the first, floor 10 the second.
export const GREEN_BOSS_FLOOR = 5;
export const BLUE_BOSS_FLOOR = 10;

// Has the guardian on `floor` been defeated? The boss first-kill ledger records it
// the instant the boss dies — so the boss's OWN windfall already counts as its
// reward — keyed by the floor number as a string. A deepest-reached PAST that
// floor also implies it (you cannot pass a boss floor without clearing it), which
// covers saves that predate the ledger.
export function bossDefeated(floor, bossFirstKills, maxFloor) {
  if (bossFirstKills && bossFirstKills[String(floor)]) return true;
  return (Math.floor(maxFloor) || 1) > floor;
}

export function greensUnlocked(bossFirstKills, maxFloor) {
  return bossDefeated(GREEN_BOSS_FLOOR, bossFirstKills, maxFloor);
}
export function bluesUnlocked(bossFirstKills, maxFloor) {
  return bossDefeated(BLUE_BOSS_FLOOR, bossFirstKills, maxFloor);
}

// The rarity-tier keys rollTier must SKIP for this progression. Greens need the
// floor-5 guardian; blues and every rarer tier need the floor-10 one (a purple/
// orange/red can never drop before a blue is even possible). Returns a Set so the
// caller can `continue` past a locked tier in its descending rarity walk.
export function lockedTiers(bossFirstKills, maxFloor) {
  const locked = new Set();
  if (!greensUnlocked(bossFirstKills, maxFloor)) locked.add('uncommon');
  if (!bluesUnlocked(bossFirstKills, maxFloor)) {
    locked.add('rare');
    locked.add('epic');
    locked.add('legendary');
    locked.add('unique');
  }
  return locked;
}
