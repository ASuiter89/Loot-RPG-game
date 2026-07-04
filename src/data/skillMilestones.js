// The fixed power spikes every rankable skill shares at ranks 3 / 7 / 10. Pouring
// points into one skill pays off in jumps, not just a slow drip: each milestone
// grants a power surge PLUS a signature perk (kept generic so it applies to every
// data-driven skill). Pure presentation data — the pip glyphs shown by the rank
// readout, the milestone's name + perk, and a per-type blurb of what it grants.
// Actives gain reach and a shorter cooldown that a passive can't, so each entry
// carries BOTH an active and a passive description. The magnitudes themselves live
// in src/systems/skillMath.js (milestonePower / passiveMilestonePower); keystones
// cap at rank 1, so they never reach one.
export const SKILL_MILESTONES = [
  { rank: 3, pips: '✦', name: 'Empowered', perk: 'power surge',
    activeDesc: 'a big power surge — every hit lands harder',
    passiveDesc: 'its always-on bonus surges' },
  { rank: 7, pips: '✦✦', name: 'Honed', perk: 'shorter cooldown',
    activeDesc: 'more power, plus a shorter cooldown',
    passiveDesc: 'a bigger surge to its bonus' },
  { rank: 10, pips: '✦✦✦', name: 'Mastered', perk: 'wider reach',
    activeDesc: 'more power, plus wider reach — extra hits and targets',
    passiveDesc: 'the biggest surge to its bonus' },
];
