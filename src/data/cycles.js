// Cycles registry — PURE DATA for the seasonal ladder ("Cycles & the Legacy Realm").
//
// A Cycle is an opt-in, FRESH-START seasonal character: you begin at level 1 with an
// empty stash, race a fixed milestone list (the "Journey") under one rotating
// "headline rule" (a CYCLE_MODIFIERS entry that changes HOW the loop plays), and
// compete on a leaderboard that is SNAPSHOT-AND-RESET at season end. When the season
// closes, the character forks into the permanent "Legacy Realm" (a normal, non-
// seasonal hero the player keeps forever) — so nothing is lost, only un-seasoned.
//
// This file is a leaf: pure values only, importing nothing. The SYSTEM layer
// (src/systems/cycles.js) parses the ISO strings below with Date.parse against an
// INJECTED nowMs (never Date.now()), so the whole thing stays deterministic and
// unit-testable — a test picks a fixed nowMs to land inside, before, or after any
// window.
//
// DATES: all windows use explicit-UTC ISO strings (…Z) so Date.parse is
// environment-independent (no local-timezone drift in CI). The registry deliberately
// spans past → live → future with a GAP between season 2 and season 3, so tests can
// pick a nowMs that lands in a gap (no cycle live, but one upcoming ⇒ 'pre').
//
//   s1  2025-01-01 → 2025-04-01   ENDED (fully past)
//   s2  2025-04-01 → 2025-07-01   ENDED (fully past)      ── then a ~11-month GAP ──
//   s3  2026-06-01 → 2026-09-01   LIVE for any nowMs in mid-2026 (e.g. 2026-07-06)
//   s4  2026-11-01 → 2027-02-01   PRE (entirely in the future)
//
// Each cycle carries:
//   headlineModifierId — the CYCLE_MODIFIERS id whose params the shell injects into
//                        spawn/loot/economy for the whole season.
//   journey            — ~15 ordered milestones. Each reuses a BOUNTY kind
//                        ('slay'|'delve'|'clear'|'boss'|'elite'|'gold'|'custom') so
//                        progress is derived the same delta-since-start way bounties
//                        are (src/systems/bounty.js). A fresh seasonal character
//                        starts every counter at 0, so "delta since start" is just the
//                        live total. `need` is the target; `reward` is granted when the
//                        step completes. A 'custom' step reads totals[step.field].
//   rewardTiers        — leaderboard-placement payouts, resolved at season end from the
//                        hero's FINAL rank (rank 1 = best). Ordered most-prestigious
//                        first; `rank` is the inclusive cutoff (rank ≤ this ⇒ earns it).

// A compact, reusable ~15-step journey template. Every cycle uses the SAME milestone
// spine (so the race is comparable across seasons) but each season swaps its flavor
// rewards below. Kept as a factory of plain objects — still pure data, just DRY.
function journey(prefix) {
  return [
    { id: prefix + '_j01', kind: 'delve', need: 5,     name: 'Descend to Floor 5',     reward: { type: 'gold', id: null } },
    { id: prefix + '_j02', kind: 'slay',  need: 100,   name: 'Slay 100 foes',           reward: { type: 'material', id: 'season_shard' } },
    { id: prefix + '_j03', kind: 'clear', need: 3,     name: 'Clear 3 floors',          reward: { type: 'gold', id: null } },
    { id: prefix + '_j04', kind: 'delve', need: 10,    name: 'Descend to Floor 10',     reward: { type: 'cache', id: 'season_cache' } },
    { id: prefix + '_j05', kind: 'boss',  need: 1,     name: 'Defeat a boss',           reward: { type: 'material', id: 'season_shard' } },
    { id: prefix + '_j06', kind: 'gold',  need: 5000,  name: 'Earn 5,000 gold',         reward: { type: 'gold', id: null } },
    { id: prefix + '_j07', kind: 'elite', need: 10,    name: 'Fell 10 elites',          reward: { type: 'targetBias', id: 'season_cache' } },
    { id: prefix + '_j08', kind: 'delve', need: 20,    name: 'Descend to Floor 20',     reward: { type: 'cache', id: 'season_cache' } },
    { id: prefix + '_j09', kind: 'slay',  need: 500,   name: 'Slay 500 foes',           reward: { type: 'material', id: 'season_shard' } },
    { id: prefix + '_j10', kind: 'boss',  need: 3,     name: 'Defeat 3 bosses',         reward: { type: 'cache', id: 'season_cache' } },
    { id: prefix + '_j11', kind: 'clear', need: 15,    name: 'Clear 15 floors',         reward: { type: 'gold', id: null } },
    { id: prefix + '_j12', kind: 'gold',  need: 50000, name: 'Earn 50,000 gold',        reward: { type: 'targetBias', id: 'season_cache' } },
    { id: prefix + '_j13', kind: 'elite', need: 40,    name: 'Fell 40 elites',          reward: { type: 'material', id: 'season_shard' } },
    { id: prefix + '_j14', kind: 'delve', need: 35,    name: 'Descend to Floor 35',     reward: { type: 'cosmetic', id: prefix + '_frame' } },
    // A 'custom' capstone: reads totals.journeyPoints, a season-specific counter the
    // shell increments for headline objectives (e.g. shrines cleansed). Proves the
    // journey supports goals outside the six bounty counters.
    { id: prefix + '_j15', kind: 'custom', field: 'journeyPoints', need: 100, name: 'Earn 100 Journey Points', reward: { type: 'title', id: prefix + '_champion' } },
  ];
}

export const CYCLES = [
  {
    id: 's1_emberfall',
    name: 'Cycle I — Emberfall',
    startISO: '2025-01-01T00:00:00Z',
    endISO: '2025-04-01T00:00:00Z',
    headlineModifierId: 'gilded',
    journey: journey('s1'),
    rewardTiers: [
      { rank: 1,    reward: { type: 'title',    id: 's1_champion' } },
      { rank: 10,   reward: { type: 'cosmetic', id: 's1_wreath' } },
      { rank: 100,  reward: { type: 'cache',    id: 's1_grand_cache' } },
      { rank: 1000, reward: { type: 'material', id: 'season_shard' } },
    ],
  },
  {
    id: 's2_frostwake',
    name: 'Cycle II — Frostwake',
    startISO: '2025-04-01T00:00:00Z',
    endISO: '2025-07-01T00:00:00Z',
    headlineModifierId: 'swarm',
    journey: journey('s2'),
    rewardTiers: [
      { rank: 1,    reward: { type: 'title',    id: 's2_champion' } },
      { rank: 10,   reward: { type: 'cosmetic', id: 's2_wreath' } },
      { rank: 100,  reward: { type: 'cache',    id: 's2_grand_cache' } },
      { rank: 1000, reward: { type: 'material', id: 'season_shard' } },
    ],
  },
  {
    id: 's3_stormcrown',
    name: 'Cycle III — Stormcrown',
    startISO: '2026-06-01T00:00:00Z',
    endISO: '2026-09-01T00:00:00Z',
    headlineModifierId: 'volatile',
    journey: journey('s3'),
    rewardTiers: [
      { rank: 1,    reward: { type: 'title',    id: 's3_champion' } },
      { rank: 10,   reward: { type: 'cosmetic', id: 's3_wreath' } },
      { rank: 100,  reward: { type: 'cache',    id: 's3_grand_cache' } },
      { rank: 1000, reward: { type: 'material', id: 'season_shard' } },
    ],
  },
  {
    id: 's4_dawnforge',
    name: 'Cycle IV — Dawnforge',
    startISO: '2026-11-01T00:00:00Z',
    endISO: '2027-02-01T00:00:00Z',
    headlineModifierId: 'tier_ascendant',
    journey: journey('s4'),
    rewardTiers: [
      { rank: 1,    reward: { type: 'title',    id: 's4_champion' } },
      { rank: 10,   reward: { type: 'cosmetic', id: 's4_wreath' } },
      { rank: 100,  reward: { type: 'cache',    id: 's4_grand_cache' } },
      { rank: 1000, reward: { type: 'material', id: 'season_shard' } },
    ],
  },
];
