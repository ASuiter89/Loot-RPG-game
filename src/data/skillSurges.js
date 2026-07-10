// ── ACTIVE-SKILL SURGES ──────────────────────────────────────────────────────
// The rank 3 / 7 / 10 milestones (Empowered / Honed / Mastered) used to grant the
// SAME signature to every active — a flat "faster recharge" at 7 and a blanket
// "+1 to radius/range/chain/target/hit" at 10. Every spell read identically, so
// pouring points into a fire nova felt the same as into a summon or a self-buff.
//
// Now each active earns a SIGNATURE that fits how it plays. A cast is sorted into an
// ARCHETYPE by its shape + traits (systems/skillSurge.js → activeArchetype), and the
// archetype names, per milestone, ONE distinct mechanical perk — a real change the
// engine already understands (an extra chain link, a longer summon, a lingering
// affliction, a fatter blast, a faster recharge…). A handful of marquee spells get a
// bespoke override (SURGE_OVERRIDES) so the ultimates feel hand-made.
//
// The flat POWER spike at each milestone is UNCHANGED and universal (milestonePower
// in systems/skillMath.js) — that stays the shared damage backbone. These perks are
// the flavour on top, so the whole set rebalances gently: every archetype keeps a
// recharge/reach payoff, it's just distributed to match the ability instead of
// firehosing every lever at once.
//
// Perk shape:  { desc, mods }
//   desc  — player-facing line for the "Rank bonuses" ladder. A `{status}` token is
//           swapped for the cast's ailment name (burn / poison / …) at render time.
//           Every line states a concrete number (a data test enforces it).
//   mods  — cast deltas applied by applySurgeCastMods(), all reusing existing
//           resolveCast levers so no new combat hooks are needed:
//             radius/range/chain/count/repeat  +N reach (integers)
//             summonCount/ttl                  +N minions / +N seconds of lifespan
//             statusDur/statusChance           +N ailment turns / +frac to inflict
//             buffDur/buffMag                  +N seconds / ×(1+frac) stronger buff
//             healMul                          ×(1+frac) stronger heal
//             execute                          raise the execute threshold to this frac
//             lifesteal/detonate               +frac leech / +frac detonation coef
//             pull / crit                      drag foes in / always crit
//             haste                            +frac recharge speed (the old Honed lever)

// The three milestone ranks, in order — mirrors SKILL_MILESTONES / SURGE_RANKS.
export const SURGE_MILESTONE_RANKS = [3, 7, 10];

// One entry per archetype; each names a perk at rank 3, 7 and 10 (keyed by rank so a
// milestone with no perk can simply omit the key — none do today).
export const ACTIVE_SURGE_ARCHETYPES = {
  // Summons — reward keeping a standing army: longer-lived, then MORE of them.
  conjure: {
    3:  { desc: 'summons linger +6s', mods: { ttl: 6 } },
    7:  { desc: 'recharges 15% faster · summons linger +4s', mods: { haste: 0.15, ttl: 4 } },
    10: { desc: 'raises +1 summon', mods: { summonCount: 1 } },
  },
  // Pure self-buffs — reward uptime: a stronger buff, then a longer one you refresh sooner.
  ward: {
    3:  { desc: 'its buff is 20% stronger', mods: { buffMag: 0.20 } },
    7:  { desc: 'its buff lasts +3s', mods: { buffDur: 3 } },
    10: { desc: 'its buff lasts +4s · recharges 20% faster', mods: { buffDur: 4, haste: 0.20 } },
  },
  // Utility blinks (teleport + buff, no damage) — reward mobility and uptime.
  blink: {
    3:  { desc: 'its buff is 15% stronger', mods: { buffMag: 0.15 } },
    7:  { desc: 'recharges 20% faster', mods: { haste: 0.20 } },
    10: { desc: 'blinks +1 tile · its buff lasts +4s', mods: { range: 1, buffDur: 4 } },
  },
  // Pure heals — reward the mend itself, then how often it comes back.
  mend: {
    3:  { desc: 'heals 20% more', mods: { healMul: 0.20 } },
    7:  { desc: 'recharges 15% faster', mods: { haste: 0.15 } },
    10: { desc: 'heals 30% more', mods: { healMul: 0.30 } },
  },
  // Chain lightning — reward the jump count: the arc reaches ever more foes.
  arc: {
    3:  { desc: 'arcs to +1 foe', mods: { chain: 1 } },
    7:  { desc: 'recharges 15% faster', mods: { haste: 0.15 } },
    10: { desc: 'arcs to +2 more foes', mods: { chain: 2 } },
  },
  // Piercing lines/beams — reward reach, then a double-strike down the whole line.
  lance: {
    3:  { desc: 'reaches +1 tile', mods: { range: 1 } },
    7:  { desc: 'reaches +2 tiles', mods: { range: 2 } },
    10: { desc: 'strikes 2× · reaches +1 tile', mods: { repeat: 1, range: 1 } },
  },
  // Ailment AoE (a nova/blast that also inflicts a status) — reward the affliction:
  // more reliable, longer-lasting, then wider.
  affliction: {
    3:  { desc: '+15% to inflict {status}', mods: { statusChance: 0.15 } },
    7:  { desc: '{status} lasts +2 turns', mods: { statusDur: 2 } },
    10: { desc: '+1 radius · {status} lasts +2 turns', mods: { radius: 1, statusDur: 2 } },
  },
  // Plain radius bursts (a nova with no ailment) — reward area, then a vortex pull.
  burst: {
    3:  { desc: '+1 radius', mods: { radius: 1 } },
    7:  { desc: 'recharges 15% faster', mods: { haste: 0.15 } },
    10: { desc: '+1 radius · drags foes into the blast', mods: { radius: 1, pull: true } },
  },
  // Lobbed blasts (a projectile that bursts on impact) — reward reach + area, then a re-detonation.
  siege: {
    3:  { desc: '+1 blast radius', mods: { radius: 1 } },
    7:  { desc: '+1 range · +1 radius', mods: { range: 1, radius: 1 } },
    10: { desc: '+1 radius · detonates 2×', mods: { radius: 1, repeat: 1 } },
  },
  // Floor-wide random strikes — reward the target count.
  storm: {
    3:  { desc: 'strikes +1 foe', mods: { count: 1 } },
    7:  { desc: 'recharges 15% faster', mods: { haste: 0.15 } },
    10: { desc: 'strikes +2 more foes', mods: { count: 2 } },
  },
  // Assassinations (a teleport/strike built on execute or a guaranteed crit) — reward
  // reach + tempo, then a lethal execute.
  assassinate: {
    3:  { desc: 'strikes from +1 tile', mods: { range: 1 } },
    7:  { desc: 'recharges 20% faster', mods: { haste: 0.20 } },
    10: { desc: 'executes foes under 35% health · +1 range', mods: { execute: 0.35, range: 1 } },
  },
  // Cleaves (all adjacent foes) — reward tempo, then extra swings that leech.
  cleave: {
    3:  { desc: 'recharges 15% faster', mods: { haste: 0.15 } },
    7:  { desc: 'strikes 2×', mods: { repeat: 1 } },
    10: { desc: 'strikes again · leeches 10% of the damage', mods: { repeat: 1, lifesteal: 0.10 } },
  },
  // Flurries (a multi-hit single-target barrage) — reward the strike count.
  flurry: {
    3:  { desc: '+1 strike', mods: { repeat: 1 } },
    7:  { desc: 'recharges 15% faster', mods: { haste: 0.15 } },
    10: { desc: '+2 more strikes', mods: { repeat: 2 } },
  },
  // Single-target bolts — reward reach + tempo, then a double-strike.
  bolt: {
    3:  { desc: 'flies +1 tile', mods: { range: 1 } },
    7:  { desc: 'recharges 15% faster', mods: { haste: 0.15 } },
    10: { desc: 'strikes 2× · flies +1 tile', mods: { repeat: 1, range: 1 } },
  },
  // Fallback for a plain weapon strike — tempo, a second hit, then both.
  strike: {
    3:  { desc: 'recharges 12% faster', mods: { haste: 0.12 } },
    7:  { desc: 'strikes 2×', mods: { repeat: 1 } },
    10: { desc: 'strikes again · recharges 15% faster', mods: { repeat: 1, haste: 0.15 } },
  },
};

// The default archetype when a cast can't be classified (should never happen for a
// real node, but keeps the resolver total).
export const DEFAULT_SURGE_ARCHETYPE = 'strike';

// Bespoke per-skill overrides for a few marquee ultimates, so the signature spells
// don't merely inherit their archetype. Keyed by node id; same { rank: perk } shape.
export const ACTIVE_SURGE_OVERRIDES = {
  // Warbringer — the Berserker capstone: an ever-wider, ever-bloodier rampage.
  b_warbringer: {
    3:  { desc: '+1 radius · leeches +10%', mods: { radius: 1, lifesteal: 0.10 } },
    7:  { desc: 'recharges 20% faster · poison lasts +2 turns', mods: { haste: 0.20, statusDur: 2 } },
    10: { desc: '+2 radius · executes foes under 40% health', mods: { radius: 2, execute: 0.40 } },
  },
  // Final Judgment — the Crusader capstone: a wider, harsher, longer stun.
  cr_judgment: {
    3:  { desc: '+1 radius', mods: { radius: 1 } },
    7:  { desc: 'stun lasts +1 turn · heals 25% more', mods: { statusDur: 1, healMul: 0.25 } },
    10: { desc: '+2 radius · executes foes under 40% health', mods: { radius: 2, execute: 0.40 } },
  },
  // Army of the Dead — the Necromancer capstone: a bigger, longer-lived horde.
  nc_army: {
    3:  { desc: 'skeletons linger +8s', mods: { ttl: 8 } },
    7:  { desc: 'recharges 20% faster · skeletons linger +6s', mods: { haste: 0.20, ttl: 6 } },
    10: { desc: 'raises +2 skeletons', mods: { summonCount: 2 } },
  },
  // Cinder Storm — the Pyromancer's setup blast: a bigger, further, longer mark.
  py_meteor: {
    3:  { desc: '+1 blast radius', mods: { radius: 1 } },
    7:  { desc: '+1 range · vulnerability lasts +2 turns', mods: { range: 1, statusDur: 2 } },
    10: { desc: '+2 radius · detonates 2×', mods: { radius: 2, repeat: 1 } },
  },
};
