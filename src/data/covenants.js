// Dread Covenants — the affliction catalog (PURE DATA, no imports from logic).
//
// A "covenant" is an opt-in curse the player stacks at the altar BEFORE a descent.
// Each is worth some Dread points; the shell sums the Dread of the active set, folds
// it into difficulty (harder/denser/less-forgiving enemies) AND into reward curves
// (see src/data/dreadRewards.js), and records — per class, per boss — the highest
// Dread that boss was ever beaten at (the checklist, src/systems/dreadChecklist.js).
//
// DESIGN LAW (from the spec + CLAUDE.md's "mitigable pressure" rule): a covenant is
// only ever *more/harder/faster/hungrier* enemies or *weaker healing*. It is NEVER a
// hard on/off lockout ("immune to your damage", "no potions at all"). Every knob is a
// multiplier the player can out-gear, out-skill or out-run — pressure, not a wall.
//
// PARAMS — a covenant sets ONLY the knobs it actually moves; the systems layer
// (covenantMultipliers) defaults every absent knob to the neutral baseline in
// DREAD_TUNING.neutralParams, so a sparse def here is fully specified there.
//   enemyHpMult   >= 1   enemies soak more damage
//   enemyDmgMult  >= 1   enemies hit harder
//   densityMult   >= 1   more enemies per floor
//   healingMult   0..1   your healing is scaled DOWN (<=1; 1 = untouched)
//   dropQtyMult   >= 1   intrinsic loot-quantity sweetener for taking this curse
//   rarityMult    >= 1   intrinsic rarity sweetener
//   bossPointMult >= 1   intrinsic boss-point sweetener
//   eliteChanceAdd 0..1  ADDED to the champion/elite spawn chance
//   malaiseRate   >= 0   per-"step" session-clock ramp (see src/systems/malaise.js);
//                        0 for all but the "tempo" covenants that punish dawdling
//
// Ordering invariant (a data test enforces it): the array is listed so BOTH
// `unlockOrder` and `dread` are non-decreasing — cheap starter curses first, the
// build-warping ones last — so the altar can render it top-to-bottom as a ramp.
export const COVENANTS = [
  // ---- unlockOrder 0 : available from the very first altar visit (the tutorial trio) ----
  {
    id: 'cov_frenzy', unlockOrder: 0, name: 'Frenzy', dread: 1,
    sprite: 'cov_frenzy', category: 'offense',
    desc: 'Enemies attack with reckless fury, dealing more damage.',
    params: { enemyDmgMult: 1.15 },
  },
  {
    id: 'cov_carapace', unlockOrder: 0, name: 'Carapace', dread: 1,
    sprite: 'cov_carapace', category: 'defense',
    desc: 'Enemies grow thick hides and take more punishment before they fall.',
    params: { enemyHpMult: 1.20 },
  },
  {
    id: 'cov_horde', unlockOrder: 0, name: 'Horde', dread: 1,
    sprite: 'cov_horde', category: 'swarm',
    desc: 'More foes crowd every floor — and drop a little more when they die.',
    params: { densityMult: 1.25, dropQtyMult: 1.10 },
  },

  // ---- unlockOrder 1 : after the first completion mark ----
  {
    id: 'cov_bloodlust', unlockOrder: 1, name: 'Bloodlust', dread: 2,
    sprite: 'cov_bloodlust', category: 'offense',
    desc: 'Enemy blows land far harder.',
    params: { enemyDmgMult: 1.30 },
  },
  {
    id: 'cov_scarcity', unlockOrder: 1, name: 'Scarcity', dread: 2,
    sprite: 'cov_scarcity', category: 'defense',
    desc: 'Your healing is weakened; recovery comes slower.',
    params: { healingMult: 0.75 },
  },

  // ---- unlockOrder 2 ----
  {
    id: 'cov_swelling', unlockOrder: 2, name: 'Swelling', dread: 2,
    sprite: 'cov_swelling', category: 'defense',
    desc: 'Enemies are markedly tougher.',
    params: { enemyHpMult: 1.40 },
  },
  {
    id: 'cov_teeming', unlockOrder: 2, name: 'Teeming', dread: 3,
    sprite: 'cov_teeming', category: 'swarm',
    desc: 'Floors teem with foes, and the extra bodies mean extra loot.',
    params: { densityMult: 1.50, dropQtyMult: 1.20 },
  },

  // ---- unlockOrder 3 ----
  {
    id: 'cov_warband', unlockOrder: 3, name: 'Warband', dread: 3,
    sprite: 'cov_warband', category: 'elite',
    desc: 'Champions muster among the ranks far more often — but pay out better.',
    params: { eliteChanceAdd: 0.15, bossPointMult: 1.15, rarityMult: 1.10 },
  },
  {
    id: 'cov_haste', unlockOrder: 3, name: 'Haste', dread: 3,
    sprite: 'cov_haste', category: 'tempo',
    desc: 'A creeping malaise makes enemies stronger the longer you linger on a floor — descend quickly.',
    params: { malaiseRate: 0.020 },
  },

  // ---- unlockOrder 4 ----
  {
    id: 'cov_famine', unlockOrder: 4, name: 'Famine', dread: 4,
    sprite: 'cov_famine', category: 'defense',
    desc: 'Healing is cut roughly in half.',
    params: { healingMult: 0.50 },
  },

  // ---- unlockOrder 5 ----
  {
    id: 'cov_relentless', unlockOrder: 5, name: 'Relentless', dread: 4,
    sprite: 'cov_relentless', category: 'tempo',
    desc: 'A harsher malaise ramps enemy strength quickly the longer a floor drags on.',
    params: { malaiseRate: 0.035 },
  },
  {
    id: 'cov_juggernaut', unlockOrder: 5, name: 'Juggernaut', dread: 4,
    sprite: 'cov_juggernaut', category: 'defense',
    desc: 'Enemies are vastly more durable and hit noticeably harder.',
    params: { enemyHpMult: 1.60, enemyDmgMult: 1.20 },
  },

  // ---- unlockOrder 6 ----
  {
    id: 'cov_legion', unlockOrder: 6, name: 'Legion', dread: 5,
    sprite: 'cov_legion', category: 'swarm',
    desc: 'Overwhelming numbers pack every floor, salted with extra champions — a flood of loot for those who survive it.',
    params: { densityMult: 1.80, eliteChanceAdd: 0.10, dropQtyMult: 1.35, rarityMult: 1.10 },
  },

  // ---- unlockOrder 7 ----
  {
    id: 'cov_apex', unlockOrder: 7, name: 'Apex', dread: 5,
    sprite: 'cov_apex', category: 'elite',
    desc: 'Champions everywhere, each one deadlier — and the richest reward table short of the final oath.',
    params: { eliteChanceAdd: 0.35, enemyDmgMult: 1.20, bossPointMult: 1.30, rarityMult: 1.20 },
  },

  // ---- unlockOrder 8 : the capstone oath ----
  {
    id: 'cov_annihilation', unlockOrder: 8, name: 'Annihilation', dread: 6,
    sprite: 'cov_annihilation', category: 'offense',
    desc: 'Enemies are far tougher, hit far harder, and your healing withers — the deepest curse, and the greatest spoils.',
    params: { enemyHpMult: 1.50, enemyDmgMult: 1.50, healingMult: 0.60, rarityMult: 1.25, bossPointMult: 1.20 },
  },
];

// DREAD_TUNING — the neutral param baseline + shared knobs the systems layer reads so
// no magic numbers hide in logic. `neutralParams` is what an ABSENT covenant param
// defaults to during aggregation (a ×1 / +0 no-op), and is also the starting
// accumulator for covenantMultipliers. `maxEliteChance` clamps the summed elite
// chance so a stack of elite covenants can't drive it past a certainty.
export const DREAD_TUNING = {
  // The "everything neutral" baseline. Any knob a covenant doesn't set resolves to
  // these, so the game with an empty active set is byte-identical to no feature.
  neutralParams: {
    enemyHpMult: 1,
    enemyDmgMult: 1,
    densityMult: 1,
    healingMult: 1,   // 1 = healing untouched; covenants only ever push this DOWN
    dropQtyMult: 1,
    rarityMult: 1,
    bossPointMult: 1,
    eliteChanceAdd: 0,
    malaiseRate: 0,
  },
  // Summed eliteChanceAdd is clamped here — even an all-elite stack stays a roll,
  // never a guaranteed champion on every spawn.
  maxEliteChance: 0.90,
};
