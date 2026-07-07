// ── THE PANTHEON OF THE DEEP · FIGHT STATE MACHINE ───────────────────────────
// The pure, deterministic brain of a Pantheon encounter. It reads the authored
// phase script on a boss def (src/data/pinnacle.js) and, given the CURRENT boss HP
// fraction and the CURRENT fight clock, decides everything the edge needs to make
// the god actually fight: which phase it is in, which telegraphed attacks to arm
// and when they detonate, when to spawn an add wave, and when the boss enrages.
//
// It owns NO rendering, NO damage, NO spawning — it only emits an ordered `events`
// list describing WHAT should happen this tick. The legacy shell consumes those
// events at the edge: a `telegraph` event feeds bossTelegraphs (the real
// floor-indicator system in src/systems/telegraph.js) so the attack is dodgeable;
// an `addwave` event spawns minions; a `phase` event swaps the boss's look/music;
// an `enrage` event flips the +damage flag. Each event carries a `roll` drawn from
// the injected rng so the edge can place a telegraph / pick a spawn point
// deterministically (seeded ⇒ reproducible ⇒ leaderboard-auditable & unit-testable).
//
// PURE: state + { hpFrac, elapsedSec } + rng + bossDef in → NEW state + events out.
// No DOM, no Math.random, no Date.now — the HP fraction and the seconds-elapsed
// clock are INJECTED by the caller (the world tick), never read here. stepFight
// never mutates the state it is handed; it returns a fresh one.
//
// The model, precisely:
//   • PHASES advance by HP. The boss enters phase i+1 the moment hpFrac ≤
//     phases[i+1].atHpFrac. A single big hit can skip several phases in one step.
//     Entering a phase re-arms that phase's telegraphs and resets its add/enrage
//     timers (each phase's clock is measured from when it was entered).
//   • TELEGRAPHS arm on a WINDUP CADENCE. On entering a phase each telegraph is
//     scheduled to detonate `windupSec` later; after it fires it re-arms `windupSec`
//     later again, so a telegraph on-screen fires repeatedly at its own rhythm — a
//     continuous, readable skill check rather than a one-shot.
//   • ADD WAVES spawn on a fixed cadence: `count` adds every `everySec` seconds the
//     phase has been active.
//   • ENRAGE is a per-phase soft timer: `enrageAtSec` seconds INTO a phase the boss
//     enrages (permanent +damage for that phase) — a DPS check. A fresh phase clears
//     the enraged flag so each phase carries its own timer.

// ── Local guards (kept private; this system has no data/util dependency) ──────────
function num(v, d = 0) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
function clampFrac(v) { const n = num(v, 1); return n < 0 ? 0 : n > 1 ? 1 : n; }
// A telegraph's effective windup — floored so a mis-authored 0 can't spin the
// catch-up loop forever (and so re-arming always advances the clock).
function windup(t) { return Math.max(0.05, num(t && t.windupSec, 0.05)); }

// Arm every telegraph of a phase, scheduling each to first detonate `windupSec`
// after the phase was entered. Returns a fresh array of pending records; each record
// carries the windup so it can re-arm itself on the same cadence after it fires.
function armTelegraphs(phase, atElapsed) {
  const list = (phase && Array.isArray(phase.telegraphs)) ? phase.telegraphs : [];
  return list.map((t) => ({
    id: t && t.id,
    kind: t && t.kind,
    damageMult: num(t && t.damageMult, 1),
    windupSec: windup(t),
    fireAt: atElapsed + windup(t),   // first detonation, one window from now
  }));
}

// Build the initial fight state for a boss def. The hero has just stepped in at full
// HP, so we sit in phase 0 with its telegraphs armed and every timer zeroed. No
// events are produced here — the first stepFight drives the fight forward.
export function initFight(bossDef) {
  const phases = (bossDef && Array.isArray(bossDef.phases)) ? bossDef.phases : [];
  return {
    phaseIndex: 0,
    phaseStartedAt: 0,     // fight-elapsed seconds when the current phase was entered
    elapsed: 0,            // last-seen fight clock
    enraged: false,        // has the CURRENT phase's soft-enrage fired?
    addWavesSpawned: 0,    // add waves spawned so far in the CURRENT phase
    pending: armTelegraphs(phases[0], 0),
  };
}

// The phase object the boss is currently in, or null if the def has no phases.
export function currentPhase(state, bossDef) {
  const phases = (bossDef && Array.isArray(bossDef.phases)) ? bossDef.phases : [];
  const i = state ? num(state.phaseIndex, 0) : 0;
  return phases[i] || null;
}

// The telegraphs currently armed (awaiting their next detonation) — a copy, so a
// caller can read it without risking the live state. Drives the "incoming!" preview.
export function pendingTelegraphs(state) {
  return (state && Array.isArray(state.pending)) ? state.pending.map((t) => ({ ...t })) : [];
}

// Advance the fight one observation. `obs` is the live read from the world tick:
//   { hpFrac: current boss HP as a fraction of max (1 → 0),
//     elapsedSec: seconds since the fight began }
// Returns { state, events }: a FRESH state (the input is never mutated) and the
// ordered list of things that should happen at the edge this tick. Deterministic —
// the same inputs + seeded rng always yield the same events.
export function stepFight(state, obs, rng, bossDef) {
  const phases = (bossDef && Array.isArray(bossDef.phases)) ? bossDef.phases : [];
  const draw = (typeof rng === 'function') ? rng : () => 0;
  const events = [];

  // Clone the incoming state so we never mutate a caller's object.
  const src = state || initFight(bossDef);
  const ns = {
    phaseIndex: num(src.phaseIndex, 0),
    phaseStartedAt: num(src.phaseStartedAt, 0),
    elapsed: num(src.elapsed, 0),
    enraged: !!src.enraged,
    addWavesSpawned: Math.max(0, Math.floor(num(src.addWavesSpawned, 0))),
    pending: Array.isArray(src.pending) ? src.pending.map((t) => ({ ...t })) : [],
  };

  const hp = clampFrac(obs && obs.hpFrac);
  // The clock only moves forward — a stale/garbage reading can't rewind the fight.
  ns.elapsed = Math.max(ns.elapsed, num(obs && obs.elapsedSec, ns.elapsed));

  // ── 1 · PHASE ADVANCEMENT (by HP) ──
  // Enter the next phase the instant the boss is drained to (or past) its entry
  // fraction. A while-loop so one huge hit can cross several thresholds at once.
  let guard = 0;
  while (guard++ < 64
    && ns.phaseIndex + 1 < phases.length
    && typeof phases[ns.phaseIndex + 1].atHpFrac === 'number'
    && hp <= phases[ns.phaseIndex + 1].atHpFrac) {
    ns.phaseIndex += 1;
    ns.phaseStartedAt = ns.elapsed;
    ns.enraged = false;                 // fresh phase ⇒ fresh soft-enrage timer
    ns.addWavesSpawned = 0;             // fresh phase ⇒ add cadence restarts
    ns.pending = armTelegraphs(phases[ns.phaseIndex], ns.elapsed);
    events.push({ type: 'phase', phaseIndex: ns.phaseIndex, phaseId: phases[ns.phaseIndex].id });
  }

  const phase = phases[ns.phaseIndex] || null;

  // ── 2 · TELEGRAPH DETONATIONS (windup cadence) ──
  // Every armed telegraph whose scheduled time has arrived fires; it then re-arms
  // one window later, catching up if the clock jumped by several windows at once.
  const stillPending = [];
  for (const t of ns.pending) {
    let fireAt = num(t.fireAt, ns.elapsed);
    const w = windup(t);
    let inner = 0;
    while (fireAt <= ns.elapsed && inner++ < 256) {
      events.push({
        type: 'telegraph',
        telegraphId: t.id,
        kind: t.kind,
        damageMult: num(t.damageMult, 1),
        fireAt,
        roll: draw(),            // edge uses this to place the indicator
      });
      fireAt += w;               // re-arm on the same rhythm
    }
    stillPending.push({ ...t, fireAt });
  }
  ns.pending = stillPending;

  // ── 3 · ADD WAVES (fixed cadence) ──
  // Spawn `count` adds every `everySec` seconds the CURRENT phase has been active.
  if (phase && phase.addWave) {
    const every = num(phase.addWave.everySec, 0);
    const count = Math.max(0, Math.floor(num(phase.addWave.count, 0)));
    if (every > 0 && count > 0) {
      let waveGuard = 0;
      while (waveGuard++ < 256
        && (ns.phaseStartedAt + (ns.addWavesSpawned + 1) * every) <= ns.elapsed) {
        ns.addWavesSpawned += 1;
        events.push({
          type: 'addwave',
          count,
          waveNumber: ns.addWavesSpawned,
          phaseIndex: ns.phaseIndex,
          roll: draw(),           // edge uses this to pick spawn points
        });
      }
    }
  }

  // ── 4 · ENRAGE (per-phase soft timer) ──
  if (phase && !ns.enraged) {
    const enrageAt = num(phase.enrageAtSec, 0);
    if (enrageAt > 0 && (ns.elapsed - ns.phaseStartedAt) >= enrageAt) {
      ns.enraged = true;
      events.push({ type: 'enrage', phaseIndex: ns.phaseIndex, phaseId: phase.id });
    }
  }

  return { state: ns, events };
}
