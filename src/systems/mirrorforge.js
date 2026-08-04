// ── THE MIRRORFORGE — deep-crafting / perfection logic ──
// Pure functions over an injected rng + a plain item, driving the Mirrorforge
// endgame sink (tuning in src/data/mirrorforge.js). No DOM, no window, no fetch,
// no Math.random, no Date.now — every source of randomness is a passed `rng`
// (() => number in [0,1)), so the whole system is deterministic and unit-testable
// and the legacy shell (src/legacy/game.js) supplies the real rng + wallet.
//
// WHY it exists: deep-Endless heroes drown in crafting materials with nothing
// bounded to chase. The Mirrorforge caps each item's crafting with a finite
// Forging Potential (FP) budget, so perfection must be PLANNED (not brute-forced),
// then MIRRORed into a second, harder collection axis (Owned → Perfected).
//
// ── MINIMAL ITEM CONTRACT (the shell adapts real items to this) ──
// Real game items store stats in `item.stats`/`item.attrs`; the Mirrorforge does
// NOT need that shape. It operates on a small, explicit contract so it stays pure
// and testable, and the shell maps each real stat/attr into an `affixes` entry
// before calling in, then folds results back out:
//
//   item = {
//     tier:     string,   // rarity key ('rare','epic','legendary',…) — used for curse sizing
//     rank:     int 0..6, // rarity rank (index in TIERS) — drives the FP budget & costs
//     ilvl:     int,      // item level — drives the FP budget & shatter value
//     affixes:  [ { key, val, min, max, ...rest } ],  // the sculptable bonus rolls
//     mirrored?: bool,    // locked perfect copy (Perfected axis) — no further crafting
//     sealed?:   bool,    // Corrupt sealed it — no further crafting
//     radiant?:  bool,    // carries a "greater roll"
//     _fpSpent?: int,     // FP consumed so far (default 0); budget depletes across actions
//     ...preserve rest    // ANY other field is carried through untouched (shallow copy)
//   }
//
// EVERY function returns a NEW item (never mutates the input) and preserves
// unknown fields via a shallow clone, so the shell can stash bespoke data on the
// item and trust it survives a full sculpt → mirror sequence.
import { MIRRORFORGE } from '../data/mirrorforge.js';
// Corrupt's `curse` outcome reuses the SHARED curse-swing math (one implementation
// of "boost and penalty are equally strong"), so a Mirrorforge curse sizes exactly
// like a cursed drop does.
import { statCurseSwing, cursedStatCeiling, curseTierMult } from './curseRoll.js';

// ── small defensive helpers (garbage in → sane out, never throw) ──
// A finite number or the fallback. Guards against NaN/undefined/null/strings.
function num(v, d = 0) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
// A non-negative integer (floored). Used for rank/ilvl/FP.
function clampInt(v) { return Math.max(0, Math.floor(num(v))); }
// Clamp to [0,1] — for fraction tunables.
function clamp01(v) { return Math.max(0, Math.min(1, num(v))); }
// Deep-ish clone: shallow-copy the item AND copy every affix object, so mutating
// the clone's affixes can never touch the caller's item. Unknown fields ride along.
function cloneItem(item) {
  const src = (item && typeof item === 'object') ? item : {};
  const affixes = Array.isArray(src.affixes) ? src.affixes.map(a => ({ ...a })) : [];
  return { ...src, affixes };
}
// Weighted pick over [{weight, …}] using the injected rng. Returns null for an
// empty/garbage table or non-positive total weight (so callers stay safe).
function weightedPick(rng, outcomes) {
  const list = Array.isArray(outcomes) ? outcomes.filter(o => o && num(o.weight) > 0) : [];
  const total = list.reduce((s, o) => s + num(o.weight), 0);
  if (total <= 0) return null;
  let r = ((typeof rng === 'function') ? clamp01(rng()) : 0) * total;
  for (const o of list) { r -= num(o.weight); if (r < 0) return o; }
  return list[list.length - 1]; // rng()===~1 edge — last bucket
}
// Clamp a computed index into an array's valid range.
function idxIn(i, len) { return Math.max(0, Math.min(len - 1, Math.floor(num(i)))); }

// ── Forging Potential budget / spend / remaining ──
// The finite FP an item can ever spend: base + perRank·rank + perIlvl·ilvl.
export function fpBudget(item, data = MIRRORFORGE) {
  const fp = (data && data.fp) ? data.fp : MIRRORFORGE.fp;
  return Math.max(0, Math.round(num(fp.base) + num(fp.perRank) * clampInt(item && item.rank) + num(fp.perIlvl) * clampInt(item && item.ilvl)));
}
// FP already spent on the item, read off `item._fpSpent` (default 0). Kept as a
// tiny item field so the budget depletes across a whole action sequence.
export function fpSpent(item) {
  const v = item && item._fpSpent;
  return (typeof v === 'number' && v > 0) ? Math.floor(v) : 0;
}
// FP still available to spend (never negative, even if a save over-spent).
export function fpRemaining(item, data = MIRRORFORGE) {
  return Math.max(0, fpBudget(item, data) - fpSpent(item));
}

// ── Cost lookups ──
// FP an action draws from the budget (0 for Mirror or an unknown action).
export function fpCost(action, item, data = MIRRORFORGE) {
  const c = data && data.costs && data.costs[action];
  return (c && typeof c.fp === 'number') ? Math.max(0, Math.floor(c.fp)) : 0;
}
// The material bill for an action ({scrap,glimmer,core,chaos,aether?}) — the plain
// object the shell's wallet helpers (canAfford/spendCost) understand. Empty for an
// unknown action.
export function matCost(action, data = MIRRORFORGE) {
  const c = data && data.costs && data.costs[action];
  return (c && c.mats && typeof c.mats === 'object') ? { ...c.mats } : {};
}

// Can an action be applied right now? Returns {ok, reason} so the UI can explain a
// disabled button. Order of checks is fixed so the reason is deterministic:
// unknown action → already mirrored → sealed by corrupt → not enough FP → not
// enough materials. `wallet` is the live materials object; `fpRem` is the caller's
// fpRemaining(item) (passed in so the shell can pre-compute it once per frame).
export function canApply(action, item, fpRem, wallet, data = MIRRORFORGE) {
  if (!(data && data.costs && data.costs[action])) return { ok: false, reason: 'unknown' };
  if (item && item.mirrored) return { ok: false, reason: 'mirrored' };
  if (item && item.sealed) return { ok: false, reason: 'sealed' };
  if (num(fpRem) < fpCost(action, item, data)) return { ok: false, reason: 'fp' };
  const mats = matCost(action, data);
  const w = (wallet && typeof wallet === 'object') ? wallet : {};
  for (const k in mats) { if (num(w[k]) < num(mats[k])) return { ok: false, reason: 'mats' }; }
  return { ok: true, reason: '' };
}

// ── ATTUNE — reforge the bonus affixes, guaranteeing the chosen stat rolls strong ──
// Rerolls every affix value in-band. The targeted key is GUARANTEED present and
// strong: it rolls in the top (1 - attuneTargetFloor) of its band (top half by
// default), so "attuning toward Might" always leaves a healthy Might. (In the real
// shell a reforge can drop/replace affixes; there the guarantee is re-adding the
// target — here, on the fixed-affix contract, it is the strong-roll guarantee.)
// Burns Attune's FP.
export function applyAttune(item, targetAffixKey, rng, data = MIRRORFORGE) {
  const it = cloneItem(item);
  const floor = clamp01(num(data.attuneTargetFloor, 0.5));
  for (const a of it.affixes) {
    const min = num(a.min), max = num(a.max, min);
    if (max <= min) { a.val = min; continue; }
    // The targeted stat rerolls only in its upper band; everything else full-band.
    const lo = (targetAffixKey && a.key === targetAffixKey) ? min + (max - min) * floor : min;
    const r = (typeof rng === 'function') ? clamp01(rng()) : 0;
    a.val = Math.round(lo + r * (max - lo));
  }
  it._fpSpent = fpSpent(item) + fpCost('attune', item, data);
  return it;
}

// ── EXALT — deterministically push one affix toward its ceiling ──
// No RNG: closes `exaltFraction` of the remaining gap to max each cast (halve by
// default), so repeated Exalts converge on — but never exceed — the affix's max,
// and never DECREASE it (monotonic). An invalid index is a graceful no-op (returns
// an unchanged clone and burns no FP). Burns Exalt's FP on a real change.
export function applyExalt(item, affixIndex, data = MIRRORFORGE) {
  const it = cloneItem(item);
  const i = Math.floor(num(affixIndex, -1));
  const a = it.affixes[i];
  if (!a) return it; // out-of-range: nothing happened, don't burn FP
  const val = num(a.val, num(a.min));
  const max = num(a.max, val);
  const frac = clamp01(num(data.exaltFraction, 0.5));
  a.val = (val < max) ? Math.min(max, Math.round(val + (max - val) * frac)) : val;
  it._fpSpent = fpSpent(item) + fpCost('exalt', item, data);
  return it;
}

// ── DIVINE — reroll one affix's value in-band (Aether → top decile) ──
// The precision finisher: rerolls affix `affixIndex` uniformly in [min,max]. With
// `useAether` true it instead snaps into the top decile [min + aetherDecile·range,
// max] — a guaranteed near-perfect roll (the shell charges the Aether). An invalid
// index is a graceful no-op. Burns Divine's FP on a real change.
export function applyDivine(item, affixIndex, useAether, rng, data = MIRRORFORGE) {
  const it = cloneItem(item);
  const i = Math.floor(num(affixIndex, -1));
  const a = it.affixes[i];
  if (!a) return it;
  const min = num(a.min), max = num(a.max, min);
  const lo = useAether ? min + (max - min) * clamp01(num(data.aetherDecile, 0.9)) : min;
  const r = (typeof rng === 'function') ? clamp01(rng()) : 0;
  a.val = (max <= min) ? min : Math.round(lo + r * (max - lo));
  it._fpSpent = fpSpent(item) + fpCost('divine', item, data);
  return it;
}

// ── CORRUPT — a one-shot, irreversible gamble that SEALS the item ──
// Rolls the weighted corruptOutcomes table and applies its effect, then ALWAYS
// marks the item sealed (no further crafting) and NEVER destroys it (never returns
// null). Outcomes:
//   • addAffix  — append one bonus affix rolled in the outcome's band.
//   • radiant   — flag radiant + push a random affix into its top decile.
//   • signature — brand the item with a unique power id (shell maps id → power).
//   • curse     — big boost on one affix + an equally-big penalty affix, sized by
//                 the SHARED curse-swing math (curseTierMult / statCurseSwing /
//                 cursedStatCeiling), so the drawback always matches the gift.
// Records `_corrupt` (the outcome id) for the log/UI. Burns Corrupt's FP.
export function applyCorrupt(item, rng, data = MIRRORFORGE) {
  const it = cloneItem(item);
  const outcome = weightedPick(rng, data && data.corruptOutcomes);
  if (outcome) {
    it._corrupt = outcome.id;
    switch (outcome.kind) {
      case 'addAffix': {
        const band = outcome.band || { min: 1, max: 1 };
        const lo = num(band.min), hi = num(band.max, lo);
        const r = (typeof rng === 'function') ? clamp01(rng()) : 0;
        it.affixes.push({ key: 'MIRRORFORGE', val: Math.round(lo + r * Math.max(0, hi - lo)), min: lo, max: hi, corrupt: true });
        break;
      }
      case 'radiant': {
        it.radiant = true;
        if (it.affixes.length) {
          const a = it.affixes[idxIn((typeof rng === 'function' ? clamp01(rng()) : 0) * it.affixes.length, it.affixes.length)];
          const min = num(a.min), max = num(a.max, min);
          const b = (data.radiant && data.radiant.band) ? data.radiant.band : { min: 0.9, max: 1 };
          a.val = (max <= min) ? min : Math.round(min + (max - min) * clamp01(num(b.min, 0.9)));
        }
        break;
      }
      case 'signature':
        it.signature = outcome.signature || outcome.id;
        break;
      case 'curse': {
        const mult = curseTierMult(it.tier);
        // NO SCULPTABLE AFFIX, NO CURSE. The contract lists only UNLOCKED properties,
        // so a piece whose stats are all locked (a bare headline-only weapon, a fixed
        // unique/set piece) arrives here with an empty list — there's nothing to gift
        // and nothing to charge for. Flagging it cursed anyway (the old behaviour, this
        // flag sat outside the guard) branded it with a skull and zero drawback: a
        // cursed item with no downside, the exact thing a curse must never be. It still
        // seals and still records the outcome; it just isn't a curse.
        if (it.affixes.length) {
          const a = it.affixes[idxIn((typeof rng === 'function' ? clamp01(rng()) : 0) * it.affixes.length, it.affixes.length)];
          const swing = statCurseSwing(num(a.max, num(a.val)), mult);
          const ceil = cursedStatCeiling(num(a.max, num(a.val)), mult);
          a.val = Math.min(ceil, Math.round(num(a.val) + swing)); // the big gift
          if (a.max < ceil) a.max = ceil;                          // widen band so later sculpts stay bounded
          // The equally-strong drawback, as its own penalty affix (locked negative).
          it.affixes.push({ key: 'CURSE', val: -swing, min: -ceil, max: 0, curse: true });
          it.curseStat = a.key;
          it.cursed = true;
        }
        break;
      }
      default: break; // unknown kind — still seals, still safe
    }
  }
  it.sealed = true; // ALWAYS — Corrupt closes the item to further crafting
  it._fpSpent = fpSpent(item) + fpCost('corrupt', item, data);
  return it;
}

// ── MIRROR — lock a perfect copy into the Perfected collection axis ──
// Whether the item can be Mirrored right now: not already mirrored, not sealed by a
// Corrupt, and enough FP remaining to cover Mirror's (usually 0) FP cost. Returns
// {ok, reason} for the UI.
export function canMirror(item, fpRem, data = MIRRORFORGE) {
  if (!item) return { ok: false, reason: 'noitem' };
  if (item.mirrored) return { ok: false, reason: 'mirrored' };
  if (item.sealed) return { ok: false, reason: 'sealed' };
  const need = (data && data.costs && data.costs.mirror && typeof data.costs.mirror.fp === 'number') ? Math.max(0, data.costs.mirror.fp) : 0;
  if (num(fpRem) < need) return { ok: false, reason: 'fp' };
  return { ok: true, reason: '' };
}
// Produce the mirrored (perfect, locked) copy. Flags `mirrored` and preserves
// everything else; the shell mints this as a NEW stash item on the Perfected axis.
export function applyMirror(item) {
  const it = cloneItem(item);
  it.mirrored = true;
  return it;
}

// ── SHATTER — retire a worked item for Attunement (the pity currency) ──
// Attunement returned by shattering: a base + a per-rank term + a slice of ilvl,
// with big bonuses for a radiant or an already-mirrored piece. Feeds the SHARED
// targeting pity (collectionTargeting.js) at the shell so a dry streak still bends
// toward the artifact you're aiming for. Always a non-negative integer.
export function shatterToAttunement(item, data = MIRRORFORGE) {
  const a = (data && data.attunement) ? data.attunement : MIRRORFORGE.attunement;
  let gain = num(a.perShatter) + num(a.perRank) * clampInt(item && item.rank)
    + Math.floor(clampInt(item && item.ilvl) / Math.max(1, num(a.perIlvlDiv, 20)));
  if (item && item.radiant) gain += num(a.radiantBonus);
  if (item && item.mirrored) gain += num(a.mirroredBonus);
  return Math.max(0, Math.round(gain));
}

// ── RADIANT "greater roll" odds in deep Endless ──
// The chance a dropped affix rolls radiant, climbing from chanceBase by perDepth
// per Endless floor, hard-capped at `cap`. Monotonic non-decreasing in depth, and
// clamped to [0,cap] so a corrupt save or a shallow floor can't produce nonsense.
export function radiantChance(endlessDepth, data = MIRRORFORGE) {
  const r = (data && data.radiant) ? data.radiant : MIRRORFORGE.radiant;
  const c = num(r.chanceBase) + num(r.perDepth) * Math.max(0, num(endlessDepth));
  return Math.max(0, Math.min(num(r.cap, 1), c));
}
// Roll whether a drop is radiant at this Endless depth (pure over the injected rng).
export function rollRadiant(rng, endlessDepth, data = MIRRORFORGE) {
  const r = (typeof rng === 'function') ? rng() : 0;
  return r < radiantChance(endlessDepth, data);
}

// Whether Aether (the Mirror / top-roll material) can drop yet — true once the hero
// is at or past the Endless depth gate. Lets the shell hide the Mirror/Aether-Divine
// options until they're reachable.
export function aetherUnlocked(endlessDepth, data = MIRRORFORGE) {
  const a = (data && data.aether) ? data.aether : MIRRORFORGE.aether;
  return Math.max(0, num(endlessDepth)) >= num(a.minEndlessDepth);
}
