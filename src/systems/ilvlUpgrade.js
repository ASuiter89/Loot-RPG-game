// Item-level upgrade ("Empower") logic — pure pricing + value rescale for raising
// a piece's item level toward the depth it could naturally drop at. Kept out of
// the render/DOM/state layers so the whole model is unit-testable: callers pass
// the item's rarity RANK, its current/target item level, and (for the rescale)
// the stat's value bands at each level; nothing here reads game state, the DOM or
// RNG.
//
// The rescale never changes WHICH modifiers a piece carries — only their VALUES,
// exactly as a deeper drop of the same piece would roll them — so empowering a
// fixed unique/set or a cursed item is consistent (it doesn't reforge a locked
// piece, it just scales it to depth).
import { ILVL_UPGRADE } from '../data/ilvlUpgradeTuning.js';

// Gold + material multiplier for an item's rarity rank (0 junk … 6 unique).
export function tierFactor(rank) { return 1 + Math.max(0, rank | 0) * ILVL_UPGRADE.tierFactorStep; }

// The upgrade choices offered from `curIlvl` toward `cap` (the deepest item level
// that could currently drop for you): +1, +10, and straight to the cap. Each is
// clamped to the cap, dropped if it doesn't advance past the current level, and
// de-duplicated by target — so when +10 or +1 already lands on the cap the extra
// buttons collapse away. Every option is labelled by the ACTUAL step it applies
// (so a clamped "+10" that only gains 3 reads as +3), and flags whether it hits
// the cap. Returns [] when the piece is already at (or past) the cap.
export function upgradeOptions(curIlvl, cap) {
  const from = Math.max(1, Math.floor(curIlvl) || 1);
  const ceil = Math.max(1, Math.floor(cap) || 1);
  if (from >= ceil) return [];
  const seen = new Set();
  const out = [];
  for (const target of [from + 1, from + 10, ceil]) {
    const to = Math.min(ceil, target);
    if (to <= from || seen.has(to)) continue;
    seen.add(to);
    out.push({ to, step: to - from, atCap: to === ceil });
  }
  return out;
}

// Gold + material cost to raise a piece of rarity `rank` from `fromIlvl` to
// `toIlvl`, summed across every level gained (so the deeper levels in a big jump
// cost more). Returns the plain { gold, scrap, core? } object the shared wallet
// helpers (canAfford / spendCost / costLabel) understand. Scrap is the guaranteed
// bulk sink (≥1); Core joins on rare+ gear once it rounds to a whole unit.
export function upgradeCost({ rank = 0, fromIlvl = 1, toIlvl = 1 }) {
  const from = Math.max(1, Math.floor(fromIlvl) || 1);
  const to = Math.max(from, Math.floor(toIlvl) || from);
  const tf = tierFactor(rank);
  let gold = 0, scrap = 0, core = 0;
  for (let L = from + 1; L <= to; L++) {
    gold += (ILVL_UPGRADE.goldBase + L * ILVL_UPGRADE.goldPerIlvl) * tf;
    scrap += (ILVL_UPGRADE.scrapBase + L * ILVL_UPGRADE.scrapPerIlvl) * tf;
    if (rank >= ILVL_UPGRADE.coreRank) {
      core += ILVL_UPGRADE.coreBase + (rank - ILVL_UPGRADE.coreRank) * ILVL_UPGRADE.corePerRank + L * ILVL_UPGRADE.coreIlvlStep;
    }
  }
  const cost = { gold: Math.round(gold), scrap: Math.max(1, Math.round(scrap)) };
  const c = Math.round(core);
  if (c >= 1) cost.core = c;
  return cost;
}

// Generation-curve factor for a headline role at item level `lvl` (see
// ILVL_UPGRADE.headlineSlopes). Used only as a ratio, so the rarity/base/slot
// constants that multiply it in the real formula cancel.
export function headlineFactor(role, lvl) {
  const L = Math.max(1, lvl || 1);
  const s = ILVL_UPGRADE.headlineSlopes[role];
  return s ? s.base + L * s.per : 1;
}

// Rescale a deterministic HEADLINE value (a weapon DMG endpoint, armour DEF,
// off-hand ATK, shield BLOCK) by the ratio of its generation curve at the
// two item levels — exactly how it would have been generated deeper. Never below
// 1, and (bands only grow with depth) never below the current value.
export function scaleHeadline(value, fromFactor, toFactor) {
  if (!(fromFactor > 0)) return value;
  return Math.max(1, value, Math.round(value * toFactor / fromFactor));
}

// Rescale one AFFIX-scaled value — a rolled stat/native signature/modifier or an
// attribute — from its current item level to a deeper one, preserving its RELATIVE
// roll quality (value ÷ band-max). Deeper bands are always bigger, so a positive
// value never shrinks; it is also floored at the new band's minimum so an
// empowered roll is never weaker than the weakest fresh drop at that depth. A
// NEGATIVE value (a curse's drawback) grows more negative in step, so the penalty
// scales with the gift and the curse's bound trade-off is preserved.
export function projectAffix(value, fromMax, toMax, toMin = 0) {
  if (!(fromMax > 0)) return value;
  const scaled = Math.round(value * toMax / fromMax);
  if (value < 0) return scaled;                       // curse penalty — no positive floor
  return Math.max(toMin || 0, value, scaled);         // never below the fresh-drop floor or current
}
