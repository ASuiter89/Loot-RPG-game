// ── HEALER BUFF MATH (pure) ──
// Cost scaling for Blessings, fx aggregation across the active healer buffs, and
// the add/replace + per-floor expiry rules. Kept free of DOM / RNG / clock so it's
// unit-tested; the game shell wires live state + logging around it.
import { HEALER_BLESSINGS } from '../data/healerBuffs.js';
import { GOLD_DROP_FLAT, GOLD_DROP_PER_DEPTH } from '../data/goldDrops.js';

// Blessings price off the DUNGEON, not the hero. The old curve compounded with
// hero level and outran a purse that only grows linearly with depth, so a
// Blessing priced itself out of reach exactly when it mattered. Now the sticker
// price tracks the average gold a kill drops at the floor you're on: the ratio of
// price to income holds flat forever, so a Blessing is as affordable on floor 90
// as on floor 9 — and it carries an explicit half-off cut on top.
export const BLESSING_DISCOUNT = 0.5;

// Average gold one kill drops at `depth`, before the hero's own multipliers —
// the mean of the shell's roll (GOLD_DROP_MIN..MAX + depth × per-depth).
export function avgGoldDrop(depth) {
  const d = Math.max(1, Math.floor(depth) || 1);
  return GOLD_DROP_FLAT + GOLD_DROP_PER_DEPTH * d;
}

// Gold price of a Blessing at a given dungeon depth: `base` is what it costs on
// floor 1, scaled by how much richer a drop is down here and halved. Floored to
// an integer; non-finite / negative inputs floor to 0.
export function blessingCost(base, depth) {
  const b = Math.max(0, base || 0);
  if (!(b > 0)) return 0;
  return Math.round(b * BLESSING_DISCOUNT * (avgGoldDrop(depth) / avgGoldDrop(1)));
}

// Look up a Blessing definition by id (from the given catalog, defaulting to the
// shipped one). Returns null when unknown.
export function blessingById(id, catalog = HEALER_BLESSINGS) {
  return (Array.isArray(catalog) ? catalog : []).find((b) => b && b.id === id) || null;
}

// Sum one fx key across every active buff in the list (0 when none). Only buffs
// with floors remaining contribute, so an expired-but-not-yet-swept entry is inert.
export function healerBuffFx(buffs, key) {
  if (!Array.isArray(buffs)) return 0;
  let total = 0;
  for (const b of buffs) {
    if (b && b.floors > 0 && b.fx && typeof b.fx[key] === 'number') total += b.fx[key];
  }
  return total;
}

// Add or refresh a buff. A buff with the same id replaces the old one (re-buying
// refreshes its duration); a `blessing` also evicts any OTHER blessing, since only
// one Blessing is active at a time. Returns a NEW array and deep-copies fx, so the
// caller can never alias the catalog definition.
export function upsertHealerBuff(buffs, buff) {
  const list = Array.isArray(buffs) ? buffs : [];
  if (!buff || !buff.id) return list.slice();
  const isBlessing = buff.kind === 'blessing';
  const kept = list.filter((b) => b && b.id !== buff.id && !(isBlessing && b.kind === 'blessing'));
  kept.push({ ...buff, fx: { ...(buff.fx || {}) } });
  return kept;
}

// Age every buff by one floor; drop those that reach zero. Returns { buffs, expired }
// so the caller can log each fade and recompute pools when a maxHp/MP buff lapses.
// Never mutates the input array.
export function tickHealerBuffs(buffs) {
  const kept = [];
  const expired = [];
  for (const b of (Array.isArray(buffs) ? buffs : [])) {
    if (!b) continue;
    const floors = (b.floors || 0) - 1;
    if (floors > 0) kept.push({ ...b, floors });
    else expired.push(b);
  }
  return { buffs: kept, expired };
}

// Does any buff in the list modify the max HP/MP pools (so the caller knows to
// recomputeMaxStats + re-clamp current HP/MP)?
export function affectsMaxPools(buffs) {
  return (Array.isArray(buffs) ? buffs : []).some((b) => b && b.fx && (b.fx.maxHpPct || b.fx.maxMpPct));
}

// Coerce a loaded / unknown value into a clean array of valid buff objects — used by
// the save-migration guard so a malformed or stale field can never break combat.
// Drops anything without an id, a valid fx map, or floors remaining.
export function sanitizeHealerBuffs(buffs) {
  if (!Array.isArray(buffs)) return [];
  return buffs
    .filter((b) => b && typeof b === 'object' && b.id && b.fx && typeof b.fx === 'object' && b.floors > 0)
    .map((b) => ({
      id: b.id,
      kind: b.kind === 'rested' ? 'rested' : 'blessing',
      name: b.name || b.id,
      icon: b.icon || 'ic_heart',
      fx: { ...b.fx },
      floors: b.floors,
      desc: b.desc || '',
    }));
}
