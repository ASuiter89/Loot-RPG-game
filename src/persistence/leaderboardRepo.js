// Leaderboard persistence — the repository seam for the Supabase leaderboard.
//
// All Supabase REST details (endpoint, headers, paging, on_conflict) live here,
// behind an INJECTED `fetch`, so game logic never talks to Supabase directly and
// tests mock the backend by passing a fake fetch (see docs/DECISIONS.md ▸ D8).
// Request-building is factored into pure functions so the exact URL/method/body/
// headers are unit-testable without any network I/O.

const REST_PATH = '/rest/v1/leaderboard';
// Columns every board row carries. The board select stays LEAN — the big per-hero
// `loadout` snapshot (attributes, gear, skills) is NOT fetched with the list; it's
// pulled one row at a time when a hero is clicked (fetchHeroLoadout), so opening a
// board with thousands of heroes never downloads every loadout. `ascension` (the
// hero's subclass) is OPTIONAL: a table created before it existed lacks the column,
// so selecting it 400s. fetchBoard() walks COL_TIERS richest-first, dropping the
// newest optional column on each 400, so the board still loads on any table version.
const BASE_COLS = 'name,player_class,max_floor,level,gold,power,hardcore';
const COL_TIERS = [
  BASE_COLS + ',ascension,ssf',
  BASE_COLS + ',ascension',
  BASE_COLS,
];
const SELECT_COLS = COL_TIERS[0];

// Optional row fields a pre-migration table may lack, NEWEST FIRST. On a 400 the
// submit strips the newest field the entry actually carries and retries, so a
// score still records on an older table (missing `ssf`, or missing both `ssf`
// and `loadout`). Mirrors the read-side COL_TIERS degradation.
const SUBMIT_OPTIONAL = ['ssf', 'loadout'];

// The PostgREST filter selecting one ladder. Standard and Hardcore partition on
// the `hardcore` flag; SSF is a CROSS-CUT — every self-found hero regardless of
// hardcore — so an SSF hero also appears on their Standard/Hardcore board. A
// legacy boolean (the old hcOnly arg) still maps: false→Standard, true→Hardcore.
export function ladderFilter(ladder) {
  if (ladder === 'ssf') return 'ssf=eq.true';
  if (ladder === 'hc' || ladder === true) return 'hardcore=eq.true';
  return 'hardcore=eq.false'; // 'std' | false | anything unknown
}

/** Supabase REST headers for the publishable anon key (+ any extras). */
export function restHeaders(key, extra) {
  return Object.assign({
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
  }, extra || {});
}

/** The upsert-a-score request descriptor (one row per name+hardcore). */
export function buildSubmitRequest({ url, key }, entry) {
  return {
    url: url + REST_PATH + '?on_conflict=name,hardcore',
    method: 'POST',
    headers: restHeaders(key, { 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(entry),
    keepalive: true,
  };
}

/** The board URL for a sort column + ladder ('std' | 'hc' | 'ssf'; a legacy
 *  boolean hcOnly still works). */
export function buildFetchUrl({ url }, sortCol, ladder, cols = SELECT_COLS) {
  return url + REST_PATH +
    '?select=' + cols + '&' + ladderFilter(ladder) + '&order=' + sortCol + '.desc';
}

/** The URL for ONE hero's stored loadout snapshot (keyed by name + ladder). */
export function buildLoadoutUrl({ url }, name, hcOnly) {
  return url + REST_PATH +
    '?select=loadout&name=eq.' + encodeURIComponent(name) + '&hardcore=eq.' + !!hcOnly + '&limit=1';
}

/** Range headers for paging through PostgREST's server-side row cap. */
export function buildRangeHeaders({ key }, from, pageSize) {
  return restHeaders(key, { 'Range-Unit': 'items', 'Range': from + '-' + (from + pageSize - 1) });
}

/**
 * Create a leaderboard repository bound to an injected fetch + Supabase config.
 * `submit` upserts a score (fire-and-forget, keepalive, swallows errors);
 * `fetchBoard` pages the full ladder, aborting after a timeout, and throws on a
 * non-OK response (the caller decides whether to fall back to a local mirror).
 * The timer/AbortController are injectable so tests stay deterministic.
 */
export function createLeaderboardRepo({
  fetchImpl,
  url,
  key,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  AbortControllerImpl = AbortController,
}) {
  const config = { url, key };
  // Fire one upsert of `e`. Returns the fetch promise so the caller can decide
  // whether to retry (e.g. drop an optional column on a 400).
  const fireSubmit = (e) => {
    const req = buildSubmitRequest(config, e);
    return fetchImpl(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      keepalive: req.keepalive,
    });
  };
  return {
    submit(entry) {
      try {
        // Progressive degradation: a pre-migration table missing an optional column
        // (`ssf`, then `loadout`) 400s the full row. Each 400 strips the newest
        // optional field the entry actually carries and retries, so the score still
        // records on any table version. `present` lists only fields to drop, so an
        // entry with no optional fields never retries (matches the old behavior).
        const present = SUBMIT_OPTIONAL.filter((k) => entry && entry[k] !== undefined);
        const attempt = (dropN) => {
          let e = entry;
          if (dropN > 0) {
            e = Object.assign({}, entry);
            for (let i = 0; i < dropN; i++) delete e[present[i]];
          }
          return fireSubmit(e).then((res) => {
            if (res && res.ok === false && res.status === 400 && dropN < present.length) {
              return attempt(dropN + 1);
            }
            return res;
          });
        };
        return attempt(0).catch(() => {});
      } catch (_e) { /* never let a submit throw into gameplay */ }
    },
    async fetchBoard(sortCol, ladder, { pageSize = 1000, timeoutMs = 12000 } = {}) {
      const ctrl = new AbortControllerImpl();
      const timer = setTimeoutImpl(() => ctrl.abort(), timeoutMs);
      // Page the full ladder for a given column set. The thrown Error carries the
      // HTTP status so the caller can tell a missing-column 400 from a real outage.
      const pageAll = async (cols) => {
        const fetchUrl = buildFetchUrl(config, sortCol, ladder, cols);
        let rows = [];
        for (let from = 0; ; from += pageSize) {
          const res = await fetchImpl(fetchUrl, {
            headers: buildRangeHeaders(config, from, pageSize),
            signal: ctrl.signal,
          });
          if (!res.ok) { const e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
          const page = await res.json();
          rows = rows.concat(page);
          if (!Array.isArray(page) || page.length < pageSize) break; // last window
        }
        return rows;
      };
      try {
        // Walk the column tiers richest-first. A 400 means a selected column is
        // missing on this (older) table, so drop the newest optional column and try
        // the next tier; the base tier always exists, so it rethrows a real outage.
        for (let t = 0; t < COL_TIERS.length; t++) {
          try {
            return await pageAll(COL_TIERS[t]);
          } catch (e) {
            if (e && e.status === 400 && t < COL_TIERS.length - 1) continue;
            throw e;
          }
        }
      } finally {
        clearTimeoutImpl(timer);
      }
    },
    // One hero's stored loadout snapshot, fetched on demand when a board row is
    // opened. Returns the loadout object, or null on any problem (no row, a table
    // that predates the `loadout` column → 400, a timeout, an outage) so the detail
    // view can gracefully show "no snapshot" instead of throwing into the UI.
    async fetchHeroLoadout(name, hardcore, { timeoutMs = 8000 } = {}) {
      const ctrl = new AbortControllerImpl();
      const timer = setTimeoutImpl(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetchImpl(buildLoadoutUrl(config, name, !!hardcore), {
          headers: restHeaders(key), signal: ctrl.signal,
        });
        if (!res.ok) return null;
        const rows = await res.json();
        return (Array.isArray(rows) && rows[0]) ? (rows[0].loadout || null) : null;
      } catch (e) {
        return null;
      } finally {
        clearTimeoutImpl(timer);
      }
    },
  };
}
