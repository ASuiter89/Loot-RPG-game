// Per-boss arena layouts — the hand-authored cover/hazard patterns that give each
// guardian its OWN room instead of one identical circle. Fifteen guardians, fifteen
// arenas: caster lairs bristle with columns to break line-of-sight on their
// bullet-storms, brutes fight amid lava and rubble, and the deep gods reshape the
// floor with breakable walls and spike beds.
//
// Pure data. The legacy monolith carves the circular floor and stamps these; the
// expansion + the navigability safety net live in `src/systems/bossArena.js`, which
// ALWAYS keeps an open central plaza, a clear north-south entrance/exit lane, and an
// open perimeter ring so even a 3×3 guardian can lumber around the room (a systems
// test asserts every layout below stays navigable and the exit stays walkable).
//
// Each boss.type maps to `{ id, name, features:[…] }`. A feature spec:
//   shape  'quad'   one blob mirrored into all four corners: (±ax, ±ay)
//          'axisH'  one blob mirrored east & west only: (±ax, 0) — never north/south
//                   (that lane must stay clear for the entrance/exit and the boss)
//          'ring'   `count` blobs spaced evenly on a ring (phase nudges them off axis)
//   tile   the terrain the blob is made of — 1 pillar/wall · 7 lava (walkable, burns)
//          · 8 spikes (walkable, stab) · 10 cracked wall (shove through to break)
//   r      ring/anchor radius as a fraction of the arena radius R (~0.4–0.72)
//   rx,ry  per-axis fractional offset for 'quad'/'axisH' (each defaults to `r`)
//   count  'ring' only — how many blobs around the ring
//   phase  'ring' only — starting angle in degrees (keeps blobs off the N-S lane)
//   w,h    blob footprint in tiles (default 1×1), centred on the anchor
//   blob   explicit cell offsets [[dx,dy],…] from the anchor (overrides w,h)
//
// Tiles that would fall in the plaza, the N-S lane, or the perimeter ring are
// dropped by the expander, so a layout can never seal the hero in or box the boss.
export const BOSS_ARENAS = {
  // ── Tier 1 · Normal ──────────────────────────────────────────────────────
  // Rat King — a crumbling warren: four broken pillars, breakable rubble east/west.
  ratking: { id: 'warren', name: 'The Warren', features: [
    { shape: 'quad',  tile: 1,  rx: 0.5, ry: 0.5 },
    { shape: 'axisH', tile: 10, rx: 0.6, w: 1, h: 3 },
  ] },
  // Inferno Demon — a pyre: lava pools in the corners, pillars to duck the firebolts.
  inferno: { id: 'pyre', name: 'The Pyre', features: [
    { shape: 'quad',  tile: 7, rx: 0.52, ry: 0.52, w: 2, h: 2 },
    { shape: 'axisH', tile: 1, rx: 0.52 },
  ] },
  // Elder Dragon — a roost: four heavy broken columns to break the fire-breath cone.
  dragon: { id: 'roost', name: "Wyrm's Roost", features: [
    { shape: 'quad',  tile: 1,  rx: 0.5, ry: 0.5, w: 2, h: 2 },
    { shape: 'axisH', tile: 10, rx: 0.62, w: 1, h: 2 },
  ] },
  // Death Knight — a crypt: tombstone columns, grave-spikes on the flanks.
  deathknight: { id: 'crypt', name: 'The Crypt', features: [
    { shape: 'quad',  tile: 1, rx: 0.5, ry: 0.5, w: 1, h: 2 },
    { shape: 'axisH', tile: 8, rx: 0.62, w: 1, h: 2 },
  ] },
  // The All-Seer — a sanctum: a full colonnade to hide from its hexes and volleys.
  allseer: { id: 'sanctum', name: 'The Sanctum', features: [
    { shape: 'ring', tile: 1, r: 0.55, count: 8, phase: 22.5 },
  ] },

  // ── Tier 2 · Hardened ────────────────────────────────────────────────────
  // Cindra — an arcane gallery: a dense ring of columns to weave through her bullet-storms.
  cindra: { id: 'gallery', name: 'Arcane Gallery', features: [
    { shape: 'ring', tile: 1, r: 0.55, count: 8, phase: 22.5 },
    { shape: 'quad', tile: 1, rx: 0.42, ry: 0.42 },
  ] },
  // Emberbound — an ashen hall: spreading lava, pillars for cover on the flanks.
  emberbound: { id: 'ashhall', name: 'Ashen Hall', features: [
    { shape: 'quad',  tile: 7, rx: 0.5, ry: 0.5, w: 2, h: 2 },
    { shape: 'axisH', tile: 1, rx: 0.62, w: 1, h: 2 },
  ] },
  // The Masquerade — a hall of mirrors: breakable walls everywhere, reshape it as you smash.
  masquerade: { id: 'mirrors', name: 'Hall of Mirrors', features: [
    { shape: 'quad',  tile: 10, rx: 0.5, ry: 0.5, w: 2, h: 2 },
    { shape: 'axisH', tile: 10, rx: 0.62, w: 1, h: 3 },
  ] },
  // Magmaw — a molten cauldron: lava pools ring the floor; obsidian pillars for cover.
  magmaw: { id: 'cauldron', name: 'Molten Cauldron', features: [
    { shape: 'quad',  tile: 7, rx: 0.5, ry: 0.5, w: 2, h: 2 },
    { shape: 'axisH', tile: 7, rx: 0.62, w: 2, h: 2 },
    { shape: 'axisH', tile: 1, rx: 0.4, w: 1, h: 3 },
  ] },
  // Mortis Vane — a necropolis: crypt columns and bone-spike flanks.
  mortisvane: { id: 'necropolis', name: 'The Necropolis', features: [
    { shape: 'quad',  tile: 1, rx: 0.5, ry: 0.5, w: 1, h: 2 },
    { shape: 'axisH', tile: 8, rx: 0.62, w: 1, h: 3 },
  ] },

  // ── Tier 3 · Brutal ──────────────────────────────────────────────────────
  // Vael — a prism vault: a ring of crystal columns plus tall slabs east/west, to
  // dodge the rotating prism-beams behind cover from any angle.
  vael: { id: 'prism', name: 'Prism Vault', features: [
    { shape: 'ring',  tile: 1, r: 0.5, count: 8, phase: 22.5 },
    { shape: 'axisH', tile: 1, rx: 0.68, w: 1, h: 3 },
  ] },
  // The Tidewarden — a tidal basin: bared spike beds in the corners, rocks for cover.
  tidewarden: { id: 'basin', name: 'Tidal Basin', features: [
    { shape: 'quad',  tile: 8, rx: 0.5, ry: 0.5, w: 2, h: 2 },
    { shape: 'axisH', tile: 1, rx: 0.62, w: 1, h: 2 },
  ] },
  // The Shrike — a shadowed roost: heavy cover it strikes from, with breakable gaps.
  shrike: { id: 'shadowroost', name: 'Shadow Roost', features: [
    { shape: 'quad',  tile: 1,  rx: 0.5, ry: 0.5, w: 2, h: 2 },
    { shape: 'axisH', tile: 10, rx: 0.62, w: 1, h: 3 },
  ] },
  // Kaggoroth — a shattered bastion: crumbling breakable blocks amid molten cracks.
  kaggoroth: { id: 'bastion', name: 'Shattered Bastion', features: [
    { shape: 'quad',  tile: 10, rx: 0.5, ry: 0.5, w: 2, h: 2 },
    { shape: 'axisH', tile: 7,  rx: 0.62, w: 2, h: 2 },
  ] },
  // Ourok, the Dungeon Heart — every trick at once: corner lava, breakable flanks,
  // spike strips erupting beside the plaza.
  ourok: { id: 'heart', name: 'The Dungeon Heart', features: [
    { shape: 'quad',  tile: 7,  rx: 0.52, ry: 0.52, w: 2, h: 2 },
    { shape: 'axisH', tile: 10, rx: 0.6, w: 1, h: 3 },
    { shape: 'axisH', tile: 8,  rx: 0.4, w: 1, h: 3 },
  ] },
};

// Fallback for any guardian without a bespoke layout (endless rolls only the fifteen
// above, so this is a safety net): the classic four cover pillars.
export const DEFAULT_BOSS_ARENA = { id: 'pillars', name: 'Pillared Hall', features: [
  { shape: 'quad', tile: 1, rx: 0.5, ry: 0.5 },
] };
