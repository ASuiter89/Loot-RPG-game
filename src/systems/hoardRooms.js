// How many treasure-hoard rooms a floor gets — pure over an injected `rng`
// (production passes Math.random; tests pass a deterministic stub). Most floors get
// none; a rare lucky floor gets one, and rarer still that floor gets a second one.
// See the tuning in `src/data/hoardRooms.js`; the legacy monolith carves the rooms.
import { HOARD_ROOM } from '../data/hoardRooms.js';

// Returns 0, 1, or 2. The first roll gates whether a hoard room appears at all; only
// when it does can the second roll promote the floor to two distinct hoards.
export function rollHoardRoomCount(rng, tuning = HOARD_ROOM) {
  const { chance, secondChance } = tuning;
  if (rng() >= chance) return 0;            // the common case: no hoard room
  return rng() < secondChance ? 2 : 1;      // one hoard, sometimes two
}
