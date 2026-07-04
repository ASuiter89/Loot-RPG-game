// Depth progression — which floor counts as your deepest, and when it advances.
//
// Reaching a new depth used to require physically descending the stairs. But
// clearing a floor of its foes UNSEALS the down-stairs — which opens the next
// floor at the town Gate — so that next floor is re-enterable the moment you
// clear it, whether or not you actually step down before porting back to town.
// These pure helpers decide which floor a clear unlocks and fold new progress
// into the deepest-reached / re-enterable trackers. The legacy monolith owns the
// mutable `player` and the side effects (banners, saves); it calls these.

// The floor that clearing floor `dl` opens passage to. Clearing unseals the
// down-stairs to floor dl+1 — UNLESS `dl` is the last finite floor of a tier,
// which has NO stairs down (conquering it unlocks the next difficulty instead,
// handled separately). Returns null when a clear opens no ordinary stairs, so the
// caller skips the deepest-floor bump on those floors.
export function floorUnlockedByClear(dl, isLastFinite) {
  if (isLastFinite) return null;
  return Math.max(1, Math.floor(dl) || 1) + 1;
}

// Fold a newly-reached floor into the deepest-reached (`maxFloor`) and currently
// re-enterable (`gateFloor`) trackers. Both only ever climb here. `dl` may be a
// floor you have physically reached (arrival) OR the next floor a clear just
// unlocked. Returns the updated pair plus whether `maxFloor` set a fresh all-time
// record (a NEW record on physical arrival is what pays a depth milestone).
export function foldReached(maxFloor, gateFloor, dl) {
  const floor = Math.max(1, Math.floor(dl) || 1);
  const prevMax = Math.max(1, Math.floor(maxFloor) || 1);
  const prevGate = Math.max(1, Math.floor(gateFloor) || 1);
  return {
    maxFloor: Math.max(prevMax, floor),
    gateFloor: Math.max(prevGate, floor),
    advanced: floor > prevMax,
  };
}
