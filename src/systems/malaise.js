// Malaise — the session-clock "hurry up" ramp for the tempo covenants (Haste,
// Relentless). While a malaise covenant is sworn, enemies grow steadily stronger the
// longer the hero lingers on a floor, so dawdling is punished: the pressure ramps in
// discrete steps, then plateaus at a cap so it stays a nudge to descend, never an
// unwinnable spiral. The shell feeds in the real elapsed floor time; this module is
// pure over that injected number (no clock, no Date.now, no globals).
import { COVENANTS } from '../data/covenants.js';

// Default step/cap for the ramp. A "step" is how often the ramp ticks up (seconds);
// `cap` bounds the total bonus so even an eternity on one floor tops out at +60%.
const MALAISE_CFG = { step: 30, cap: 0.60 };

function num(v, fallback) {
  return (typeof v === 'number' && isFinite(v)) ? v : fallback;
}

// Resolve the active id list to the covenant defs it names (dedup, drop unknowns).
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

// The enemy-strength multiplier from malaise at this many seconds on the floor:
//   1 + min(cap, rate · floor(elapsedSec / step))
// Stepwise (constant between step boundaries), monotonic non-decreasing, and flat once
// it hits the cap. rate<=0 or elapsed<step ⇒ ×1 (no-op). Negative/NaN inputs clamp to
// a safe no-op, never throwing.
export function malaiseMult(elapsedSec, rate, cfg = MALAISE_CFG) {
  const c = cfg || MALAISE_CFG;
  const step = Math.max(1, num(c.step, MALAISE_CFG.step));   // guard divide-by-zero
  const cap = Math.max(0, num(c.cap, MALAISE_CFG.cap));
  const r = Math.max(0, num(rate, 0));
  const t = Math.max(0, num(elapsedSec, 0));
  const steps = Math.floor(t / step);
  return 1 + Math.min(cap, r * steps);
}

// Does the active set include ANY covenant that ramps with the session clock? Lets the
// shell skip the whole malaise path (and its HUD warning) when no tempo curse is sworn.
export function malaiseActive(activeIds, data = COVENANTS) {
  return resolveActive(activeIds, data).some((c) => num(c.params && c.params.malaiseRate, 0) > 0);
}

// The combined per-step ramp rate of all active tempo covenants (they SUM, matching
// covenantMultipliers). Feed this as `rate` into malaiseMult. 0 when none are active.
export function combinedMalaiseRate(activeIds, data = COVENANTS) {
  return resolveActive(activeIds, data)
    .reduce((sum, c) => sum + Math.max(0, num(c.params && c.params.malaiseRate, 0)), 0);
}
