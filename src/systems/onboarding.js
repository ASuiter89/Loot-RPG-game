// ── ONBOARDING / RAMP-UP DECISIONS ───────────────────────────────────────────
// Pure query layer over the src/data/onboarding.js schedule. No globals, RNG, DOM
// or clock — every function is a deterministic read of the schedule against the
// hero's progress (deepest floor reached) or a small caller-supplied context, so
// the legacy monolith can gate content and drive the teaching layer without
// embedding any of the numbers. Mirrors the shape of systems/rarityGate.js.

import {
  RAMP_FLOOR, SKILL_SLOT_RAMP, HAZARD_INTRO_FLOOR, EARLY_ENEMY_HP, PLAYER_EARLY_DMG, EARLY_PACK_CAP,
  HINTS, KEEPER_INTRO, STARTER_STEPS, TIPS, DEATH_TIPS,
} from '../data/onboarding.js';

// Deepest floor reached, coerced to a sane integer ≥ 1 (a missing/garbage value
// reads as floor 1, the most-gated state — never accidentally unlocks anything).
export function rampDepth(maxFloor) {
  const n = Math.floor(maxFloor);
  return (Number.isFinite(n) && n >= 1) ? n : 1;
}

// A gated feature is available once the hero has REACHED its gate floor. An
// unknown feature is treated as ungated (available) so a typo never hides content.
export function featureUnlocked(feature, maxFloor) {
  const gate = RAMP_FLOOR[feature];
  if (gate == null) return true;
  return rampDepth(maxFloor) >= gate;
}

// How many of the four hotbar slots are revealed at this depth (highest ramp step
// whose floor the hero has reached).
export function unlockedSkillSlots(maxFloor) {
  const d = rampDepth(maxFloor);
  let slots = SKILL_SLOT_RAMP[0][1];
  for (const [floor, n] of SKILL_SLOT_RAMP) if (d >= floor) slots = n;
  return slots;
}

// Named content gates (thin wrappers so call sites read intent, not a string key).
export const elitesAllowed          = floor => featureUnlocked('elites', floor);
export const gearRequirementsActive = floor => featureUnlocked('gearReq', floor);
export const setItemsAllowed        = floor => featureUnlocked('setItems', floor);
export const cursedItemsAllowed     = floor => featureUnlocked('cursedItems', floor);
export const uniqueItemsAllowed     = floor => featureUnlocked('uniqueItems', floor);
export const loadoutSwapUnlocked    = floor => featureUnlocked('loadoutSwap', floor);
export const detailedTooltips       = floor => featureUnlocked('detailedTooltips', floor);

// Whether a placed/trap hazard KIND may appear on this floor (terrain lava/spikes
// baked by a theme aren't gated here). Unknown kind ⇒ allowed.
export function hazardAllowed(kind, floor) {
  const intro = HAZARD_INTRO_FLOOR[kind];
  if (intro == null) return true;
  return rampDepth(floor) >= intro;
}

// Foe max-HP multiplier over the opening floors (≥1 = tougher; 1 = plain depth
// curve). Keyed on deepest floor reached, so only a genuinely-early hero sees it.
// Absent past the ramp ⇒ 1.
export function earlyEnemyHp(floor) {
  return EARLY_ENEMY_HP[rampDepth(floor)] || 1;
}

// Hero-damage ramp over the opening floors (≤1 = softer while weak; 1 = full). The
// counterpart to earlyEnemyHp on the hero side — keyed on the CURRENT floor, so it
// shapes each fight as it happens and lifts as the hero descends. Absent ⇒ 1.
export function playerEarlyDamage(floor) {
  return PLAYER_EARLY_DMG[rampDepth(floor)] || 1;
}

// Cap on how many foes an early floor spawns, or null (uncapped) past the ramp.
export function earlyPackCap(floor) {
  const c = EARLY_PACK_CAP[rampDepth(floor)];
  return (c == null) ? null : c;
}

// A first-encounter hint by id — or null if the id is unknown or the hero has
// already been taught it (`taught` is the player.taught flag bag). The caller
// latches the flag after showing it.
export function firstHint(id, taught) {
  const h = HINTS[id];
  if (!h) return null;
  if (taught && taught[id]) return null;
  return Object.assign({ id }, h);
}

// A one-time endgame-keeper intro popup, latched under 'intro_'+kind. null if the
// kind has no intro or it has already been shown.
export function keeperIntro(kind, taught) {
  const info = KEEPER_INTRO[kind];
  if (!info) return null;
  const key = 'intro_' + kind;
  if (taught && taught[key]) return null;
  return Object.assign({ kind, key }, info);
}

// The starter checklist resolved against a context of which steps are done
// (ctx[stepId] truthy ⇒ done). Returns the steps with a done flag, the index of
// the first unfinished step (-1 when finished), and whether the chain is complete.
export function starterChain(ctx) {
  ctx = ctx || {};
  const steps = STARTER_STEPS.map(s => ({ id: s.id, label: s.label, done: !!ctx[s.id] }));
  const activeIndex = steps.findIndex(s => !s.done);
  return { steps, activeIndex, complete: activeIndex === -1 };
}

// A rotating tip by index (wraps in both directions; empty pool ⇒ '').
export function tip(index) {
  const n = TIPS.length;
  if (!n) return '';
  const i = ((Math.floor(index) || 0) % n + n) % n;
  return TIPS[i];
}

// The lesson for a death cause tag, falling back to a rotating tip when the cause
// is unknown or untagged.
export function deathTip(cause, index) {
  if (cause && DEATH_TIPS[cause]) return DEATH_TIPS[cause];
  return tip(index || 0);
}

// A compact snapshot of the ramp state at this depth — surfaced in gameState() so
// an agent (or a curious player) sees exactly what the pacing still has gated.
export function rampStatus(maxFloor) {
  const d = rampDepth(maxFloor);
  return {
    depth: d,
    skillSlots: unlockedSkillSlots(d),
    elites: elitesAllowed(d),
    gearRequirements: gearRequirementsActive(d),
    setItems: setItemsAllowed(d),
    cursedItems: cursedItemsAllowed(d),
    uniqueItems: uniqueItemsAllowed(d),
    loadoutSwap: loadoutSwapUnlocked(d),
    detailedTooltips: detailedTooltips(d),
  };
}
