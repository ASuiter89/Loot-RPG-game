// Combat-VFX palettes and archetype tables — pure data for the attack/spell/
// monster-attack animation system (drawn in src/legacy/game.js; classified by
// src/systems/vfx.js). Every skill, spell, weapon swing and monster ability reads
// its look from here so the visuals stay consistent and data-driven rather than
// hardcoded at each spawn site.
//
// These are ART colours (particle / spell / procedural), not UI design tokens, so
// per the styling rules they live as raw values here, not as CSS custom properties.
// Each palette gives a small, purpose-built set so an effect reads clearly over any
// ground (floor, water, lava): a bright CORE, a coloured GLOW (canvas shadow / halo),
// a mid TRAIL for streaks, a light SPARK for embers, and a dark EDGE keyline so the
// shape never washes out on a bright tile.

// element key -> { core, glow, trail, spark, edge }
export const VFX_PALETTES = {
  // Neutral steel for plain weapon swings and physical skills — a cold bright arc
  // with a dark keyline so a slash reads on any floor.
  physical:  { core: '#f4f8ff', glow: '#c3d4ec', trail: '#8fa2ba', spark: '#e6edf6', edge: '#2b303a' },
  fire:      { core: '#fff2c0', glow: '#ff7a2a', trail: '#ff5a1a', spark: '#ffb347', edge: '#5e1e06' },
  ice:       { core: '#eaffff', glow: '#9fdcff', trail: '#6fc6ff', spark: '#dff4ff', edge: '#215a86' },
  lightning: { core: '#fdffe4', glow: '#ffe24d', trail: '#bcd4ff', spark: '#fff6b0', edge: '#4a4410' },
  holy:      { core: '#fffdf0', glow: '#ffe9a0', trail: '#ffd27a', spark: '#fff6d2', edge: '#7a5c14' },
  venom:     { core: '#eeffbe', glow: '#7fe04a', trail: '#4aa423', spark: '#c2ff72', edge: '#204809' },
  blood:     { core: '#ffd6dd', glow: '#e0556b', trail: '#a52338', spark: '#ff8496', edge: '#3c0a13' },
  arcane:    { core: '#f6e9ff', glow: '#c77dff', trail: '#8a4fd6', spark: '#e3c6ff', edge: '#331a52' },
  // Extra roles the monster kit needs beyond the eight spell elements.
  force:     { core: '#eaf4ff', glow: '#88ddff', trail: '#5aa6d8', spark: '#cdeaff', edge: '#264a63' },   // shockwave / ward
  life:      { core: '#e6ffe9', glow: '#66ff99', trail: '#2fbf6a', spark: '#b6ffce', edge: '#0f4a2a' },   // heal / mend
  earth:     { core: '#f0dcb9', glow: '#c8a06a', trail: '#8a6034', spark: '#e6c99a', edge: '#3a2410' },   // quake / rubble
  // Fallback gold — matches the game's historic default bolt colour.
  gold:      { core: '#fff2c0', glow: '#ffd24b', trail: '#d9a520', spark: '#ffe9a0', edge: '#5c3f08' },
};

// The default element when nothing else matches. Weapon swings pass 'physical'
// explicitly; unclassified spells fall back to gold (the historic bolt colour).
export const DEFAULT_ELEMENT = 'gold';

// Cast SHAPE -> animation archetype. resolveCast() dispatches the chosen shape to
// one of these; the archetype decides which drawer plays (a projectile flies, a
// nova rings out, a beam sweeps a lane, etc.). Kept separate from the element so
// any element can play through any shape (a fire bolt, an ice bolt, a spark bolt…).
export const SHAPE_ARCHETYPE = {
  self:     'aura',        // a buff swirl blooms on the hero
  melee:    'slash',       // an arc + impact on the struck foe
  cleave:   'arcWide',     // a wide sweep across the foes in front
  nova:     'nova',        // an expanding ring + radial shards around the hero
  bolt:     'projectile',  // one projectile flies hero -> foe
  blast:    'blast',       // a projectile that bursts in a radius on arrival
  line:     'beam',        // a lance/beam sweeps down a lane
  chain:    'chain',       // arcs leap between each struck foe
  teleport: 'blinkStrike', // a vanish puff at the origin + a strike on the foe
  summon:   'conjure',     // a summoning ring + rising motes
  random:   'multiStrike', // a strike lands on each scattered target
};

// Weapon attack STYLE -> the swing animation a basic (auto) attack plays. Ranged
// styles fly a real projectile (previously the bow/staff loosed NOTHING visible);
// melee styles draw a shaped arc / impact tuned to the weapon's feel.
export const WEAPON_ARCHETYPE = {
  slash:  'slashArc',    // sword — a clean diagonal arc
  cleave: 'arcWide',     // axe — a broad sweep hitting the whole front
  flurry: 'slashDouble', // dagger — two quick crossing cuts
  crush:  'smash',       // mace — an overhead slam + shock ring
  thrust: 'thrust',      // spear — a piercing forward streak
  reap:   'scytheArc',   // scythe — a long crescent sweep
  shot:   'arrow',       // bow — a fletched arrow
  bolt:   'magicBolt',   // staff — a glowing magic bolt
  fist:   'jab',         // unarmed — a small knuckle impact
};

// Boss / elite ability -> { type, el }. Each named boss trick (see tryBossAbility)
// gets a purpose-built animation and an element palette, replacing the generic
// particle puff every special used to share. `type` selects the drawer; `el` its
// colour. Ranged tricks additionally loose a real projectile (see the wiring).
export const BOSS_ABILITY_FX = {
  firewall:    { type: 'flameLine',   el: 'fire' },
  firestorm:   { type: 'emberRain',   el: 'fire' },
  quake:       { type: 'groundCracks',el: 'earth' },
  shockwave:   { type: 'shockRing',   el: 'force' },
  frost:       { type: 'frostBurst',  el: 'ice' },
  drain:       { type: 'siphonBeam',  el: 'blood' },
  curseblast:  { type: 'hexBolt',     el: 'arcane' },
  venom:       { type: 'venomSpit',   el: 'venom' },
  vortex:      { type: 'pullSwirl',   el: 'arcane' },
  chain:       { type: 'hookLine',    el: 'physical' },
  walls:       { type: 'conjure',     el: 'arcane' },
  whirlwind:   { type: 'spinArc',     el: 'physical' },
  charge:      { type: 'dashTrail',   el: 'gold' },
  berserk:     { type: 'auraFlare',   el: 'blood' },
  enrage:      { type: 'auraFlare',   el: 'blood' },
  shield:      { type: 'ward',        el: 'force' },
  heal:        { type: 'mendMotes',   el: 'life' },
  summon:      { type: 'conjure',     el: 'arcane' },
  summonelite: { type: 'conjure',     el: 'arcane' },
  blink:       { type: 'blinkPuff',   el: 'arcane' },
  volley:      { type: 'volley',      el: 'gold' },
};

// Archetypes drawn as a bolt that TRAVELS from the attacker to its target — so
// their damage lands when the bolt ARRIVES (projectileArrive), not when the attack
// is cast. Deferring the hit stops a struck foe from dying (and the bolt then
// flying to an empty tile) before the projectile visibly connects. Every other
// archetype (slash, nova, beam, aura, chain…) resolves on the spot at cast time.
export const PROJECTILE_ARCHETYPES = ['projectile', 'blast', 'arrow', 'magicBolt'];

// Projectile KIND -> the element palette its renderer tints with. The projectile
// simulation is unchanged (still dodgeable); only the look is picked from here.
export const PROJECTILE_ELEMENT = {
  arrow:   'physical',
  magic:   'arcane',
  fire:    'fire',
  ice:     'ice',
  spark:   'lightning',
  venom:   'venom',
  holy:    'holy',
  blood:   'blood',
  hex:     'arcane',
  bone:    'physical',
};
