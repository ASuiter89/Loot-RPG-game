// ── AUTO-ATTACK MODIFIERS ────────────────────────────────────────────────────
// The auto-attack is the one damage source every hero always has and the only one
// that costs nothing to fire — but on its own it had a single shape: one swing, one
// foe. A skill build stacks Skill Power, spends its cooldowns on nova/line/blast
// shapes and out-scales it against a pack, so "just auto-attack" fell off with depth.
//
// These modifiers give the auto-attack the missing axis: BREADTH. Instead of raising
// single-target numbers (which would inflate every build, since skill heroes swing
// too), each one lets the SAME swing reach more foes:
//
//   pierce     the blow carries on past the struck foe into whoever stands behind it
//   ricochet   it caroms foe-to-foe, each hop weaker than the last
//   multishot  a second (and third) shot goes out at other foes in reach
//   bounce     ricochets carom off WALLS too — reaching around cover, farther per hop
//
// Against a lone boss they do nothing at all, so they never move single-target
// balance; against a room they are the whole point. They come from two places: a
// signature power on a special weapon (`auto` on an ITEM_POWERS entry) and a ranked
// class passive (AUTO_MOD_NODES below).
//
// Pure data — the math lives in src/systems/autoAttackMods.js.

// Every modifier key, in display order. Also the iteration order for aggregation, so
// a seeded/derived readout is stable.
export const AUTO_MOD_KEYS = ['pierce', 'ricochet', 'multishot', 'bounce'];

// Presentation for each modifier: the name shown on a hero sheet / item card, and a
// one-line "what this does" for tooltips and the guide.
export const AUTO_MOD_INFO = {
  pierce:    { label: 'Pierce',    blurb: 'Your swing carries through the foe you hit into the ones lined up behind it.' },
  ricochet:  { label: 'Ricochet',  blurb: 'Your blow caroms from the struck foe to another nearby, weaker each hop.' },
  multishot: { label: 'Multishot', blurb: 'Every attack sends an extra strike at another foe in reach.' },
  bounce:    { label: 'Rebound',   blurb: 'Ricochets carom off walls — reaching foes behind cover, and farther each hop.' },
};

// Hard ceilings on how many EXTRA foes each modifier may reach, no matter how many
// powers and passives stack. Without these, a full stack would turn one swing into an
// unbounded chain; with them the ceiling is a known, tunable number of extra hits
// (3 + 3 + 2 = 8 at absolute maximum, and only in a packed room).
export const AUTO_MOD_CAPS = { pierce: 3, ricochet: 3, multishot: 2, bounce: 1 };

// Per-modifier geometry + damage falloff.
//   first    the fraction of the swing's damage the FIRST extra hit deals
//   falloff  multiplied in again for each hop after that (so hits taper, never grow)
//   reach    pierce only — tiles the blow travels PAST the foe it struck
//   halfWidth pierce only — how far off the shot's line a foe may stand and still be
//             skewered (a little over half a tile, so a body on the line counts and a
//             body one tile to the side does not)
//   hop      ricochet only — max Manhattan tiles between one foe and the next
export const AUTO_MOD_TUNING = {
  pierce:    { first: 0.80, falloff: 0.85, reach: 3, halfWidth: 0.75 },
  ricochet:  { first: 0.60, falloff: 0.80, hop: 3 },
  multishot: { first: 0.55, falloff: 0.85 },
};

// What a wall-bounce adds to a ricochet: extra Manhattan reach per hop (the shot is
// travelling a bent path off the stone, so it covers more ground), and — because a
// caromed shot no longer needs to SEE its next mark — hops ignore line of sight.
export const AUTO_MOD_BOUNCE = { hopBonus: 2 };

// ── PASSIVE GRANTS ───────────────────────────────────────────────────────────
// Class passives that teach the auto-attack a new shape once they are ranked up
// far enough. Keyed by skill-node id (mirrors data/passiveSurges.js), each entry is
// { at, grant } — the rank the node must reach, and what it then grants. A keystone
// caps at rank 1, so its threshold is 1.
//
// Chosen so every class reaches at least two, and always on a node whose existing
// theme already implies the shape: bow/line nodes teach pierce, arc/spark nodes
// teach ricochet, sweeping nodes teach multishot, and the two "bank the shot"
// marksman nodes teach the wall bounce.
const g = (at, grant) => ({ at, grant });

export const AUTO_MOD_NODES = {
  // ── Warrior — wide, heavy swings carry through and catch a second body ──
  w_p12: g(5, { pierce: 1 }),      // Cleaving Force — a wide cleave shears on through
  w_p42: g(7, { multishot: 1 }),   // Titanic Might — the swing is long enough for two

  // ── Rogue — the bow line: skewer a rank, then bounce the arrow on ──
  r_p14: g(5, { pierce: 1 }),      // Steady Aim — a steady arrow does not stop at one
  r_p34: g(5, { ricochet: 1 }),    // Deadeye — already ricochets Volley; now every shot
  r_p54: g(1, { pierce: 1 }),      // Death Dealer (keystone) — nothing stops the shot

  // ── Mage — the staff bolt arcs, overcharges and caroms off stone ──
  m_p22: g(5, { ricochet: 1 }),    // Arc Lightning — the arc looks for a second mark
  m_p32: g(7, { bounce: 1 }),      // Overcharge — an overcharged bolt rebounds off walls
  m_p42: g(7, { ricochet: 1 }),    // Tesla Field — the field keeps discharging outward

  // ── Templar — condemnation runs down a line; radiance splits ──
  t_p14: g(5, { pierce: 1 }),      // Condemnation — judgement passes through the guilty
  t_p34: g(7, { multishot: 1 }),   // Radiance — the light falls on a second sinner

  // ── Fortune-Seeker — the gunslinger: pierce, bank the shot, ricochet ──
  f_p12: g(5, { pierce: 1 }),      // Piercing Shot — it is in the name
  f_p22: g(7, { bounce: 1 }),      // Long Barrel — bank it off the wall
  f_p32: g(5, { ricochet: 1 }),    // Marksman's Poise — one shot, two marks
  f_p52: g(1, { multishot: 1 }),   // Dead Reckoning (keystone) — two barrels, always

  // ── Windblade — the squall throws a second blade; windshear cuts through ──
  z_p22: g(5, { multishot: 1 }),   // Squall — the gust carries a second edge
  z_p43: g(7, { pierce: 1 }),      // Windshear — shears clean through the rank

  // ── Bloodletter — butchery carries through and catches the next body ──
  l_p12: g(5, { pierce: 1 }),      // Cleaver — one cut, two carcasses
  l_p32: g(7, { multishot: 1 }),   // Carve — carving finds a second throat
};
