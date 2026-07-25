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

// The full rarity ladder, common → rare, mirroring the shell's TIERS order. A tier's
// RANK is its index here: junk 0 · white 1 · green 2 · blue 3 · purple 4 · orange 5 ·
// red 6. Used to cap MERCHANT wares at the highest colour the hero has actually found.
export const RARITY_LADDER = ['junk', 'normal', 'uncommon', 'rare', 'epic', 'legendary', 'unique'];

// Tiers a MERCHANT must not stock because the hero hasn't FOUND that colour yet — a
// "found-rarity" cap layered on top of the boss gate. `foundRank` is the rank (index
// in RARITY_LADDER) of the highest rarity the hero has ever picked up; any tier ranked
// strictly above it is withheld, so a hero who has never found a blue is never sold a
// blue, one who has never found a purple never sold a purple, and so on. A non-finite
// rank means "no cap" (returns an empty Set), so a caller that doesn't track finds keeps
// its old behaviour. Junk/white (ranks 0–1) sit at or below any real cap, so they're
// never withheld here — the merchant always has a baseline to sell.
export function tiersAboveFound(foundRank) {
  const locked = new Set();
  if (!Number.isFinite(foundRank)) return locked;
  for (let i = 0; i < RARITY_LADDER.length; i++) {
    if (i > foundRank) locked.add(RARITY_LADDER[i]);
  }
  return locked;
}
