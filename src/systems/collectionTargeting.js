// Shared collection-TARGETING math — pure bad-luck-protection reused by the
// endgame systems that let you "aim" a farm at a specific missing unique/set slot
// (Dread Covenants' completion marks, the Mirrorforge's Attunement, the Pantheon's
// per-boss pity). One implementation, one curve, so the three never drift.
//
// Everything here is a pure function over plain values + an injected rng
// (() => number in [0,1)); no globals, no DOM, no Math.random. The legacy shell
// owns the live pity counter (persisted per hero) and decides WHEN a drop is
// "eligible"; this module only answers "how strong is the nudge" and "which slot".
import { TARGETING } from '../data/targeting.js';

// The redirect probability at a given pity level. Climbs from baseBias by
// biasPerPity each point, capped at maxBias — then becomes a hard 1 (certain) at
// or beyond guaranteeAt so a dry streak can't run forever.
export function targetBias(pity, T = TARGETING) {
  const p = Math.max(0, Math.floor(pity || 0));
  if (p >= T.guaranteeAt) return 1;
  return Math.min(T.maxBias, T.baseBias + T.biasPerPity * p);
}

// True once pity has reached the guarantee threshold (the next eligible drop is
// certain to be the target). Exposed for UI ("guaranteed next!") and callers that
// want to short-circuit the roll.
export function isPityGuaranteed(pity, T = TARGETING) {
  return Math.max(0, Math.floor(pity || 0)) >= T.guaranteeAt;
}

// Roll whether an eligible drop is redirected onto the chosen target. Pure over the
// injected rng, so a seeded stream reproduces the outcome (leaderboard-auditable).
export function shouldRedirect(rng, pity, T = TARGETING) {
  const r = (typeof rng === 'function') ? rng() : 0;
  return r < targetBias(pity, T);
}

// Advance the pity counter after an eligible drop resolves: reset to 0 when the
// target was obtained, else grow by perRunPity. Clamps to non-negative integers so
// a corrupt save can't poison the curve.
export function nextPity(pity, gotTarget, T = TARGETING) {
  const p = Math.max(0, Math.floor(pity || 0));
  if (gotTarget) return 0;
  return p + Math.max(1, Math.floor(T.perRunPity || 1));
}

// How many more eligible drops until the guarantee (0 once guaranteed). Drives the
// "N to go" pity meter in the UI.
export function pityRemaining(pity, T = TARGETING) {
  return Math.max(0, T.guaranteeAt - Math.max(0, Math.floor(pity || 0)));
}

// Pick a still-MISSING catalog key to target, uniformly at random over the gaps.
// `catalogKeys` is the ordered list of every artifact's catalog key (see
// uniqueCollection.buildCollectionCatalog → entry.key); `ownedKeySet` is the set of
// keys the account already has (uniqueCollection.acquiredKeySet). Returns null when
// nothing is missing (collection complete) so the caller can hide the option.
export function pickMissingTarget(catalogKeys, ownedKeySet, rng) {
  const keys = Array.isArray(catalogKeys) ? catalogKeys : [];
  const owned = (ownedKeySet instanceof Set) ? ownedKeySet : new Set(ownedKeySet || []);
  const missing = keys.filter((k) => k && !owned.has(k));
  if (!missing.length) return null;
  const i = Math.floor(((typeof rng === 'function') ? rng() : 0) * missing.length);
  return missing[Math.min(missing.length - 1, Math.max(0, i))];
}

// Whether a chosen target is still worth pursuing (exists in the catalog and not
// yet owned). Lets the shell auto-clear a target the moment it's obtained.
export function targetStillValid(targetKey, catalogKeys, ownedKeySet) {
  if (!targetKey) return false;
  const keys = Array.isArray(catalogKeys) ? catalogKeys : [];
  const owned = (ownedKeySet instanceof Set) ? ownedKeySet : new Set(ownedKeySet || []);
  return keys.includes(targetKey) && !owned.has(targetKey);
}
