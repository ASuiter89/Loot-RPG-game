// THE RENOWN LADDER — pure rank/reward math over the account's lifetime renown total
// (summed from completed deeds by systems/deeds.evaluateDeeds). No globals, no DOM,
// no RNG, no clock. Mirrors the earned-vs-available flavour of systems/bossSlots: a
// number in, a plain progress/reward object out, defensive against garbage so a
// corrupt save can never throw.
//
// The RENOWN_TRACK ranks are authored strictly ascending by cumulative
// `renownNeeded` (a data test enforces it). We DON'T trust that at runtime — every
// function re-sorts a defensive copy so a hand-edited track still reads sanely.
import { RENOWN_TRACK } from '../data/renownTrack.js';

// Coerce a stored renown total to a clean non-negative integer (a corrupt/NaN save
// reads as 0 — the opening rank — never a crash).
function cleanRenown(renown) {
  const n = Number(renown);
  return (isFinite(n) && n > 0) ? Math.floor(n) : 0;
}

// A defensive, ascending-by-threshold copy of the track's ranks, dropping any entry
// without a finite non-negative threshold. Empty ⇒ [] so callers degrade to "no
// ranks" instead of throwing.
function sortedRanks(track) {
  const raw = (track && Array.isArray(track.ranks)) ? track.ranks : [];
  return raw
    .filter((r) => r && isFinite(Number(r.renownNeeded)) && Number(r.renownNeeded) >= 0)
    .slice()
    .sort((a, b) => Number(a.renownNeeded) - Number(b.renownNeeded));
}

// Where a renown total sits on the ladder:
//   rank          — the highest rank whose threshold is met (0 if below every rank)
//   nextThreshold — cumulative renown for the NEXT rank, or null once maxed
//   into          — renown earned since the current rank's threshold
//   span          — renown from the current rank's threshold to the next (0 if maxed)
//   pct           — 0..1 progress across THIS rank band (1 when maxed)
// Same shape philosophy as bossSlots.pointsAvailable: always a well-formed object.
export function renownRank(renown, track = RENOWN_TRACK) {
  const r = cleanRenown(renown);
  const ranks = sortedRanks(track);
  if (!ranks.length) return { rank: 0, nextThreshold: null, into: 0, span: 0, pct: 0 };

  // Walk up while we still clear the next threshold; `curr` is the highest met rank.
  let curr = null;
  let next = null;
  for (let i = 0; i < ranks.length; i++) {
    if (r >= Number(ranks[i].renownNeeded)) {
      curr = ranks[i];
    } else {
      next = ranks[i];
      break;
    }
  }

  // Below even the first rank (only possible if rank 1's threshold > 0).
  if (!curr) {
    const firstNeed = Number(ranks[0].renownNeeded);
    return {
      rank: 0,
      nextThreshold: firstNeed,
      into: r,
      span: firstNeed,
      pct: firstNeed > 0 ? Math.max(0, Math.min(1, r / firstNeed)) : 1,
    };
  }

  const currNeed = Number(curr.renownNeeded);
  // Maxed out — sitting on the final rank, nothing further to earn toward.
  if (!next) {
    return { rank: curr.rank, nextThreshold: null, into: r - currNeed, span: 0, pct: 1 };
  }

  const nextNeed = Number(next.renownNeeded);
  const span = nextNeed - currNeed;
  const into = r - currNeed;
  return {
    rank: curr.rank,
    nextThreshold: nextNeed,
    into,
    span,
    pct: span > 0 ? Math.max(0, Math.min(1, into / span)) : 1,
  };
}

// Every reward already EARNED at this renown total — the rewards of all ranks whose
// threshold is met, in ascending rank order. Drives the "claimed / unlocked" list.
// (Filters out rank entries with no reward object so a malformed rank is skipped.)
export function unlockedRewards(renown, track = RENOWN_TRACK) {
  const r = cleanRenown(renown);
  return sortedRanks(track)
    .filter((rk) => r >= Number(rk.renownNeeded) && rk.reward)
    .map((rk) => rk.reward);
}

// The next reward still to earn — the reward of the lowest rank NOT yet met — or null
// once every rank is unlocked. Powers the "next up" teaser in the Hall.
export function nextReward(renown, track = RENOWN_TRACK) {
  const r = cleanRenown(renown);
  const upcoming = sortedRanks(track).find((rk) => r < Number(rk.renownNeeded));
  return upcoming ? (upcoming.reward || null) : null;
}
