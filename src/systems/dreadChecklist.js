// Dread checklist — the per-class, per-boss "how hard did you beat it" grid math.
// Pure functions over a plain nested object; the shell persists the grid on the
// account and calls recordBossClear when a boss dies during a Dread run.
//
// Grid shape:  { [classId]: { [bossId]: highestDreadCleared } }
// i.e. for each class the hero has played, the single highest total Dread that each
// boss was ever beaten at. A boss never beaten under Dread simply has no entry (0).
//
// All functions are pure and NON-mutating (recordBossClear returns a NEW grid), so the
// shell can diff, snapshot and undo freely. Everything tolerates garbage input.
import { MARK_MILESTONES } from '../data/dreadRewards.js';

// A finite, non-negative number or 0 — the only kind of value a rung ever holds.
function rung(v) {
  return (typeof v === 'number' && isFinite(v) && v > 0) ? v : 0;
}

// A fresh, empty grid.
export function emptyGrid() {
  return {};
}

// Record a boss clear at `dread`, returning a NEW grid whose [cls][bossId] rung is the
// MAX of the previous rung and this run's Dread (you never lose credit for a harder
// past clear by later clearing it easy). Missing cls/bossId, or a dread that isn't a
// positive number, return the grid effectively unchanged (a defensive shallow copy).
export function recordBossClear(grid, cls, bossId, dread) {
  const g = sanitizeGrid(grid);
  const c = cls != null && String(cls);
  const b = bossId != null && String(bossId);
  const d = rung(dread);
  if (!c || !b || d <= 0) return g;
  const row = { ...(g[c] || {}) };
  row[b] = Math.max(rung(row[b]), d);
  g[c] = row;
  return g;
}

// The highest Dread `bossId` was ever beaten at, for class `cls` (0 if never).
export function highestRung(grid, cls, bossId) {
  if (!grid || typeof grid !== 'object') return 0;
  const row = grid[cls != null && String(cls)];
  if (!row || typeof row !== 'object') return 0;
  return rung(row[bossId != null && String(bossId)]);
}

// How many of `bossIds` this class has beaten at ALL (any Dread > 0). `bossIds` is the
// canonical roster the shell knows; only ids in it count, so a stale grid entry for a
// removed boss never inflates the tally.
export function classCleared(grid, cls, bossIds) {
  const ids = Array.isArray(bossIds) ? bossIds : [];
  let n = 0;
  for (const b of ids) if (highestRung(grid, cls, b) > 0) n++;
  return n;
}

// Progress summary for one class against the canonical roster: how many bosses beaten,
// the roster size, and the single best Dread reached on any of them.
export function classProgress(grid, cls, bossIds) {
  const ids = Array.isArray(bossIds) ? bossIds : [];
  let cleared = 0;
  let bestDread = 0;
  for (const b of ids) {
    const r = highestRung(grid, cls, b);
    if (r > 0) cleared++;
    if (r > bestDread) bestDread = r;
  }
  return { cleared, total: ids.length, bestDread };
}

// Flatten every rung in the grid to a single list of Dread values — the raw material
// the milestone evaluator judges (each value is one (class,boss) clear record).
function allRungs(grid) {
  const out = [];
  if (!grid || typeof grid !== 'object') return out;
  for (const cls in grid) {
    const row = grid[cls];
    if (!row || typeof row !== 'object') continue;
    for (const b in row) {
      const r = rung(row[b]);
      if (r > 0) out.push(r);
    }
  }
  return out;
}

// Is one milestone satisfied by the grid's clear records? Judged by scope:
//   'any'   — the single best record anywhere is >= dread.
//   'count' — at least `need` distinct records are each >= dread.
//   'every' — there are at least `need` records AND every record is >= dread
//             (mastery: nothing left behind below the bar).
// An unknown scope is treated as 'any'. Pure over the grid alone (no roster needed).
function milestoneMet(rungs, m) {
  if (!m || typeof m !== 'object') return false;
  const need = Math.max(1, Math.floor(rung(m.need) || 1));
  const bar = Math.max(0, (typeof m.dread === 'number' && isFinite(m.dread)) ? m.dread : 0);
  const atOrAbove = rungs.filter((r) => r >= bar);
  switch (m.scope) {
    case 'count':
      return atOrAbove.length >= need;
    case 'every':
      return rungs.length >= need && atOrAbove.length === rungs.length;
    case 'any':
    default:
      return atOrAbove.length >= 1;
  }
}

// How many completion marks the account has earned — the count that unlocks higher
// covenants (vs their unlockOrder). Counts milestones satisfied by the grid's records.
export function marksEarned(grid, milestones = MARK_MILESTONES) {
  const list = Array.isArray(milestones) ? milestones : MARK_MILESTONES;
  const rungs = allRungs(grid);
  let n = 0;
  for (const m of list) if (milestoneMet(rungs, m)) n++;
  return n;
}

// Normalize a loaded grid blob to a clean { [classId]: { [bossId]: number>0 } }.
// Drops non-object rows, non-positive/NaN rungs and re-stringifies keys, so an old or
// corrupt save loads as a valid (possibly emptier) grid.
export function sanitizeGrid(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const cls in raw) {
    const row = raw[cls];
    if (!row || typeof row !== 'object') continue;
    const clean = {};
    for (const b in row) {
      const r = rung(row[b]);
      if (r > 0) clean[b] = r;
    }
    if (Object.keys(clean).length) out[String(cls)] = clean;
  }
  return out;
}
