// Leaderboard persistence — the repository seam for the Supabase leaderboard.
//
// All Supabase REST details (endpoint, headers, paging, on_conflict) live here,
// behind an INJECTED `fetch`, so game logic never talks to Supabase directly and
// tests mock the backend by passing a fake fetch (see docs/DECISIONS.md ▸ D8).
// Request-building is factored into pure functions so the exact URL/method/body/
// headers are unit-testable without any network I/O.

const REST_PATH = '/rest/v1/leaderboard';
const SELECT_COLS = 'name,player_class,max_floor,level,gold,power,hardcore';

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

/** The board URL for a sort column + ladder (Standard vs Hardcore is a param). */
export function buildFetchUrl({ url }, sortCol, hcOnly) {
  return url + REST_PATH +
    '?select=' + SELECT_COLS + '&hardcore=eq.' + hcOnly + '&order=' + sortCol + '.desc';
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
  return {
    submit(entry) {
      try {
        const req = buildSubmitRequest(config, entry);
        return fetchImpl(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body,
          keepalive: req.keepalive,
        }).catch(() => {});
      } catch (_e) { /* never let a submit throw into gameplay */ }
    },
    async fetchBoard(sortCol, hcOnly, { pageSize = 1000, timeoutMs = 12000 } = {}) {
      const fetchUrl = buildFetchUrl(config, sortCol, hcOnly);
      const ctrl = new AbortControllerImpl();
      const timer = setTimeoutImpl(() => ctrl.abort(), timeoutMs);
      try {
        let rows = [];
        for (let from = 0; ; from += pageSize) {
          const res = await fetchImpl(fetchUrl, {
            headers: buildRangeHeaders(config, from, pageSize),
            signal: ctrl.signal,
          });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const page = await res.json();
          rows = rows.concat(page);
          if (!Array.isArray(page) || page.length < pageSize) break; // last window
        }
        return rows;
      } finally {
        clearTimeoutImpl(timer);
      }
    },
  };
}
