// Tuning for Bounty Board reward payouts. Pure data — the amount each reward TYPE
// pays is DERIVED from these by systems/bounty.js. Kept here (not inline in logic)
// so every payout is tuned in one place.
//
// A bounty no longer always pays the same gold + Core + gear trio; it hands out a
// MIX of 1–3 rewards drawn from these types (gold, any of the four crafting
// materials, a lump of XP, or a piece of gear). The composition per contract lives
// with the contract templates (legacy bountyPool); this file only sets HOW MUCH a
// given reward type is worth at a given depth + effort.

// Materials: a bounty can pay any of the four crafting mats, not just Core. Each
// scales like Core always has — a depth-scaled baseline times the contract's effort
// weight — but the scarcer the material, the smaller the count. `base` is the
// depth-1 payout for a light (weight-1) contract and the floor the payout never
// drops below; `perDepth` adds to it per floor of depth. (Core keeps its historical
// 2 / 0.15 numbers so existing Core payouts are unchanged.)
export const BOUNTY_MAT_TUNING = {
  scrap:   { base: 6, perDepth: 0.5 },   // common — pays in bulk
  glimmer: { base: 3, perDepth: 0.25 },  // uncommon
  core:    { base: 2, perDepth: 0.15 },  // rare — matches the historical Core payout
  chaos:   { base: 1, perDepth: 0.06 },  // very rare — a trickle even deep
};

// XP lump a bounty can pay: a depth-scaled baseline times the contract's weight.
// Sized as a supporting reward (a nudge toward the next level), not a whole one.
export const BOUNTY_XP_BASE = 40;      // depth-1, weight-1 payout / floor
export const BOUNTY_XP_PER_DEPTH = 22; // extra XP per floor of depth
