// Pure helpers for the floor-duration shrine boons (the shell's `buffs` map).
//
// Side-effect free so the magnitudes, the active-boon list and the weighted spawn
// pick are all unit-testable; the shell wires them to live game state and
// Math.random(). Mirrors how foodFx/healerFx feed the combat formulas — read live
// each time, because a boon's counter drops one per floor and lapses to 0.
import { SHRINE_DEFS } from '../data/shrines.js';

// Default counters — one 0-floor slot per non-instant kind. The shell seeds
// `buffs` from this and merges any saved values over it, so a save written before
// a kind existed still loads (the missing key defaults to 0).
export function defaultShrineBuffs(defs = SHRINE_DEFS) {
  const out = {};
  for (const kind in defs) if (!defs[kind].instant) out[kind] = 0;
  return out;
}

// Sum every ACTIVE boon's contribution to one effect key. `buffs` maps kind →
// floors-remaining; a kind counts only while its counter is > 0. Unknown keys and
// boons without that key contribute nothing.
export function shrineFxFrom(buffs, key, defs = SHRINE_DEFS) {
  if (!buffs) return 0;
  let sum = 0;
  for (const kind in defs) {
    const fx = defs[kind].fx;
    if (fx && buffs[kind] > 0 && typeof fx[key] === 'number') sum += fx[key];
  }
  return sum;
}

// Active boons as display rows { kind, id, name, icon, floors } in catalog order —
// feeds the HUD status strip and gameState().effects.
export function activeShrineBuffs(buffs, defs = SHRINE_DEFS) {
  const out = [];
  if (!buffs) return out;
  for (const kind in defs) {
    if (buffs[kind] > 0) {
      const def = defs[kind];
      out.push({ kind, id: 's_' + kind, name: def.name, icon: def.icon, floors: buffs[kind] });
    }
  }
  return out;
}

// Terse label for the floating text that pops over the hero on contact — the bare
// distinguishing word, dropping the "Shrine of (the)" / "… Shrine" scaffolding:
//   'Shrine of Fortune' → 'Fortune', 'Shrine of the Leech' → 'Leech',
//   'Blood Shrine' → 'Blood'. Pure string transform, so it's unit-tested; the shell
// pops it in the kind's `tint` colour. Falls back to the trimmed name if it doesn't
// match the pattern (never returns empty).
export function shrineShortName(name) {
  if (!name) return '';
  const short = String(name)
    .replace(/^Shrine of the\s+/i, '')
    .replace(/^Shrine of\s+/i, '')
    .replace(/\s+Shrine$/i, '')
    .trim();
  return short || String(name).trim();
}

// Weighted spawn pick from a [0,1) roll — classic boons stay common, the new ones
// rarer (per-kind `weight`, default 1). Deterministic in the roll so the shell
// passes Math.random() while tests pass fixed values.
export function pickShrineKind(roll, defs = SHRINE_DEFS) {
  const kinds = Object.keys(defs);
  let total = 0;
  for (const k of kinds) total += (defs[k].weight || 1);
  let x = Math.max(0, Math.min(0.9999999, roll)) * total;
  for (const k of kinds) {
    x -= (defs[k].weight || 1);
    if (x < 0) return k;
  }
  return kinds[kinds.length - 1];
}
