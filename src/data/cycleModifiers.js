// Cycle headline-rule table — PURE DATA for the seasonal ladder.
//
// Every Cycle (src/data/cycles.js) pins ONE headline rule by id. The rule is what
// makes a season feel different from a vanilla run: it changes HOW the core loop
// plays by feeding a bag of `params` the shell injects into spawn, loot and the
// economy. Nothing here is behaviour on its own — it is just the knob values; the
// pure resolvers in src/systems/cycleModifiers.js turn a knob into an applied number,
// and the legacy shell reads those at the relevant call site.
//
// params (all OPTIONAL — a missing knob means "no change", the neutral default):
//   lootTierShift    integer — nudge the whole drop table N rarity tiers up (+) or
//                    down (−). +1 makes greens land where whites would. Injected into
//                    the loot roll (applyLootTierShift on the tier-weight array).
//   bountyPayoutMult number  — multiply bounty / journey gold payouts. 1 = unchanged.
//   enemyAffix       string  — a global affix stamped on every spawn this season
//                    (the shell maps the tag to its affix behaviour). null = none.
//   densityMult      number  — multiply monster spawn COUNT per floor. 1 = unchanged.
//   xpMult           number  — multiply XP gains. 1 = unchanged.
//
// Kept deliberately small and readable — a season is one strong, legible twist, not a
// soup of ten knobs. A data test pins the shape and that every cycle's
// headlineModifierId resolves to a row here.
export const CYCLE_MODIFIERS = [
  // The neutral baseline — an "Open" season with no twist. Present so a cycle can opt
  // OUT of a headline rule and still resolve to a valid (all-default) row.
  {
    id: 'open',
    name: 'Open Cycle',
    desc: 'No headline rule — the classic loop, fresh from level 1.',
    params: {},
  },
  // Gold rush: fat payouts and a little extra XP. Rewards efficient farming routes.
  {
    id: 'gilded',
    name: 'Gilded Season',
    desc: 'Bounty and Journey gold pays 50% more; a touch more experience.',
    params: { bountyPayoutMult: 1.5, xpMult: 1.1 },
  },
  // Swarm: far more monsters, each a hair frenzied. A crowd-control season.
  {
    id: 'swarm',
    name: 'Swarming Season',
    desc: 'Floors teem with 40% more foes, all faster and hungrier.',
    params: { densityMult: 1.4, enemyAffix: 'frenzied' },
  },
  // Volatile: dangerous foes, richer loot, and a big XP kicker for the risk.
  {
    id: 'volatile',
    name: 'Volatile Season',
    desc: 'Enemies burst on death; loot skews one tier richer and XP flows 25% faster.',
    params: { enemyAffix: 'volatile', lootTierShift: 1, xpMult: 1.25 },
  },
  // Tier-ascendant: the loot-quality season. Drops land a full rarity tier higher.
  {
    id: 'tier_ascendant',
    name: 'Ascendant Season',
    desc: 'Every drop rolls one rarity tier higher than it otherwise would.',
    params: { lootTierShift: 1 },
  },
  // Ironblood: armored, resilient foes, offset by a bounty payout bump.
  {
    id: 'ironblood',
    name: 'Ironblood Season',
    desc: 'Foes wear heavy armor; bounties pay 30% more to compensate.',
    params: { enemyAffix: 'armored', bountyPayoutMult: 1.3 },
  },
];
