// Dread Covenants — pure aggregation math. Numbers/objects in, numbers/objects out;
// no globals, no RNG, no DOM, no clock. The legacy shell (src/legacy/game.js) owns the
// live active-set array (persisted on the hero) and applies these multipliers at the
// spawn/loot/heal call sites; this module only turns "which curses are active" into
// "how much harder / how much richer".
//
// Every function tolerates garbage (null / undefined / NaN / unknown ids / fractional
// input) and never throws — a corrupt save must still boot. Absent covenant params
// resolve to the neutral baseline in DREAD_TUNING, so a sparse def in data is fully
// specified here.
import { COVENANTS, DREAD_TUNING } from '../data/covenants.js';
import { DREAD_REWARDS } from '../data/dreadRewards.js';

// --- small internal helpers -------------------------------------------------------

// Dedup + resolve an id array to the covenant defs it names, dropping unknowns and
// repeats (a curse can only be sworn once). Returns an array of def objects.
function resolveActive(activeIds, data) {
  const defs = Array.isArray(data) ? data : COVENANTS;
  const ids = Array.isArray(activeIds) ? activeIds : [];
  const seen = new Set();
  const out = [];
  for (const raw of ids) {
    const id = raw && String(raw);
    if (!id || seen.has(id)) continue;
    const def = defs.find((c) => c && c.id === id);
    if (def) { seen.add(id); out.push(def); }
  }
  return out;
}

// A finite number or the fallback — guards NaN/Infinity/garbage from a corrupt def.
function num(v, fallback) {
  return (typeof v === 'number' && isFinite(v)) ? v : fallback;
}

// --- soft-cap curve ---------------------------------------------------------------

// The diminishing, bounded reward shape. softcap(x, cap) = cap·(1 − e^(−x/cap)): 0 at
// x=0, strictly increasing in x, asymptotic to `cap` from below (never reaches it).
// Negative x clamps to 0 (no negative rewards); a non-positive cap ⇒ 0 (feature off).
// Exported so tests can assert monotonicity + the ceiling directly.
export function softcap(x, cap) {
  const c = num(cap, 0);
  const v = num(x, 0);
  if (c <= 0) return 0;
  if (v <= 0) return 0;
  return c * (1 - Math.exp(-v / c));
}

// --- Dread accounting -------------------------------------------------------------

// Total Dread of the active set — the number the whole system pivots on. Sum of each
// active covenant's `dread`; unknown/duplicate ids contribute nothing.
export function activeDread(activeIds, data = COVENANTS) {
  return resolveActive(activeIds, data)
    .reduce((sum, c) => sum + Math.max(0, num(c.dread, 0)), 0);
}

// Look up one covenant def by id, or null. Handy for the altar tooltip.
export function covenantById(id, data = COVENANTS) {
  if (!id) return null;
  const defs = Array.isArray(data) ? data : COVENANTS;
  return defs.find((c) => c && c.id === id) || null;
}

// A display copy sorted by unlockOrder → dread → name, so the altar always renders the
// same stable ramp regardless of the source array's order. Never mutates `data`.
export function sortedCovenants(data = COVENANTS) {
  const defs = Array.isArray(data) ? data : COVENANTS;
  return defs.slice().sort((a, b) => {
    const uo = num(a.unlockOrder, 0) - num(b.unlockOrder, 0);
    if (uo) return uo;
    const dd = num(a.dread, 0) - num(b.dread, 0);
    if (dd) return dd;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

// --- multiplier aggregation -------------------------------------------------------

// Fold the active set into ONE bundle of live multipliers the shell applies:
//   multiplicative knobs (hp/dmg/density/dropQty/rarity/bossPoint) MULTIPLY together;
//   healingMult takes the MIN (harshest single healing debuff, not a stacking spiral);
//   eliteChanceAdd + malaiseRate are additive rates that SUM.
// Absent params default to DREAD_TUNING.neutralParams. eliteChanceAdd is clamped to
// [0, maxEliteChance] so a stack of elite curses stays a roll, never a certainty.
export function covenantMultipliers(activeIds, data = COVENANTS) {
  const N = DREAD_TUNING.neutralParams;
  const acc = {
    enemyHpMult: N.enemyHpMult,
    enemyDmgMult: N.enemyDmgMult,
    densityMult: N.densityMult,
    healingMult: N.healingMult,   // starts at 1, only ever shrinks via MIN
    dropQtyMult: N.dropQtyMult,
    rarityMult: N.rarityMult,
    bossPointMult: N.bossPointMult,
    eliteChanceAdd: N.eliteChanceAdd,
    malaiseRate: N.malaiseRate,
  };
  for (const def of resolveActive(activeIds, data)) {
    const p = (def && def.params) || {};
    acc.enemyHpMult   *= Math.max(1, num(p.enemyHpMult,   N.enemyHpMult));
    acc.enemyDmgMult  *= Math.max(1, num(p.enemyDmgMult,  N.enemyDmgMult));
    acc.densityMult   *= Math.max(1, num(p.densityMult,   N.densityMult));
    acc.dropQtyMult   *= Math.max(1, num(p.dropQtyMult,   N.dropQtyMult));
    acc.rarityMult    *= Math.max(1, num(p.rarityMult,    N.rarityMult));
    acc.bossPointMult *= Math.max(1, num(p.bossPointMult, N.bossPointMult));
    // Healing debuffs don't compound — take the single harshest one, clamped to (0,1].
    const heal = Math.min(1, Math.max(0, num(p.healingMult, N.healingMult)));
    acc.healingMult = Math.min(acc.healingMult, heal);
    acc.eliteChanceAdd += Math.max(0, num(p.eliteChanceAdd, N.eliteChanceAdd));
    acc.malaiseRate   += Math.max(0, num(p.malaiseRate,    N.malaiseRate));
  }
  acc.eliteChanceAdd = Math.min(DREAD_TUNING.maxEliteChance, acc.eliteChanceAdd);
  return acc;
}

// --- reward curves ----------------------------------------------------------------

// Turn total Dread into the four reward multipliers, each = 1 + softcap(perDread·dread,
// cap). Negative/NaN dread clamps to 0 ⇒ all ×1. The shell multiplies these into its
// drop-quantity, rarity, boss-point and material rolls respectively.
export function dreadRewardMult(dread, rewards = DREAD_REWARDS) {
  const R = rewards || DREAD_REWARDS;
  const d = Math.max(0, num(dread, 0));
  const one = (curve) => {
    const c = curve || {};
    return 1 + softcap(num(c.perDread, 0) * d, num(c.cap, 0));
  };
  return {
    lootQty: one(R.lootQty),
    rarity: one(R.rarity),
    bossPoint: one(R.bossPoint),
    material: one(R.material),
  };
}

// --- unlock + persistence hygiene -------------------------------------------------

// Is a covenant available to swear yet? A covenant unlocks once the account holds at
// least `unlockOrder` completion marks (marksCount). Unknown id ⇒ false (can't swear
// what doesn't exist). unlockOrder 0 covenants are always available.
export function isUnlocked(id, marksCount, data = COVENANTS) {
  const def = covenantById(id, data);
  if (!def) return false;
  return Math.max(0, Math.floor(num(marksCount, 0))) >= Math.max(0, num(def.unlockOrder, 0));
}

// Clean a loaded active-set blob to an array of KNOWN, de-duplicated ids, preserving
// order. Old saves (no field), corrupt entries and unknown ids all wash out — so the
// altar always starts from a valid set.
export function sanitizeActiveSet(rawArray, data = COVENANTS) {
  return resolveActive(rawArray, data).map((c) => c.id);
}

// One call for the altar's "if you descend now…" preview: the total Dread, the
// aggregated difficulty/reward multipliers, and the Dread-curve reward multipliers.
export function projectedSummary(activeIds, data = COVENANTS, rewards = DREAD_REWARDS) {
  const dread = activeDread(activeIds, data);
  return {
    dread,
    multipliers: covenantMultipliers(activeIds, data),
    rewards: dreadRewardMult(dread, rewards),
  };
}
