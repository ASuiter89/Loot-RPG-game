// Down-stair signal — what an UNSEALED down-stair says about the floor waiting
// below it.
//
// A cleared floor rings its exit so the way deeper is unmistakable next to the
// (plain) up-stairs. Ordinarily that ring is gold, "descend here". But every 5th
// floor is held by a guardian and is a point of no return once entered — both
// staircases and the town portal seal behind you — so a stair that drops you onto
// one rings danger-red instead. The warning then reads from across the room,
// rather than only in the threshold prompt you meet after stepping on the tile.
//
// Pure: a depth in, a signal key out. The renderer (src/legacy/game.js) maps the
// key to concrete canvas colours from the PALETTE mirror.

// A guardian holds every Nth floor of the continuous depth (5, 10, 15, …) — in
// every difficulty tier and on into Endless.
export const BOSS_EVERY = 5;

// Does floor `dl` hold a guardian? Floors are 1-based; anything else is false.
export function isBossDepth(dl) {
  const f = Math.floor(Number(dl));
  return f > 0 && f % BOSS_EVERY === 0;
}

// The floor a down-stair on floor `dl` lands you on.
export function descentDepth(dl) {
  const f = Math.floor(Number(dl));
  return f > 0 ? f + 1 : 0;
}

// The marker signal for the down-stair on floor `dl`: 'boss' when the descent
// lands on a guardian floor, else 'normal'. A felled guardian respawns when you
// return, so this keys on the destination alone — not on whether that floor has
// been cleared before.
export function descentSignal(dl) {
  return isBossDepth(descentDepth(dl)) ? 'boss' : 'normal';
}
