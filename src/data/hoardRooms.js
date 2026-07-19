// Treasure-hoard-room tuning — the rare open room packed with chests (and guarded
// by elite sentinels) that a floor build may drop. Pure data; the legacy monolith
// owns the carve/spawn and the per-floor roll lives in `src/systems/hoardRooms.js`.
//
//   chance        per-floor chance a hoard room appears at all (kept very rare — it
//                 is a jackpot find, not a routine sight).
//   secondChance  once a floor gets one, the chance it gets a SECOND distinct hoard
//                 room — so "some levels" can hold up to two, without making the
//                 base find any more common.
export const HOARD_ROOM = {
  chance: 0.0006,
  secondChance: 0.2,
};
