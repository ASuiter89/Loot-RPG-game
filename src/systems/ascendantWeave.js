// ── THE ASCENDANT WEAVE — board math (systems layer) ─────────────────────────
//
// Pure functions over a plain BOARD object + injected values (earned boss points,
// attribute totals) + the WEAVE tuning table. No globals, no RNG, no clock, no DOM,
// no fetch/localStorage. The legacy shell owns the live `player` state (the earned
// pool, the persisted board, the socketed glyphs) and calls in here to answer
// "can I light this?", "what's active?", and "what does the whole board contribute?".
//
// The BOARD is intentionally tiny and save-friendly:
//     { nodes: { [nodeId]: 1 } }         // 1 == "this node is lit" (cost is always 1)
// Glyphs are passed in SEPARATELY (an array of socketed glyphs), because they are
// loot living on the item side, not board allocation.
//
// INDEPENDENT DRAWER: like each gear set in bossSlots.js, the board draws from the
// FULL earned boss-point pool on its own — points spent on gear slots do not reduce
// what the board can spend, and vice-versa. boardPointsAvailable() therefore takes
// the raw earned count, never a shared "remaining".
import { WEAVE } from '../data/ascendantWeave.js';
import { glyphPower } from './glyphRoll.js';

// ── internal indexing ────────────────────────────────────────────────────────
// Build id→node and id→socket lookups from the tuning table. The board is ~25 nodes
// so rebuilding per call is trivially cheap and keeps these functions stateless.
function nodeIndex(data) {
  const byId = new Map();
  const list = Array.isArray(data && data.nodes) ? data.nodes : [];
  for (const n of list) if (n && n.id) byId.set(n.id, n);
  return byId;
}
function socketIndex(data) {
  const byId = new Map();
  const list = Array.isArray(data && data.sockets) ? data.sockets : [];
  for (const s of list) if (s && s.id) byId.set(s.id, s);
  return byId;
}

// The lit-node map of a board, tolerant of a null/garbage board.
function nodeMap(board) {
  return (board && typeof board === 'object' && board.nodes && typeof board.nodes === 'object')
    ? board.nodes : {};
}

// Are a node's prerequisites satisfied given the set of currently-lit ids?
//   • req    → ALL listed ids must be lit.
//   • reqAny → at least ONE listed id must be lit.
//   • neither (entry node) → always satisfied.
function prereqsMet(node, litSet) {
  if (!node) return false;
  if (Array.isArray(node.req) && node.req.length) {
    for (const r of node.req) if (!litSet.has(r)) return false;
  }
  if (Array.isArray(node.reqAny) && node.reqAny.length) {
    if (!node.reqAny.some((r) => litSet.has(r))) return false;
  }
  return true;
}

// ── point accounting (the independent drawer) ────────────────────────────────

/**
 * Points SPENT on the board = the sum of lit-node allocations. Each node costs 1 and
 * stores a 1 when lit, so this is just the count of lit nodes. Tolerates a stored
 * level > 1 or corrupt values by flooring/clamping.
 */
export function boardPointsSpent(board) {
  const nodes = nodeMap(board);
  let n = 0;
  for (const k in nodes) {
    const v = nodes[k];
    if (typeof v === 'number' && v > 0) n += Math.floor(v);
  }
  return n;
}

/**
 * Points the board still has to spend = earned − spent-on-the-board, floored at 0.
 * `earned` is the FULL boss-point pool (bossSlots.pointsEarned); the board is an
 * independent drawer, so gear-slot spend is intentionally NOT subtracted here.
 */
export function boardPointsAvailable(earned, board) {
  const pool = Math.max(0, Math.floor(Number(earned) || 0));
  return Math.max(0, pool - boardPointsSpent(board));
}

/** The ids of every lit node (only counts positive allocations). */
export function nodesAllocated(board) {
  const nodes = nodeMap(board);
  const out = [];
  for (const k in nodes) {
    const v = nodes[k];
    if (typeof v === 'number' && v > 0) out.push(k);
  }
  return out;
}

/**
 * Points spent within one constellation (arm) — drives the `{ n }` keystone gate and
 * the arm's progress UI. Counts only lit nodes whose `constellation` matches.
 */
export function pointsInConstellation(board, constId, data = WEAVE) {
  const byId = nodeIndex(data);
  let n = 0;
  for (const id of nodesAllocated(board)) {
    const node = byId.get(id);
    if (node && node.constellation === constId) n += node.cost || 1;
  }
  return n;
}

// Read an "available points" figure from the flexible 3rd arg of canAllocate. It may
// be a raw earned number, or an object carrying `.earned` (some callers pass the
// whole boss-point context). Anything else → 0 available.
function readEarned(attrsOrEarned) {
  if (typeof attrsOrEarned === 'number') return attrsOrEarned;
  if (attrsOrEarned && typeof attrsOrEarned === 'object' && typeof attrsOrEarned.earned === 'number') {
    return attrsOrEarned.earned;
  }
  return 0;
}

/**
 * Can this node be lit right now? True only when the node exists, is not already lit,
 * its prerequisites are satisfied, and the board still has a point to spend.
 * @param {string} nodeId
 * @param {object} board current board
 * @param {number|{earned:number}} attrsOrEarned the earned boss-point pool
 * @param {typeof WEAVE} data tuning
 */
export function canAllocate(nodeId, board, attrsOrEarned, data = WEAVE) {
  const byId = nodeIndex(data);
  const node = byId.get(nodeId);
  if (!node) return false;                       // unknown node
  const litSet = new Set(nodesAllocated(board));
  if (litSet.has(nodeId)) return false;          // already lit
  if (!prereqsMet(node, litSet)) return false;   // path not open
  const avail = boardPointsAvailable(readEarned(attrsOrEarned), board);
  return avail >= (node.cost || 1);              // can afford it
}

/**
 * Light a node — returns a NEW board (never mutates the input). Guards against an
 * unknown node id (returns an unchanged copy). Does NOT re-check prereqs/points; the
 * caller gates with canAllocate() — this keeps allocate a pure, total state
 * transition. Cost is always 1, stored as a 1.
 */
export function allocate(board, nodeId, data = WEAVE) {
  const byId = nodeIndex(data);
  const next = { nodes: { ...nodeMap(board) } };
  if (byId.has(nodeId)) next.nodes[nodeId] = 1;
  return next;
}

// Remove any lit node whose prereqs are no longer satisfied, repeatedly, until the
// board is internally consistent. Used after a refund (and when sanitizing a save) so
// a board can never be left with an orphaned deep node dangling off a refunded root.
function repairBoard(board, data) {
  const byId = nodeIndex(data);
  const nodes = { ...nodeMap(board) };
  let changed = true;
  while (changed) {
    changed = false;
    const litSet = new Set(Object.keys(nodes).filter((k) => nodes[k] > 0));
    for (const id of litSet) {
      const node = byId.get(id);
      // Drop ids the table no longer knows, and lit nodes whose path is now broken.
      if (!node || !prereqsMet(node, litSet)) {
        delete nodes[id];
        changed = true;
      }
    }
  }
  return { nodes };
}

/**
 * Refund a single node — returns a NEW board with it (and any dependents that would
 * be orphaned by its removal) unlit, so the result is always a valid, reachable
 * board. Refunding a nonexistent/unlit id just returns a clean copy.
 */
export function refundNode(board, nodeId, data = WEAVE) {
  const nodes = { ...nodeMap(board) };
  delete nodes[nodeId];
  return repairBoard({ nodes }, data);
}

/** Refund everything — returns a fresh empty board. */
export function refundAll() {
  return { nodes: {} };
}

/**
 * Which keystones are currently active. A keystone ignites only when BOTH hold:
 *   1) its arm has been ENTERED (≥1 lit node there) — this is what guarantees an
 *      untouched board contributes nothing even to a high-attribute hero, and
 *   2) its GATE is met: { attr, total } vs the hero's attribute total, or { n } vs
 *      points spent in that arm.
 * Returns an array of keystone ids.
 * @param {object} board
 * @param {{[attr:string]:number}} attrs live attribute totals (might/vitality/…)
 * @param {typeof WEAVE} data
 */
export function keystonesActive(board, attrs, data = WEAVE) {
  const list = Array.isArray(data && data.keystones) ? data.keystones : [];
  const A = (attrs && typeof attrs === 'object') ? attrs : {};
  const out = [];
  for (const ks of list) {
    if (!ks || !ks.id) continue;
    const inArm = pointsInConstellation(board, ks.constellation, data);
    if (inArm < 1) continue; // arm not entered → dormant (keeps empty board a no-op)
    const gate = ks.gate || {};
    let met = false;
    if (gate.attr != null && gate.total != null) {
      met = (Number(A[gate.attr]) || 0) >= gate.total;
    } else if (gate.n != null) {
      met = inArm >= gate.n;
    }
    if (met) out.push(ks.id);
  }
  return out;
}

// ── glyph geometry ───────────────────────────────────────────────────────────

/**
 * The node ids within a socket's reach — the nodes a glyph placed there would touch
 * (whether lit or not). `radiusOverride` lets a caller substitute a glyph's own reach
 * (glyphs project their tier radius); omit it to use the socket's inherent radius.
 * @param {string} socketId
 * @param {typeof WEAVE} data
 * @param {number} [radiusOverride]
 * @returns {string[]}
 */
export function glyphRadiusNodes(socketId, data = WEAVE, radiusOverride) {
  const sock = socketIndex(data).get(socketId);
  if (!sock) return [];
  const radius = (typeof radiusOverride === 'number' && isFinite(radiusOverride)) ? radiusOverride : sock.radius;
  const r2 = radius * radius;
  const out = [];
  const list = Array.isArray(data && data.nodes) ? data.nodes : [];
  for (const n of list) {
    const dx = n.x - sock.x;
    const dy = n.y - sock.y;
    if (dx * dx + dy * dy <= r2) out.push(n.id);
  }
  return out;
}

// Round a summed flat value to 3 decimals to keep glyph-multiplied totals tidy.
function round3(n) {
  return Math.round(n * 1000) / 1000;
}

/**
 * The board's WHOLE contribution, aggregated:
 *   { flat: { [key]: sum }, mult: { [statKey]: product } }
 * where a `key` is either one of the five attribute names or a gear stat code.
 *
 *   • Every LIT node adds its payload to `flat`. If a socketed glyph physically
 *     covers that node, the node's payload is multiplied by glyphPower(glyph) first —
 *     so WHERE a glyph sits determines which nodes it amplifies (the core mechanic).
 *   • Every ACTIVE keystone with statKey+mult folds a ×mult into `mult`; one carrying
 *     a flat `effect` map folds those into `flat` instead.
 *
 * CRITICAL INVARIANT: an EMPTY board returns { flat:{}, mult:{} } — a true no-op,
 * byte-identical to the game without the feature, even if glyphs are socketed (they
 * cover no lit nodes) and even if the hero's attributes clear every gate (no arm is
 * entered, so no keystone ignites).
 *
 * @param {object} board
 * @param {Array<{socketId:string, value?:number, radius?:number}>} glyphs socketed glyphs
 * @param {{[attr:string]:number}} attrs live attribute totals
 * @param {typeof WEAVE} data
 */
export function weaveStatContribution(board, glyphs, attrs, data = WEAVE) {
  const flat = {};
  const mult = {};
  const byId = nodeIndex(data);
  const sockById = socketIndex(data);
  const lit = nodesAllocated(board).filter((id) => byId.has(id));

  // Pre-resolve socketed glyphs to { center, r2, power }, skipping any with no known
  // socket. A glyph uses its own radius if it carries one, else the socket's reach.
  const placed = [];
  const glyphList = Array.isArray(glyphs) ? glyphs : [];
  for (const g of glyphList) {
    if (!g) continue;
    const sock = sockById.get(g.socketId);
    if (!sock) continue;
    const radius = (typeof g.radius === 'number' && isFinite(g.radius)) ? g.radius : sock.radius;
    placed.push({ x: sock.x, y: sock.y, r2: radius * radius, power: glyphPower(g) });
  }

  // Node payloads → flat, amplified by any covering glyphs.
  for (const id of lit) {
    const node = byId.get(id);
    const payload = (node && node.payload && typeof node.payload === 'object') ? node.payload : null;
    if (!payload) continue;
    // Product of every glyph whose reach covers this node's position.
    let m = 1;
    for (const p of placed) {
      const dx = node.x - p.x;
      const dy = node.y - p.y;
      if (dx * dx + dy * dy <= p.r2) m *= p.power;
    }
    for (const k in payload) {
      const v = Number(payload[k]) || 0;
      flat[k] = (flat[k] || 0) + v * m;
    }
  }

  // Active keystones → their multiplicative or flat riders.
  for (const id of keystonesActive(board, attrs, data)) {
    const ks = (data.keystones || []).find((k) => k && k.id === id);
    if (!ks) continue;
    if (typeof ks.mult === 'number' && ks.statKey) {
      mult[ks.statKey] = (mult[ks.statKey] || 1) * ks.mult;
    }
    if (ks.effect && typeof ks.effect === 'object') {
      for (const k in ks.effect) {
        const v = Number(ks.effect[k]) || 0;
        flat[k] = (flat[k] || 0) + v;
      }
    }
  }

  // Tidy the flat sums (glyph products introduce float noise).
  for (const k in flat) flat[k] = round3(flat[k]);
  return { flat, mult };
}

// ── cosmetic Weave Depth prestige ────────────────────────────────────────────

/**
 * The cosmetic Weave Depth rank for a pile of depth-points. PURELY a badge — returns
 * only the rank and the point total at which the NEXT rank unlocks (plus progress
 * fields for a UI bar). Grants NO stats. Rank R costs `base + step·(R-1)` points, so
 * the cumulative cost to reach rank R is `base·R + step·R·(R-1)/2` — an infinite,
 * ever-steepening ladder solved here in closed form (no unbounded loop, so an
 * "endless" hero with millions of points resolves instantly).
 *
 * @param {number} depthPoints cosmetic depth currency earned
 * @param {typeof WEAVE} data
 * @returns {{rank:number, nextAt:number, into:number, span:number, title:string}}
 */
export function weaveDepthRank(depthPoints, data = WEAVE) {
  const cfg = (data && data.weaveDepth) || {};
  const base = Math.max(1, Number(cfg.base) || 1);
  const step = Math.max(0, Number(cfg.step) || 0);
  const P = Math.max(0, Math.floor(Number(depthPoints) || 0));

  // Cumulative points required to have reached rank R.
  const cumulative = (R) => base * R + step * (R * (R - 1)) / 2;

  let rank;
  if (step === 0) {
    // Linear ladder: every rank costs `base`.
    rank = Math.floor(P / base);
  } else {
    // Solve (step/2)R² + (base − step/2)R − P ≤ 0 for the largest integer R.
    const a = step / 2;
    const b = base - step / 2;
    const disc = b * b + 4 * a * P;
    rank = Math.floor((-b + Math.sqrt(disc)) / (2 * a));
    // Correct for floating-point drift at the boundary (a couple of cheap steps).
    while (cumulative(rank + 1) <= P) rank += 1;
    while (rank > 0 && cumulative(rank) > P) rank -= 1;
  }
  if (rank < 0) rank = 0;

  const floorAt = cumulative(rank);
  const nextAt = cumulative(rank + 1);
  const titles = Array.isArray(cfg.titles) && cfg.titles.length ? cfg.titles : ['Woven'];
  const title = titles[Math.min(titles.length - 1, rank)];

  return {
    rank,
    nextAt,
    into: P - floorAt,          // points earned toward the next rank
    span: nextAt - floorAt,     // points the next rank costs
    title,
  };
}

/**
 * Normalize a loaded/foreign board blob into a clean, VALID board:
 *   { nodes: { [knownNodeId]: 1 } }
 * Accepts either the wrapped shape ({ nodes: {...} }) or a bare id→value map (an
 * older/looser save). Drops unknown ids and non-positive values, then repairs so
 * every surviving node has a satisfied prereq path. Garbage → an empty board, so old
 * saves and corruption both load as "nothing allocated" rather than crashing.
 */
export function sanitizeBoard(raw, data = WEAVE) {
  const byId = nodeIndex(data);
  const src = (raw && typeof raw === 'object')
    ? ((raw.nodes && typeof raw.nodes === 'object') ? raw.nodes : raw)
    : {};
  const nodes = {};
  for (const k in src) {
    if (!byId.has(k)) continue;              // unknown id
    const v = src[k];
    if (typeof v === 'number' && v > 0) nodes[k] = 1; // collapse any level to 1
  }
  return repairBoard({ nodes }, data);
}
