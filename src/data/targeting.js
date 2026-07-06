// Shared collection-TARGETING tuning — pure values behind the "aim a farm at one
// missing artifact" mechanic that several endgame systems (Dread Covenants, the
// Mirrorforge, the Pantheon) reuse. Implemented ONCE here + in
// src/systems/collectionTargeting.js so all three share the same bad-luck
// protection rather than growing three copies (a review call-out on the design).
//
// The model: a run that COULD have dropped your chosen target but didn't ticks a
// pity counter; the more it ticks, the more likely the next eligible drop is
// redirected onto the target, until a hard guarantee. No RNG or state here — just
// the curve constants the pure helpers read.
export const TARGETING = {
  // Base chance an eligible drop is redirected onto the chosen target slot when
  // pity is 0. Small — targeting is a nudge, not a vending machine.
  baseBias: 0.12,
  // Extra redirect chance per point of pity, added on top of baseBias.
  biasPerPity: 0.06,
  // The redirect chance never exceeds this before the hard guarantee kicks in, so
  // even a long dry streak still feels like a roll rather than a countdown — until
  // guaranteeAt, where it snaps to certain.
  maxBias: 0.75,
  // Pity gained per eligible run/drop that did NOT yield the target.
  perRunPity: 1,
  // Pity at which the next eligible drop is GUARANTEED to be the target. Bounds the
  // worst-case grind (critical for trade-less SSF/Hardcore heroes).
  guaranteeAt: 10,
};
