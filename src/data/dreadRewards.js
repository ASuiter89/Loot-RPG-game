// Dread reward curves + completion marks (PURE DATA).
//
// The whole point of stacking Dread is that it pays: total Dread folds into reward
// MULTIPLIERS through the diminishing, soft-capped curves below. "Soft-capped" is the
// load-bearing word — early Dread is generously rewarded, but each curve bends toward
// an asymptote so a 30-Dread monster of a run is worth chasing yet can never become a
// runaway stat-stick that trivialises the economy.
//
// SOFT-CAP SHAPE (implemented in src/systems/covenants.js#softcap): given a raw
// linear bonus x = perDread · dread, the applied bonus is
//     softcap(x, cap) = cap · (1 − e^(−x / cap))
// which is 0 at x=0, strictly increasing in x, and asymptotic to `cap` from below —
// so the final multiplier 1 + softcap(...) rises smoothly from 1 and can approach but
// never reach 1 + cap. (An algebraic alternative with the same shape is
// cap·x/(x+cap); either satisfies "monotonic increasing, bounded by cap".)
//
// Read the numbers as: `perDread` is the *initial* slope (roughly the per-Dread bonus
// while Dread is small), `cap` is the hard ceiling the bonus asymptotes to.
export const DREAD_REWARDS = {
  // Loot QUANTITY — more items drop. The most generous curve: quantity is low-risk to
  // inflate (rarity still gates power), so a deep run can nearly triple drop counts.
  lootQty: { perDread: 0.05, cap: 1.50 },   // → up to ×2.5 loot quantity
  // RARITY weight — nudges the whole drop table toward higher tiers. Capped tighter
  // than quantity because rarity is where real power lives.
  rarity: { perDread: 0.04, cap: 1.00 },    // → up to ×2 rarity weight
  // BOSS POINTS — the gear-slot currency (see bossSlots). Deliberately the stingiest
  // curve; permanent progression should stay a slow, earned climb.
  bossPoint: { perDread: 0.03, cap: 0.75 }, // → up to ×1.75 boss points
  // Crafting MATERIALS — cheap, consumable, so the richest curve; Dread runs are the
  // fast way to stock the forge.
  material: { perDread: 0.06, cap: 2.00 },  // → up to ×3 materials
};

// MARK_MILESTONES — the per-account "completion marks". Each satisfied milestone is
// one earned mark; the mark COUNT is what unlocks higher covenants (a covenant's
// `unlockOrder` is the mark count it needs — see src/systems/covenants.js#isUnlocked)
// and gates the checklist's reward drops. marksEarned (src/systems/dreadChecklist.js)
// evaluates each against the per-class/per-boss clear grid.
//
// scope decides HOW the grid is judged (all pure over the grid alone):
//   'any'   — your single best boss-clear anywhere reached at least `dread`.
//   'count' — at least `need` distinct boss clears each reached at least `dread`.
//   'every' — you hold at least `need` boss clears AND *every* clear on record is at
//             least `dread` (a mastery mark: no boss left behind at low Dread).
// reward.type tags what earning the mark grants the shell:
//   'covenantUnlock' — flavor for "a new curse is available" (unlock is really driven
//                      by the mark COUNT vs unlockOrder; this just names the payoff),
//   'targetBias'     — a collection bad-luck-protection boost (the shell reuses
//                      src/systems/collectionTargeting.js to bank pity toward a target),
//   'title'          — a cosmetic account title.
// Listed by ascending difficulty; a data test checks `dread` is non-decreasing so the
// mark count a player holds maps cleanly onto how deep they've gone.
export const MARK_MILESTONES = [
  { id: 'mk_first_oath', name: 'First Oath', dread: 1, scope: 'any', need: 1,
    desc: 'Beat any boss while bound by at least 1 Dread.',
    reward: { type: 'covenantUnlock' } },

  { id: 'mk_deepening', name: 'The Deepening', dread: 3, scope: 'any', need: 1,
    desc: 'Beat any boss at 3+ Dread.',
    reward: { type: 'covenantUnlock' } },

  { id: 'mk_sworn_thrice', name: 'Sworn Thrice', dread: 2, scope: 'count', need: 3,
    desc: 'Beat three different bosses, each at 2+ Dread.',
    reward: { type: 'targetBias', id: 'dread_cache' } },

  { id: 'mk_harrowed', name: 'Harrowed', dread: 5, scope: 'any', need: 1,
    desc: 'Beat any boss at 5+ Dread.',
    reward: { type: 'covenantUnlock' } },

  { id: 'mk_broad_front', name: 'Broad Front', dread: 3, scope: 'count', need: 5,
    desc: 'Beat five different bosses, each at 3+ Dread.',
    reward: { type: 'covenantUnlock' } },

  { id: 'mk_dread_lord', name: 'Dread Lord', dread: 8, scope: 'any', need: 1,
    desc: 'Beat any boss at 8+ Dread.',
    reward: { type: 'targetBias', id: 'dread_cache' } },

  { id: 'mk_unbroken', name: 'Unbroken', dread: 3, scope: 'every', need: 3,
    desc: 'Hold at least three boss clears with none of your records below 3 Dread.',
    reward: { type: 'covenantUnlock' } },

  { id: 'mk_ascendant', name: 'Ascendant', dread: 12, scope: 'any', need: 1,
    desc: 'Beat any boss at 12+ Dread.',
    reward: { type: 'covenantUnlock' } },

  { id: 'mk_apotheosis', name: 'Apotheosis', dread: 6, scope: 'every', need: 4,
    desc: 'Hold at least four boss clears with none of your records below 6 Dread.',
    reward: { type: 'title', id: 'the_undaunted' } },
];
