// Gear-comparison math — the honest Power swing from equipping a candidate piece,
// the number the bag/shop "upgrade" arrows compare against. Pure: powers in, delta
// out; no globals, no DOM, no state. The legacy adapter (src/legacy/game.js) reads
// the live loadout into these plain numbers and asks this module for the swing.
//
// Two structural facts about the hand slots make a naive `item − occupant` wrong,
// and both are folded in here:
//   • A two-handed weapon STRANDS an incompatible off-hand (equipping it stows the
//     off-hand), so that off-hand's Power is lost in the swap too — a 2H is a real
//     upgrade only when it beats the main-hand weapon AND that off-hand combined.
//   • An off-hand can't be equipped at all while a two-hander fills the hand (no
//     Titan's Grip) — there's no slot to put it in, so it's never an "upgrade".

// The Power swing from equipping a candidate piece into its slot:
//   itemPower            Power the candidate is worth to this hero.
//   occupantPower        Power of the piece currently in that slot (0 if empty/ignored).
//   strandedOffhandPower Power of an off-hand this swap would strand (a 2H forcing an
//                        incompatible off-hand off); 0 when nothing is stranded.
//   blocked              The piece can't be equipped right now (an off-hand while a
//                        two-hander fills the hand) — no swing possible, so 0.
// Positive = a genuine upgrade for this build. Never clamped: a downgrade reads
// negative so callers can arrow it before clamping the displayed pill.
export function equipSwapDelta({
  itemPower = 0,
  occupantPower = 0,
  strandedOffhandPower = 0,
  blocked = false,
} = {}) {
  if (blocked) return 0;
  return itemPower - occupantPower - strandedOffhandPower;
}
