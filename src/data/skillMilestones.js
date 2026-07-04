// The fixed power spikes every rankable skill shares at ranks 3 / 7 / 10. Pouring
// points into one skill pays off in jumps, not a slow drip. Pure presentation data:
// the pip glyphs shown by the rank readout, the milestone's name, and a per-type
// line of EXACTLY what it grants (actives gain reach + a faster recharge a passive
// can't, so each carries both an active and a passive line). The numbers mirror
// src/systems/skillMath.js (milestonePower's +28/+20/+30% active spikes and
// passiveMilestonePower's +8/+10/+12% passive spikes) and resolveCast's rank-10
// reach step (+1 radius/range/target/hit) — keep them in sync. Keystones cap at
// rank 1, so they never reach one.
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
