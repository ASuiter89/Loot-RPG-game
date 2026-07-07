// Trap-themed floors — how dense a "one trap type owns the whole floor" modifier
// packs its hazard. A FLOOR_MODS entry (in src/legacy/game.js) can carry a
// `trapTheme` of 'spikes' | 'arrows' | 'fire'; the map/trap placement then seeds
// FAR more of that one kind than the usual light scatter, and none of the others,
// so the floor reads as a spike gauntlet / arrow gallery / vent works.
//
// Pure data — the placement logic in the monolith reads these; keeping the tuning
// here (not inline) follows the data-driven-design rule.
//
//   spikes.mult    — multiply the usual per-floor spike count by this…
//   spikes.cap     — …then clamp, so huge Endless floors don't drown in spikes.
//   arrows.min/max — arrow emitters seeded on an arrow-themed floor.
//   fire.min/max   — fire vents seeded on a fire-themed floor.
export const TRAP_THEME = {
  spikes: { mult: 6, cap: 160 },
  arrows: { min: 8, max: 14 },
  fire:   { min: 6, max: 10 },
};

// The trap kinds a floor modifier may theme around — the allowed values of a
// FLOOR_MODS entry's `trapTheme`. Lets a test keep the two tables in lockstep.
export const TRAP_THEME_KINDS = Object.keys(TRAP_THEME);
