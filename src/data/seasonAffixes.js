// Season enemy affixes — the twist a Cycle stamps on EVERY foe an enrolled hero
// meets. PURE DATA; the resolvers live in src/systems/seasonAffix.js and the shell
// applies them at the attack / armor / death call sites.
//
// A cycle names one of these by key in its headline rule's `enemyAffix` param
// (src/data/cycleModifiers.js). Unlike the per-monster AFFIXES in the shell — rolled
// on ~a fifth of foes, each with its own aura — a season affix is GLOBAL: it is on
// every spawn for the whole season, so it is tuned gently and reads as the weather
// of the run rather than a per-foe surprise.
//
// Same design law the covenants follow: more/harder/faster/tougher foes, never a
// lockout. Every knob is a multiplier the hero can out-gear or out-play, and the
// death burst is a hazard — it can hurt badly but, like lava and traps, never kills.
export const SEASON_AFFIXES = {
  // Swarming Season — the crowd is already bigger, so the per-foe bump is small.
  frenzied: {
    name: 'Frenzied', color: '#ff8a5a',
    atkSpeedMult: 1.25,          // foes swing this much faster
    blurb: 'Every foe swings 25% faster.',
  },
  // Volatile Season — corpses detonate, so a melee hero pays for standing in the pile.
  volatile: {
    name: 'Volatile', color: '#ffb04a',
    burstRadius: 1.6,            // tiles from the corpse the blast reaches
    burstDmgFrac: 0.9,           // share of the foe's own hit for full damage
    burstCapFrac: 0.12,          // hard ceiling: share of the hero's MAX HP per burst
    blurb: 'Every foe bursts when it dies — don\'t stand in the pile.',
  },
  // Ironblood Season — plate on everything; the bounty board pays the difference.
  armored: {
    name: 'Armored', color: '#9fb4c8',
    armorAdd: 0.08,              // added to the foe's physical armor fraction
    blurb: 'Every foe wears heavy plate — 8% more of each blow turned aside.',
  },
};
