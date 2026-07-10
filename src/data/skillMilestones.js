// The fixed power spikes every rankable skill shares at ranks 3 / 7 / 10. Pouring
// points into one skill pays off in jumps, not a slow drip. Pure presentation data:
// the pip glyphs shown by the rank readout and the milestone's NAME (Empowered /
// Honed / Mastered) — the two universal bits every skill shares. The `activeDesc` /
// `passiveDesc` lines are now only a GENERIC FALLBACK: the live "Rank bonuses" ladder
// builds a per-skill line instead — an active shows its power spike + its archetype
// SIGNATURE (data/skillSurges.js), a passive names its OWN bonus (see game.js
// activeMilestoneDesc / passiveMilestoneDesc). The numbers still mirror
// src/systems/skillMath.js (milestonePower's +28/+20/+30% active spikes and
// passiveMilestonePower's +8/+10/+12% passive spikes). Keystones cap at rank 1, so
// they never reach one.
export const SKILL_MILESTONES = [
  { rank: 3, pips: '✦', name: 'Empowered',
    activeDesc: '+28% power',
    passiveDesc: '+8% to its bonus' },
  { rank: 7, pips: '✦✦', name: 'Honed',
    activeDesc: '+20% power · 20% faster recharge',
    passiveDesc: '+10% to its bonus' },
  { rank: 10, pips: '✦✦✦', name: 'Mastered',
    activeDesc: '+30% power · +1 radius/range, +1 target, +1 hit',
    passiveDesc: '+12% to its bonus' },
];
