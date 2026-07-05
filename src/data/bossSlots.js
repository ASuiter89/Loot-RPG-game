// Boss-point gear-slot tuning — pure values, read by src/systems/bossSlots.js.
//
// Every boss floor you clear for the FIRST time grants one boss point (tracked by
// the bossFirstKills ledger; farming a cleared floor never grants another). A point
// is spent to raise a gear SLOT: each level permanently multiplies EVERYTHING the
// gear worn in that slot contributes — its stats, attributes and weapon damage —
// while that piece is equipped. The two gear sets invest INDEPENDENTLY from the same
// earned pool, so both loadouts can be fully optimised without competing for points.
export const BOSS_SLOTS = {
  // Per-level slot bonus, applied LINEARLY and UNCAPPED: a slot at level N scales
  // the gear worn there by ×(1 + perLevel·N). Level 0 ⇒ ×1 — byte-identical to the
  // game before the feature, so an un-invested hero plays exactly as before.
  perLevel: 0.05,
  // Redistributing is deliberately punishing: resetting EVERY slot level (both
  // sets) back to unspent costs respecBase + respecPerLevel · (levels invested)
  // gold — a fortune for a heavily-invested hero, so the two sets' allocations are
  // a real commitment, not a free per-fight toggle.
  respecBase: 10000,
  respecPerLevel: 3000,
};
