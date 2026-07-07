// Cycles core — pure logic for the seasonal ladder ("Cycles & the Legacy Realm").
//
// Everything here is a pure function over PLAIN VALUES plus an INJECTED clock: the
// current time is always passed in as `nowMs` (milliseconds since the Unix epoch,
// exactly like Date.now() returns) and NEVER read from the environment. Parsing a
// cycle's ISO window strings with Date.parse is allowed — that's parsing a passed-in
// string, not reading the clock — so the module stays deterministic and unit-testable:
// a test picks a fixed nowMs to land inside, before, or after any season window.
//
// The legacy shell (src/legacy/game.js) owns the live seasonal character and its
// running totals; this module only answers "which cycle is live?", "how is the
// Journey going?", and "what did I earn?". Journey progress reuses the same delta
// model as bounties (src/systems/bounty.js): a fresh seasonal character starts every
// counter at 0, so "progress since season start" is simply the live total.
import { CYCLES } from '../data/cycles.js';

// Parse one ISO window bound to epoch-ms, or NaN if it's missing/garbage. Kept
// internal — callers get clean booleans/numbers, never a raw NaN.
function ms(iso) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? NaN : t;
}

// Coerce an injected nowMs to a finite number. Garbage (undefined/null/NaN) collapses
// to 0 (the epoch), which sits before every real season ⇒ a clean 'pre' on the first
// upcoming cycle rather than a throw.
function clockOf(nowMs) {
  const t = Number(nowMs);
  return Number.isFinite(t) ? t : 0;
}

// Look up a cycle by id in the registry (defaults to the shipped CYCLES). Returns the
// cycle object or null. A missing/garbage id or table never throws.
export function cycleById(id, table = CYCLES) {
  if (!id) return null;
  const list = Array.isArray(table) ? table : [];
  for (const c of list) {
    if (c && c.id === id) return c;
  }
  return null;
}

// Is this specific cycle live at nowMs? True when start ≤ now < end (start inclusive,
// end exclusive, so a season and its successor never both claim the same instant). A
// null cycle or an unparseable window ⇒ false.
export function isCycleLive(cycle, nowMs) {
  if (!cycle) return false;
  const start = ms(cycle.startISO);
  const end = ms(cycle.endISO);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  const t = clockOf(nowMs);
  return t >= start && t < end;
}

// The headline answer the HUD needs: which cycle matters right now, how long until the
// clock ticks over, and what phase we're in.
//
//   phase 'live'  — a season is running now. `cycle` is it; `countdownMs` = ms until it
//                   ENDS (the season timer).
//   phase 'pre'   — no season is live but at least one is still upcoming (this also
//                   covers a GAP between two seasons). `cycle` is the NEXT one to open;
//                   `countdownMs` = ms until it BEGINS.
//   phase 'ended' — now is past every season in the registry. `cycle` is the most
//                   recently-closed season (or null if the table is empty);
//                   `countdownMs` = 0 (nothing left to count down to).
//
// Deterministic given nowMs. Never throws on a malformed table/row — rows with an
// unparseable window are simply skipped.
export function activeCycle(nowMs, table = CYCLES) {
  const t = clockOf(nowMs);
  const list = Array.isArray(table) ? table : [];

  let live = null;
  let nextUpcoming = null;   // soonest-starting cycle strictly in the future
  let lastEnded = null;      // latest-ending cycle already fully past

  for (const c of list) {
    if (!c) continue;
    const start = ms(c.startISO);
    const end = ms(c.endISO);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;

    if (t >= start && t < end) {
      // First live window wins (windows shouldn't overlap; if they do we take the
      // earliest in registry order for a stable answer).
      if (!live) live = { c, start, end };
    } else if (start > t) {
      if (!nextUpcoming || start < nextUpcoming.start) nextUpcoming = { c, start, end };
    } else if (end <= t) {
      if (!lastEnded || end > lastEnded.end) lastEnded = { c, start, end };
    }
  }

  if (live) {
    return { cycle: live.c, countdownMs: Math.max(0, live.end - t), phase: 'live' };
  }
  if (nextUpcoming) {
    return { cycle: nextUpcoming.c, countdownMs: Math.max(0, nextUpcoming.start - t), phase: 'pre' };
  }
  return { cycle: lastEnded ? lastEnded.c : null, countdownMs: 0, phase: 'ended' };
}

// The live value of one Journey step's counter from the totals snapshot. Mirrors the
// bounty kind→counter mapping (src/systems/bounty.js) since a fresh seasonal character
// starts every counter at 0 — so the "delta since accept" a bounty measures is just the
// running total here. A 'custom' step reads totals[step.field] (its named counter).
// Everything is clamped to a non-negative number so a missing/garbage total reads 0.
function stepHave(step, totals) {
  const t = totals || {};
  const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? Math.max(0, x) : 0;
  };
  switch (step && step.kind) {
    case 'slay':   return n(t.kills);
    case 'delve':  return n(t.maxFloor);
    case 'clear':  return n(t.clearedFloors);
    case 'boss':   return n(t.bossKills);
    case 'elite':  return n(t.eliteKills);
    case 'gold':   return n(t.goldEarned);
    case 'custom': return step.field ? n(t[step.field]) : 0;
    default:       return 0;
  }
}

// Full Journey progress for a totals snapshot: one row per milestone, in registry
// order, as { id, have, need, done }. `have` is the live counter, `need` is the target,
// `done` is have ≥ need. A null cycle or missing journey ⇒ []. Steps missing a numeric
// `need` are treated as need 0 (already done) so a data typo can't strand the journey.
//
// totalsSnapshot shape (mirrors the bounty snapshot):
//   { kills, maxFloor, clearedFloors, bossKills, eliteKills, goldEarned, …customFields }
export function cycleJourneyProgress(totalsSnapshot, cycle) {
  if (!cycle || !Array.isArray(cycle.journey)) return [];
  return cycle.journey.map((step) => {
    const have = stepHave(step, totalsSnapshot);
    const needRaw = Number(step && step.need);
    const need = Number.isFinite(needRaw) ? Math.max(0, needRaw) : 0;
    return { id: step && step.id, have, need, done: have >= need };
  });
}

// Is the WHOLE Journey finished? True when the cycle has at least one milestone and
// every one is done. An empty/absent journey ⇒ false (nothing to complete). Accepts the
// same (totalsSnapshot, cycle) inputs as the progress helper.
export function cycleJourneyComplete(totalsSnapshot, cycle) {
  const progress = cycleJourneyProgress(totalsSnapshot, cycle);
  if (!progress.length) return false;
  return progress.every((p) => p.done);
}

// The rewards actually EARNED so far — one entry per COMPLETED milestone, as
// { id, reward } — so the shell can grant them and mark them claimed. Takes the progress
// array (from cycleJourneyProgress) and the cycle it was computed against, matching each
// done row back to its journey step's reward. A null progress/cycle ⇒ []. Only rows that
// map to a real step with a reward are included.
export function cycleRewardsEarned(progress, cycle) {
  if (!Array.isArray(progress) || !cycle || !Array.isArray(cycle.journey)) return [];
  const byId = new Map();
  for (const step of cycle.journey) {
    if (step && step.id) byId.set(step.id, step);
  }
  const out = [];
  for (const row of progress) {
    if (!row || !row.done) continue;
    const step = byId.get(row.id);
    if (step && step.reward) out.push({ id: step.id, reward: step.reward });
  }
  return out;
}

// Resolve a hero's FINAL leaderboard rank into the most prestigious reward tier they
// qualify for at season end. `rank` is 1-based (rank 1 = top of the board). Returns the
// matching { rank, reward } tier (the one with the smallest cutoff the hero still meets)
// or null if they placed outside every tier (or the cycle has none). Rank ≤ tier.rank
// earns it. A non-positive / garbage rank earns nothing.
export function cycleRankReward(rank, cycle) {
  const r = Number(rank);
  if (!cycle || !Array.isArray(cycle.rewardTiers) || !Number.isFinite(r) || r < 1) return null;
  let best = null; // smallest cutoff the hero still qualifies for = most prestigious
  for (const tier of cycle.rewardTiers) {
    if (!tier || !Number.isFinite(Number(tier.rank))) continue;
    const cutoff = Number(tier.rank);
    if (r <= cutoff && (best === null || cutoff < Number(best.rank))) best = tier;
  }
  return best;
}
