// Combat-VFX classification and easing — the pure brain behind the attack/spell/
// monster-attack animation system. No canvas, no game globals, no RNG: it decides
// WHICH element and WHICH archetype an effect should be and hands back easing
// curves, so the shapes stay deterministic and unit-testable while the drawing
// itself lives at the edge (src/legacy/game.js). Mirrors the historic castVisual /
// spellElement colour logic so a firebolt stays orange, a frost shard icy, etc.

import {
  VFX_PALETTES, DEFAULT_ELEMENT, SHAPE_ARCHETYPE, WEAPON_ARCHETYPE,
  BOSS_ABILITY_FX, PROJECTILE_ELEMENT,
} from '../data/vfxPalette.js';

// Keyword patterns per element, checked in priority order against a skill's
// icon + name. Same vocabulary the old castVisual() used, lifted into one table so
// both the bolt colour and the whole animation read the same element.
const ELEMENT_PATTERNS = [
  ['fire',      /fire|flame|pyro|ember|inferno|meteor|cinder|immol|burn|phoenix|magma|scorch|blaze/],
  ['ice',       /frost|cryo|\bice\b|blizzard|glaci|freeze|snow|chill|permafrost|winter|cold|shard/],
  ['lightning', /spark|thunder|storm|volt|tesla|shock|\barc\b|chain|conduct|static|tempest|lightning|gale/],
  ['holy',      /holy|divine|smite|judg|sacred|consecr|radian|zeal|seraph|light\b|bless|sanct/],
  ['venom',     /venom|poison|toxic|plague|corros|decay|virulent|noxious|acid|caltrop|blight/],
  ['blood',     /blood|rend|\bgut\b|backstab|knife|throw|dagger|shadow|assassin|bleed|sanguine|carve|eviscer|butcher/],
  ['arcane',    /arcane|magic|mystic|orb|missile|nether|void|blink|teleport|phantom|spell|hex|curse|dash|clone/],
];

// Classify a skill/spell to an element key from its name (+ optional icon). Returns
// `fallback` when nothing matches — spells fall back to 'gold' (the historic bolt
// colour); weapon skills / swings pass 'physical' so a plain strike reads as steel.
export function elementOf(name, icon, fallback = DEFAULT_ELEMENT) {
  const t = ((icon || '') + ' ' + (name || '')).toLowerCase();
  for (const [el, re] of ELEMENT_PATTERNS) if (re.test(t)) return el;
  return fallback;
}

// The palette (core/glow/trail/spark/edge) for an element key, always defined
// (unknown keys fall back to the gold default so a drawer never reads undefined).
export function paletteFor(element) {
  return VFX_PALETTES[element] || VFX_PALETTES[DEFAULT_ELEMENT];
}

// The animation archetype for a cast shape / weapon style / projectile kind.
export function castArchetype(shape) { return SHAPE_ARCHETYPE[shape] || 'impact'; }
export function weaponArchetype(style) { return WEAPON_ARCHETYPE[style] || 'slashArc'; }
export function projectileElement(kind) { return PROJECTILE_ELEMENT[kind] || 'physical'; }

// The {type, el} animation spec for a named boss ability, or null if it has none
// (falls back to the old generic feedback at the call site).
export function bossFxFor(name) { return BOSS_ABILITY_FX[name] || null; }

// ── easing / envelope helpers ──
// Small deterministic curves the drawers share so every effect grows and fades on
// a consistent, readable rhythm (all map 0..1 -> 0..1 unless noted).
export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeOutCubic = t => { t = clamp01(t); return 1 - Math.pow(1 - t, 3); };
export const easeInCubic  = t => { t = clamp01(t); return t * t * t; };
export const easeInOutSine = t => { t = clamp01(t); return 0.5 - 0.5 * Math.cos(Math.PI * t); };
// Overshoots past 1 near the end then settles — used for a snappy nova/impact pop.
export const easeOutBack = (t, s = 1.70158) => { t = clamp01(t) - 1; return 1 + (s + 1) * t * t * t + s * t * t; };
// A 0 -> 1 -> 0 bump (out and back), for a slash arc's sweep or a flash's rise/fall.
export const bump = t => { t = clamp01(t); return Math.sin(Math.PI * t); };
