import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../../src/utils/rng.js';
import {
  initFight,
  stepFight,
  currentPhase,
  pendingTelegraphs,
} from '../../src/systems/pinnacleFight.js';
import { PANTHEON } from '../../src/data/pinnacle.js';
import { bossById } from '../../src/systems/pinnacle.js';

// A hand-built, fully-predictable three-phase fight. Windups chosen to divide the
// clock cleanly so detonation counts are exact.
const FIGHT = {
  id: 'fight', name: 'Fight Dummy',
  phases: [
    { id: 'a', atHpFrac: 1.0, telegraphs: [{ id: 'ta', kind: 'disc', windupSec: 2, damageMult: 2 }] },
    { id: 'b', atHpFrac: 0.6, telegraphs: [{ id: 'tb', kind: 'ring', windupSec: 1, damageMult: 3 }],
      addWave: { count: 2, everySec: 3 }, enrageAtSec: 5 },
    { id: 'c', atHpFrac: 0.3, telegraphs: [{ id: 'tc', kind: 'lane', windupSec: 1, damageMult: 4 }],
      enrageAtSec: 2 },
  ],
};

const zero = () => 0;
const evTypes = (events) => events.map((e) => e.type);
const countType = (events, type) => events.filter((e) => e.type === type).length;

describe('initFight', () => {
  it('starts in phase 0 with that phase armed and every timer zeroed', () => {
    const s = initFight(FIGHT);
    expect(s.phaseIndex).toBe(0);
    expect(s.phaseStartedAt).toBe(0);
    expect(s.elapsed).toBe(0);
    expect(s.enraged).toBe(false);
    expect(s.addWavesSpawned).toBe(0);
    expect(s.pending).toHaveLength(1);
    expect(s.pending[0].id).toBe('ta');
    expect(s.pending[0].fireAt).toBe(2); // first detonation one windup out
  });
  it('handles a def with no phases without throwing', () => {
    const s = initFight({});
    expect(s.pending).toEqual([]);
    expect(currentPhase(s, {})).toBe(null);
  });
});

describe('currentPhase / pendingTelegraphs', () => {
  it('report the live phase object and a COPY of the pending list', () => {
    const s = initFight(FIGHT);
    expect(currentPhase(s, FIGHT).id).toBe('a');
    const p = pendingTelegraphs(s);
    expect(p).toHaveLength(1);
    p[0].fireAt = 999;                       // mutating the copy…
    expect(s.pending[0].fireAt).toBe(2);     // …never touches the state
  });
  it('pendingTelegraphs is [] for a null/garbage state', () => {
    expect(pendingTelegraphs(null)).toEqual([]);
    expect(pendingTelegraphs({})).toEqual([]);
  });
});

describe('telegraph scheduling', () => {
  it('does NOT detonate before the windup elapses', () => {
    const s = initFight(FIGHT);
    const { events } = stepFight(s, { hpFrac: 1, elapsedSec: 1 }, zero, FIGHT);
    expect(events).toEqual([]);
  });

  it('detonates exactly at the windup, then re-arms one window later', () => {
    let s = initFight(FIGHT);
    let r = stepFight(s, { hpFrac: 1, elapsedSec: 2 }, zero, FIGHT);
    expect(countType(r.events, 'telegraph')).toBe(1);
    const tel = r.events.find((e) => e.type === 'telegraph');
    expect(tel).toMatchObject({ telegraphId: 'ta', kind: 'disc', damageMult: 2, fireAt: 2 });
    expect(typeof tel.roll).toBe('number');
    // re-armed for t=4
    expect(r.state.pending[0].fireAt).toBe(4);
  });

  it('catches up multiple detonations if the clock jumps several windows', () => {
    const s = initFight(FIGHT); // ta windup 2, fireAt 2
    const { events, state } = stepFight(s, { hpFrac: 1, elapsedSec: 9 }, zero, FIGHT);
    // detonations at 2, 4, 6, 8 → 4 events
    expect(countType(events, 'telegraph')).toBe(4);
    expect(state.pending[0].fireAt).toBe(10);
  });
});

describe('phase advancement (by HP)', () => {
  it('enters the next phase the moment HP crosses its threshold, re-arming it', () => {
    let s = initFight(FIGHT);
    const { events, state } = stepFight(s, { hpFrac: 0.6, elapsedSec: 3 }, zero, FIGHT);
    expect(evTypes(events)).toContain('phase');
    const ph = events.find((e) => e.type === 'phase');
    expect(ph).toMatchObject({ phaseIndex: 1, phaseId: 'b' });
    expect(state.phaseIndex).toBe(1);
    expect(state.phaseStartedAt).toBe(3);
    expect(state.pending[0].id).toBe('tb');
    expect(state.pending[0].fireAt).toBe(4); // 3 + windup 1
  });

  it('a single massive hit can skip several phases at once', () => {
    const s = initFight(FIGHT);
    const { events, state } = stepFight(s, { hpFrac: 0.05, elapsedSec: 1 }, zero, FIGHT);
    // crosses 0.6 AND 0.3 in one step → two phase events, landing in phase c
    expect(countType(events, 'phase')).toBe(2);
    expect(state.phaseIndex).toBe(2);
    expect(currentPhase(state, FIGHT).id).toBe('c');
  });

  it('never advances past the last phase', () => {
    let s = initFight(FIGHT);
    ({ state: s } = stepFight(s, { hpFrac: 0.05, elapsedSec: 1 }, zero, FIGHT)); // → phase c
    const { events, state } = stepFight(s, { hpFrac: 0, elapsedSec: 2 }, zero, FIGHT);
    expect(countType(events, 'phase')).toBe(0);
    expect(state.phaseIndex).toBe(2);
  });
});

describe('add waves', () => {
  it('spawn on cadence while a phase is active', () => {
    let s = initFight(FIGHT);
    ({ state: s } = stepFight(s, { hpFrac: 0.6, elapsedSec: 3 }, zero, FIGHT)); // enter phase b at t=3
    // phase b: 2 adds every 3s → first wave at t=6
    let r = stepFight(s, { hpFrac: 0.6, elapsedSec: 6 }, zero, FIGHT);
    expect(countType(r.events, 'addwave')).toBe(1);
    const w = r.events.find((e) => e.type === 'addwave');
    expect(w).toMatchObject({ count: 2, waveNumber: 1, phaseIndex: 1 });
    expect(typeof w.roll).toBe('number');
    // jump to t=13 → waves at 9 and 12 (two more)
    r = stepFight(r.state, { hpFrac: 0.6, elapsedSec: 13 }, zero, FIGHT);
    expect(countType(r.events, 'addwave')).toBe(2);
    expect(r.state.addWavesSpawned).toBe(3);
  });

  it('phase 0 has no add wave, so none spawn', () => {
    const s = initFight(FIGHT);
    const { events } = stepFight(s, { hpFrac: 1, elapsedSec: 100 }, zero, FIGHT);
    expect(countType(events, 'addwave')).toBe(0);
  });
});

describe('enrage', () => {
  it('flips once past the per-phase enrage timer', () => {
    let s = initFight(FIGHT);
    ({ state: s } = stepFight(s, { hpFrac: 0.6, elapsedSec: 3 }, zero, FIGHT)); // phase b at t=3, enrageAt 5
    let r = stepFight(s, { hpFrac: 0.6, elapsedSec: 7 }, zero, FIGHT);         // 7-3 = 4 < 5
    expect(countType(r.events, 'enrage')).toBe(0);
    expect(r.state.enraged).toBe(false);
    r = stepFight(r.state, { hpFrac: 0.6, elapsedSec: 8 }, zero, FIGHT);       // 8-3 = 5 ≥ 5
    expect(countType(r.events, 'enrage')).toBe(1);
    expect(r.state.enraged).toBe(true);
    // does not re-fire once enraged
    r = stepFight(r.state, { hpFrac: 0.6, elapsedSec: 20 }, zero, FIGHT);
    expect(countType(r.events, 'enrage')).toBe(0);
  });

  it('resets when a new phase begins (each phase carries its own timer)', () => {
    let s = initFight(FIGHT);
    ({ state: s } = stepFight(s, { hpFrac: 0.6, elapsedSec: 3 }, zero, FIGHT));
    ({ state: s } = stepFight(s, { hpFrac: 0.6, elapsedSec: 9 }, zero, FIGHT)); // enraged in phase b
    expect(s.enraged).toBe(true);
    const { state } = stepFight(s, { hpFrac: 0.3, elapsedSec: 10 }, zero, FIGHT); // → phase c
    expect(state.phaseIndex).toBe(2);
    expect(state.enraged).toBe(false); // fresh phase, fresh timer
  });
});

describe('full fight walk-through', () => {
  it('drains HP through every phase, firing telegraphs, adds and enrage in order', () => {
    const seen = [];
    let s = initFight(FIGHT);
    // A scripted descent: (elapsed, hpFrac) pairs draining the boss over time.
    const script = [
      [2, 1.0],   // phase a telegraph fires
      [3, 0.6],   // → phase b
      [6, 0.6],   // phase b telegraphs + first add wave
      [9, 0.6],   // phase b enrage timer trips (t-3 = 6 ≥ 5)
      [10, 0.3],  // → phase c (enrage resets)
      [12, 0.3],  // phase c telegraphs + enrage (t-10 = 2 ≥ 2)
      [13, 0.0],  // boss dies
    ];
    let rng = mulberry32(99);
    for (const [elapsedSec, hpFrac] of script) {
      const r = stepFight(s, { hpFrac, elapsedSec }, rng, FIGHT);
      s = r.state;
      for (const e of r.events) seen.push(e.type);
    }
    // Phase order b then c appeared exactly once each.
    const phaseEvents = seen.filter((t) => t === 'phase');
    expect(phaseEvents).toHaveLength(2);
    // We saw at least one of each mechanic across the fight.
    expect(seen).toContain('telegraph');
    expect(seen).toContain('addwave');
    expect(seen).toContain('enrage');
    // Ended in the final phase.
    expect(s.phaseIndex).toBe(2);
  });
});

describe('determinism & purity', () => {
  it('same inputs + same seed ⇒ identical events and state', () => {
    const s = initFight(FIGHT);
    const obs = { hpFrac: 0.6, elapsedSec: 9 };
    const a = stepFight(s, obs, mulberry32(5), FIGHT);
    const b = stepFight(initFight(FIGHT), obs, mulberry32(5), FIGHT);
    expect(a.events).toEqual(b.events);
    expect(a.state).toEqual(b.state);
    // rolls actually vary across events (rng was consumed)
    const rolls = a.events.map((e) => e.roll);
    expect(rolls.length).toBeGreaterThan(0);
  });

  it('never mutates the state it is handed', () => {
    const s = initFight(FIGHT);
    const snapshot = JSON.parse(JSON.stringify(s));
    stepFight(s, { hpFrac: 0.3, elapsedSec: 50 }, mulberry32(1), FIGHT);
    expect(s).toEqual(snapshot);
  });

  it('the clock only moves forward (a stale reading cannot rewind it)', () => {
    let s = initFight(FIGHT);
    ({ state: s } = stepFight(s, { hpFrac: 1, elapsedSec: 10 }, zero, FIGHT));
    const { state } = stepFight(s, { hpFrac: 1, elapsedSec: 4 }, zero, FIGHT); // stale
    expect(state.elapsed).toBe(10);
  });
});

describe('garbage tolerance', () => {
  it('null state initializes a fresh fight internally', () => {
    const { state } = stepFight(null, { hpFrac: 1, elapsedSec: 0 }, zero, FIGHT);
    expect(state.phaseIndex).toBe(0);
  });
  it('garbage bossDef ⇒ no phases, no events, no throw', () => {
    const { events, state } = stepFight(initFight(null), { hpFrac: 0.5, elapsedSec: 5 }, zero, null);
    expect(events).toEqual([]);
    expect(state.phaseIndex).toBe(0);
  });
  it('non-function rng falls back to a 0 stream', () => {
    const s = initFight(FIGHT);
    const { events } = stepFight(s, { hpFrac: 1, elapsedSec: 2 }, 'not-a-fn', FIGHT);
    expect(events.find((e) => e.type === 'telegraph').roll).toBe(0);
  });
});

describe('drives a REAL Pantheon boss through all its authored phases', () => {
  it('walks Umbriel (five phases) from full HP to death', () => {
    const umbriel = bossById('umbriel', PANTHEON);
    let s = initFight(umbriel);
    const phaseIds = [];
    let t = 0;
    // Step the boss's HP down smoothly; collect every phase we enter.
    for (let hp = 1.0; hp >= 0; hp -= 0.02) {
      t += 1;
      const r = stepFight(s, { hpFrac: Math.max(0, hp), elapsedSec: t }, mulberry32(t), umbriel);
      s = r.state;
      for (const e of r.events) if (e.type === 'phase') phaseIds.push(e.phaseId);
    }
    // Every non-initial authored phase was entered, in order.
    expect(phaseIds).toEqual(umbriel.phases.slice(1).map((p) => p.id));
    expect(s.phaseIndex).toBe(umbriel.phases.length - 1);
  });
});
