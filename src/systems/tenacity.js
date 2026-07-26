// Pure crowd-control resistance math for tenacious foes (bosses, elites). Numbers
// in, numbers out — no globals, no clock. The caller (legacy applyStatusEffect)
// reads the diminishing-returns state off the foe, passes the current world-beat
// count as the clock, and stores the returned state back. Tuning lives in
// src/data/tenacity.js.

import { HARD_CC, TENACITY } from '../data/tenacity.js';

// The tenacity profile key for a foe: 'boss', 'elite', or null (ordinary foes,
// which are unaffected). A boss takes precedence over the elite flag.
export function tenacityTier(enemy) {
  if (!enemy) return null;
  if (enemy.isBoss) return 'boss';
  if (enemy.isElite) return 'elite';
  return null;
}

// Resolve an incoming crowd-control effect on a tenacious foe.
//   tier      'boss' | 'elite' (a null tier means the caller should skip this)
//   dr        { stacks, until } — the foe's diminishing-returns state (until in beats)
//   effect    the CC being applied ('stun', 'freeze', 'slow', 'chill')
//   secs      the effect's listed duration in real seconds
//   nowBeats  the current world-beat serial (the clock)
//   beatSecs  real seconds per world beat (to convert the window to beats)
// Returns { secs, dr:{stacks,until}, immune }. On a shrug, secs is 0 and immune true.
export function resolveEnemyCC(tier, dr, effect, secs, nowBeats, beatSecs) {
  const prof = TENACITY[tier];
  // No profile, or a soft CC (slow/chill): pass through untouched.
  if (!prof || !HARD_CC.has(effect)) return { secs, dr, immune: false };

  // A long-enough gap since the last hard CC resets the ladder to the first step.
  const stacks = (nowBeats >= (dr.until || 0)) ? 0 : (dr.stacks || 0);
  const steps = prof.drSteps;
  const factor = stacks < steps.length ? steps[stacks] : 0;
  // The window is measured from THIS application, so continued stun-spam keeps the
  // immunity in force until the foe is finally left alone for windowSecs.
  const until = nowBeats + Math.max(1, Math.round(prof.windowSecs / beatSecs));
  const nextDr = { stacks: stacks + 1, until };

  const cut = secs * (1 - prof.tenac) * factor;
  if (factor <= 0 || cut < prof.floorSecs) {
    return { secs: 0, dr: nextDr, immune: true };
  }
  return { secs: cut, dr: nextDr, immune: false };
}

// Is a tenacious foe currently in its post-diminishing-returns immunity window —
// i.e. would the next hard CC be shrugged off outright? Lets a reader (the AI-play
// gameState snapshot) save a stun instead of wasting it. Pure: same DR state and
// clock the resolver uses.
export function enemyStunImmune(tier, dr, nowBeats) {
  const prof = TENACITY[tier];
  if (!prof) return false;
  if (nowBeats >= (dr.until || 0)) return false;   // window lapsed → ladder reset
  return (dr.stacks || 0) >= prof.drSteps.length;
}
