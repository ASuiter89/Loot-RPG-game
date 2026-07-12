import { describe, it, expect } from 'vitest';
import { WEAVE } from '../../src/data/ascendantWeave.js';
import {
  boardPointsSpent,
  boardPointsAvailable,
  nodesAllocated,
  pointsInConstellation,
  canAllocate,
  allocate,
  refundNode,
  refundAll,
  keystonesActive,
  weaveStatContribution,
  weaveDepthRank,
  sanitizeBoard,
} from '../../src/systems/ascendantWeave.js';

// Small helpers to build boards the legal way (through allocate), so tests exercise
// the real prereq flow rather than hand-poking state.
const empty = () => ({ nodes: {} });
function litPath(...ids) {
  let b = empty();
  for (const id of ids) b = allocate(b, id);
  return b;
}

describe('boardPointsSpent / boardPointsAvailable — the independent drawer', () => {
  it('an empty board has spent 0', () => {
    expect(boardPointsSpent(empty())).toBe(0);
    expect(boardPointsSpent(null)).toBe(0);
    expect(boardPointsSpent({})).toBe(0);
  });

  it('spent == count of lit nodes (each costs 1)', () => {
    const b = litPath('ferocity_1', 'ferocity_2');
    expect(boardPointsSpent(b)).toBe(2);
  });

  it('available draws the FULL earned pool minus only board spend', () => {
    const b = litPath('ferocity_1', 'ferocity_2'); // 2 spent on the board
    // Earned 10 → 8 left FOR THE BOARD regardless of any gear-slot spending.
    expect(boardPointsAvailable(10, b)).toBe(8);
    // An empty board sees the whole pool.
    expect(boardPointsAvailable(10, empty())).toBe(10);
  });

  it('never goes negative and floors garbage earned', () => {
    expect(boardPointsAvailable(1, litPath('ferocity_1', 'ferocity_2'))).toBe(0);
    expect(boardPointsAvailable(NaN, empty())).toBe(0);
    expect(boardPointsAvailable(-5, empty())).toBe(0);
    expect(boardPointsAvailable(3.9, empty())).toBe(3);
  });

  it('tolerates a stored level > 1 by flooring it into the sum', () => {
    expect(boardPointsSpent({ nodes: { ferocity_1: 2, ferocity_2: 1 } })).toBe(3);
    expect(boardPointsSpent({ nodes: { ferocity_1: -3, ferocity_2: 'x' } })).toBe(0);
  });
});

describe('nodesAllocated / pointsInConstellation', () => {
  it('lists only positively-lit nodes', () => {
    expect(nodesAllocated(empty())).toEqual([]);
    const b = { nodes: { ferocity_1: 1, ferocity_2: 0, aegis_1: 1 } };
    expect(nodesAllocated(b).sort()).toEqual(['aegis_1', 'ferocity_1']);
  });

  it('counts lit nodes per arm', () => {
    const b = litPath('ferocity_1', 'ferocity_2', 'aegis_1');
    expect(pointsInConstellation(b, 'ferocity')).toBe(2);
    expect(pointsInConstellation(b, 'aegis')).toBe(1);
    expect(pointsInConstellation(b, 'zephyr')).toBe(0);
    expect(pointsInConstellation(b, 'nope')).toBe(0);
  });
});

describe('canAllocate', () => {
  it('allows an entry node when the board can afford it', () => {
    expect(canAllocate('ferocity_1', empty(), 3)).toBe(true);
  });

  it('rejects an unknown node', () => {
    expect(canAllocate('bogus', empty(), 3)).toBe(false);
  });

  it('rejects a node already lit', () => {
    const b = litPath('ferocity_1');
    expect(canAllocate('ferocity_1', b, 3)).toBe(false);
  });

  it('enforces prereqs — a branch needs its entry, a tip needs a branch', () => {
    expect(canAllocate('ferocity_2', empty(), 3)).toBe(false);        // no entry
    const withEntry = litPath('ferocity_1');
    expect(canAllocate('ferocity_2', withEntry, 3)).toBe(true);       // req met
    expect(canAllocate('ferocity_4', withEntry, 3)).toBe(false);      // reqAny not met
    const withBranch = litPath('ferocity_1', 'ferocity_3');
    expect(canAllocate('ferocity_4', withBranch, 3)).toBe(true);      // reqAny satisfied by branch
  });

  it('rejects when the board has no points left', () => {
    // Earned 1, already spent 1 on the entry → nothing left for the branch.
    const b = litPath('ferocity_1');
    expect(canAllocate('ferocity_2', b, 1)).toBe(false);
  });

  it('accepts the earned pool as a number or an { earned } object', () => {
    expect(canAllocate('ferocity_1', empty(), { earned: 2 })).toBe(true);
    expect(canAllocate('ferocity_1', empty(), { earned: 0 })).toBe(false);
    expect(canAllocate('ferocity_1', empty(), 'garbage')).toBe(false); // 0 available
  });
});

describe('allocate — pure, new board', () => {
  it('lights a node without mutating the input', () => {
    const before = empty();
    const after = allocate(before, 'ferocity_1');
    expect(after.nodes.ferocity_1).toBe(1);
    expect(before.nodes.ferocity_1).toBeUndefined(); // original untouched
    expect(after).not.toBe(before);
  });

  it('is a no-op copy for an unknown node id', () => {
    const after = allocate(empty(), 'bogus');
    expect(after.nodes).toEqual({});
  });
});

describe('refundNode / refundAll — cascade to keep the board valid', () => {
  it('refunds a leaf, leaving valid siblings lit', () => {
    const b = litPath('ferocity_1', 'ferocity_2', 'ferocity_3');
    const out = refundNode(b, 'ferocity_2');
    expect(nodesAllocated(out).sort()).toEqual(['ferocity_1', 'ferocity_3']);
  });

  it('refunding a root cascades away everything that depended on it', () => {
    const b = litPath('ferocity_1', 'ferocity_2', 'ferocity_4'); // tip via branch 2
    const out = refundNode(b, 'ferocity_1');
    expect(nodesAllocated(out)).toEqual([]); // branch + tip orphaned → cleared
  });

  it('refunding an unlit / unknown node just returns a clean board', () => {
    const b = litPath('ferocity_1');
    expect(nodesAllocated(refundNode(b, 'aegis_1'))).toEqual(['ferocity_1']);
  });

  it('refundAll wipes the board', () => {
    expect(refundAll()).toEqual({ nodes: {} });
  });
});

describe('keystonesActive — gated two ways, dormant on an untouched arm', () => {
  it('an EMPTY board activates NOTHING, even with sky-high attributes', () => {
    const attrs = { might: 999, vitality: 999, agility: 999, spirit: 999, luck: 999 };
    expect(keystonesActive(empty(), attrs)).toEqual([]);
  });

  it('an attribute-gated keystone needs both the arm entered AND the total met', () => {
    const inFerocity = litPath('ferocity_1');
    // Entered ferocity but might below the 60 gate → dormant.
    expect(keystonesActive(inFerocity, { might: 40 })).not.toContain('ks_unbroken');
    // Gate met AND arm entered → active.
    expect(keystonesActive(inFerocity, { might: 60 })).toContain('ks_unbroken');
    // Gate met but arm NOT entered (only aegis lit) → still dormant.
    const inAegis = litPath('aegis_1');
    expect(keystonesActive(inAegis, { might: 999 })).not.toContain('ks_unbroken');
  });

  it('a points-gated keystone needs n points spent in its arm', () => {
    const three = litPath('ferocity_1', 'ferocity_2', 'ferocity_3'); // 3 pts
    expect(keystonesActive(three, {})).not.toContain('ks_overwhelm');
    const four = litPath('ferocity_1', 'ferocity_2', 'ferocity_3', 'ferocity_4'); // 4 pts
    expect(keystonesActive(four, {})).toContain('ks_overwhelm');
  });

  it('AND-combines every gate condition (attribute total + board-wide spend)', () => {
    // ks_annihilate gates on { attr:might, total:150, boardPts:24 }. Enter ferocity and
    // clear the attribute total but fall short on total board points → still dormant.
    const shallow = litPath('ferocity_1');
    expect(keystonesActive(shallow, { might: 999 })).not.toContain('ks_annihilate');
    // Light 24 nodes across the board AND clear the might total → ignites.
    let big = empty();
    for (const c of ['ferocity', 'aegis', 'zephyr', 'oracle', 'fortune']) {
      // full 7-node arm: entry, both branches, both tips, both apexes
      big = allocate(big, `${c}_1`);
      big = allocate(big, `${c}_2`);
      big = allocate(big, `${c}_3`);
      big = allocate(big, `${c}_4`);
      big = allocate(big, `${c}_5`);
      big = allocate(big, `${c}_6`);
      big = allocate(big, `${c}_7`);
    }
    expect(boardPointsSpent(big)).toBeGreaterThanOrEqual(24);
    expect(keystonesActive(big, { might: 150 })).toContain('ks_annihilate');
    // Board points met but might below 150 → dormant again (every part must hold).
    expect(keystonesActive(big, { might: 149 })).not.toContain('ks_annihilate');
  });

  it('tolerates missing attrs object', () => {
    expect(Array.isArray(keystonesActive(litPath('ferocity_1'), null))).toBe(true);
  });
});

describe('weaveStatContribution — the aggregate', () => {
  it('an EMPTY board is a true no-op, even with every gate cleared', () => {
    const attrs = { might: 999, vitality: 999, agility: 999, spirit: 999, luck: 999 };
    expect(weaveStatContribution(empty(), attrs)).toEqual({ flat: {}, mult: {} });
    // Missing attrs arg also no-op.
    expect(weaveStatContribution(empty())).toEqual({ flat: {}, mult: {} });
  });

  it('sums lit-node payloads straight into flat', () => {
    const b = litPath('ferocity_1', 'ferocity_2'); // {might:2} + {ATK:4}
    const { flat, mult } = weaveStatContribution(b, {});
    expect(flat).toEqual({ might: 2, ATK: 4 });
    expect(mult).toEqual({});
  });

  it('sums an attribute that appears on more than one node in the arm', () => {
    // ferocity_1 {might:2} + ferocity_4 tip {might:3} both add might.
    const b = litPath('ferocity_1', 'ferocity_2', 'ferocity_4');
    const { flat } = weaveStatContribution(b, {});
    expect(flat.might).toBe(2 + 3);
    expect(flat.ATK).toBe(4);
  });

  it('folds an active stat-mult keystone into mult', () => {
    const b = litPath('ferocity_1'); // ferocity entered
    const { mult } = weaveStatContribution(b, { might: 60 }); // ks_unbroken active
    expect(mult.ATK).toBeCloseTo(1.15, 10);
  });

  it('multiplies together several active keystones on the same stat', () => {
    // ferocity full 7-node arm (7 pts): ks_overwhelm (n:4) and ks_titanic (n:6) both
    // fire, and with might 150 ks_unbroken (60) + ks_annihilate need boardPts too —
    // here only the in-arm gates matter for ATK stacking (unbroken 1.15 × titanic 1.18).
    const b = litPath('ferocity_1', 'ferocity_2', 'ferocity_3', 'ferocity_4', 'ferocity_5', 'ferocity_6', 'ferocity_7');
    const { mult } = weaveStatContribution(b, { might: 60 });
    expect(mult.ATK).toBeCloseTo(1.15 * 1.18, 10); // unbroken × titanic
    expect(mult.CRITDMG).toBeCloseTo(1.12, 10);     // overwhelm
  });

  it('folds an active flat-effect keystone into flat', () => {
    // Light 4 aegis nodes → ks_stoneskin ({ DR:8 }) active via the n:4 gate.
    const b = litPath('aegis_1', 'aegis_2', 'aegis_3', 'aegis_4');
    const { flat, mult } = weaveStatContribution(b, {});
    // aegis payloads: {vitality:2},{HP:12},{DR:3},{vitality:3}
    expect(flat.vitality).toBe(5);
    expect(flat.HP).toBe(12);
    expect(flat.DR).toBe(3 + 8); // node DR + stoneskin flat
    expect(mult).toEqual({});    // stoneskin is a flat effect, no mult
  });
});

describe('weaveDepthRank — cosmetic, infinite, zero power', () => {
  // base 5, step 3 → cumulative(R) = 5R + 3R(R-1)/2 : 0,5,13,24,38,...
  it('rank 0 below the first threshold, with progress fields', () => {
    const r0 = weaveDepthRank(0);
    expect(r0.rank).toBe(0);
    expect(r0.nextAt).toBe(5);
    const r4 = weaveDepthRank(4);
    expect(r4.rank).toBe(0);
    expect(r4.into).toBe(4);
    expect(r4.span).toBe(5);
  });

  it('climbs the ever-steepening ladder correctly', () => {
    expect(weaveDepthRank(5).rank).toBe(1);
    expect(weaveDepthRank(12).rank).toBe(1);
    expect(weaveDepthRank(13).rank).toBe(2);
    expect(weaveDepthRank(13).nextAt).toBe(24);
    expect(weaveDepthRank(24).rank).toBe(3);
  });

  it('resolves a huge (endless) pile instantly and monotonically', () => {
    const big = weaveDepthRank(1_000_000);
    expect(big.rank).toBeGreaterThan(0);
    expect(big.nextAt).toBeGreaterThan(1_000_000);
    // Rank must not decrease as points grow.
    expect(weaveDepthRank(1_000_001).rank).toBeGreaterThanOrEqual(big.rank);
  });

  it('clamps garbage / negative depth to rank 0', () => {
    expect(weaveDepthRank(-99).rank).toBe(0);
    expect(weaveDepthRank(NaN).rank).toBe(0);
  });

  it('surfaces a flavour title clamped to the list', () => {
    expect(weaveDepthRank(0).title).toBe(WEAVE.weaveDepth.titles[0]);
    const last = WEAVE.weaveDepth.titles[WEAVE.weaveDepth.titles.length - 1];
    expect(weaveDepthRank(10_000_000).title).toBe(last);
  });

  it('supports a linear (step 0) custom tuning', () => {
    const data = { weaveDepth: { base: 10, step: 0, titles: ['A'] } };
    const r = weaveDepthRank(25, data);
    expect(r.rank).toBe(2);
    expect(r.nextAt).toBe(30);
    expect(r.into).toBe(5);
    expect(r.span).toBe(10);
  });
});

describe('sanitizeBoard — load any blob into a valid board', () => {
  it('garbage becomes an empty board', () => {
    expect(sanitizeBoard(null)).toEqual({ nodes: {} });
    expect(sanitizeBoard(42)).toEqual({ nodes: {} });
    expect(sanitizeBoard(undefined)).toEqual({ nodes: {} });
  });

  it('drops unknown ids and non-positive values, collapsing levels to 1', () => {
    const out = sanitizeBoard({ nodes: { ferocity_1: 3, bogus: 1, aegis_1: 0 } });
    expect(out.nodes).toEqual({ ferocity_1: 1 });
  });

  it('accepts a bare id→value map (looser/older save shape)', () => {
    const out = sanitizeBoard({ ferocity_1: 1 });
    expect(out.nodes).toEqual({ ferocity_1: 1 });
  });

  it('repairs an invalid board — a branch with no lit entry is dropped', () => {
    const out = sanitizeBoard({ nodes: { ferocity_2: 1 } }); // branch, entry missing
    expect(out.nodes).toEqual({});
  });

  it('keeps a fully-valid path intact', () => {
    const out = sanitizeBoard({ nodes: { ferocity_1: 1, ferocity_2: 1 } });
    expect(out.nodes).toEqual({ ferocity_1: 1, ferocity_2: 1 });
  });
});
