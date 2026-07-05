import { describe, it, expect } from 'vitest';
import {
  IMPACT_AOE_SHAPES, isImpactAoeShape, splashTargetsFrom, castTargetsInSight, nextChainLink,
} from '../../src/systems/aoeTargeting.js';

// A grid-backed LOS predicate for tests: `walls` is a Set of "x,y" tiles that block
// the ray. Mirrors the real hasLineOfSight walk (steps toward the target, blocked if
// an intermediate tile is solid; the endpoint itself never blocks).
function losOn(walls) {
  return function hasLos(ax, ay, bx, by) {
    let x = ax, y = ay, guard = 0;
    while ((x !== bx || y !== by) && guard++ < 256) {
      x += Math.sign(bx - x);
      y += Math.sign(by - y);
      if (x === bx && y === by) break;
      if (walls.has(`${x},${y}`)) return false;
    }
    return true;
  };
}
const foe = (x, y) => ({ x, y });

describe('isImpactAoeShape', () => {
  it('flags blast as an impact-centred AoE', () => {
    expect(isImpactAoeShape('blast')).toBe(true);
    expect(IMPACT_AOE_SHAPES.has('blast')).toBe(true);
  });
  it('does not flag hero-centred / single-target shapes', () => {
    for (const s of ['nova', 'bolt', 'line', 'chain', 'teleport', 'melee', 'cleave', 'random', 'self', 'summon']) {
      expect(isImpactAoeShape(s)).toBe(false);
    }
  });
});

describe('splashTargetsFrom', () => {
  it('keeps every candidate the impact tile can see', () => {
    const hasLos = losOn(new Set()); // open ground
    const cands = [foe(10, 10), foe(11, 10), foe(9, 12)];
    expect(splashTargetsFrom(10, 10, cands, hasLos)).toEqual(cands);
  });

  it('the impact tile always sees a foe standing on it', () => {
    const hasLos = losOn(new Set(['10,10'])); // even a "wall" on the impact itself
    const onImpact = foe(10, 10);
    expect(splashTargetsFrom(10, 10, [onImpact], hasLos)).toEqual([onImpact]);
  });

  it('drops candidates blocked from the impact by a wall', () => {
    // Wall at (11,10) sits between impact (10,10) and the far foe (12,10).
    const hasLos = losOn(new Set(['11,10']));
    const near = foe(11, 10);   // on the wall tile → endpoint, still hit
    const far = foe(12, 10);    // behind the wall from the impact → dropped
    const clear = foe(10, 12);  // clear column → kept
    const out = splashTargetsFrom(10, 10, [near, far, clear], hasLos);
    expect(out).toContain(near);
    expect(out).toContain(clear);
    expect(out).not.toContain(far);
  });

  it('returns [] for a null origin or missing predicate', () => {
    expect(splashTargetsFrom(null, 5, [foe(1, 1)], losOn(new Set()))).toEqual([]);
    expect(splashTargetsFrom(5, null, [foe(1, 1)], losOn(new Set()))).toEqual([]);
    expect(splashTargetsFrom(5, 5, [foe(1, 1)], null)).toEqual([]);
  });
});

describe('castTargetsInSight — blast (impact-centred)', () => {
  const hero = { x: 0, y: 0 };

  it('THE BUG FIX: catches foes hidden from the hero but visible from the impact', () => {
    // Hero at (0,5). The meteor lands on the impact foe at (10,5) — a clear shot along
    // row 5. Its neighbours at (10,4)/(10,6) sit right beside the impact, but a wall at
    // (5,4)/(5,6) hides each of them from the HERO. The blast must still burn them
    // because the explosion spreads from the IMPACT, which sees them trivially.
    const heroAt = { x: 0, y: 5 };
    const hasLos = losOn(new Set(['5,4', '5,6']));
    const impact = foe(10, 5);           // clear along row 5 → hero can see it (projectile arrives)
    const neighbourA = foe(10, 4);       // beside the impact; hidden from the hero by (5,4)
    const neighbourB = foe(10, 6);       // beside the impact; hidden from the hero by (5,6)
    const targets = [impact, neighbourA, neighbourB];
    // Sanity: the old hero-origin filter would have kept ONLY the impact foe.
    const oldWay = targets.filter(e => hasLos(heroAt.x, heroAt.y, e.x, e.y));
    expect(oldWay).toEqual([impact]);
    // The fix: the splash spreads from the impact, so all three burn.
    const out = castTargetsInSight('blast', targets, impact, heroAt, hasLos);
    expect(out).toContain(impact);
    expect(out).toContain(neighbourA);
    expect(out).toContain(neighbourB);
    expect(out).toHaveLength(3);
  });

  it('fizzles (returns []) when the hero cannot see the impact point', () => {
    // A wall between the hero and the impact means the projectile never arrives.
    const hasLos = losOn(new Set(['3,3']));
    const impact = foe(6, 6);            // blocked from the hero by (3,3) on the diagonal
    const out = castTargetsInSight('blast', [impact, foe(6, 7)], impact, hero, hasLos);
    expect(out).toEqual([]);
  });

  it('excludes a splash foe the impact cannot see even if the impact is reachable', () => {
    const hasLos = losOn(new Set(['7,6'])); // wall just past the impact
    const impact = foe(6, 6);            // clear diagonal from hero → reachable
    const behind = foe(8, 6);            // behind the wall from the impact
    const beside = foe(6, 7);            // clear from the impact
    const out = castTargetsInSight('blast', [impact, behind, beside], impact, hero, hasLos);
    expect(out).toContain(impact);
    expect(out).toContain(beside);
    expect(out).not.toContain(behind);
  });
});

describe('castTargetsInSight — hero-radiating shapes', () => {
  const hero = { x: 0, y: 0 };

  it('filters bolt/nova/chain/line targets by LOS from the HERO', () => {
    const hasLos = losOn(new Set(['3,3'])); // blocks the (6,6) diagonal
    const visible = foe(2, 0);
    const hidden = foe(6, 6);
    for (const shape of ['bolt', 'nova', 'line', 'chain', 'teleport']) {
      const out = castTargetsInSight(shape, [visible, hidden], hero, hero, hasLos);
      expect(out).toContain(visible);
      expect(out).not.toContain(hidden);
    }
  });

  it('a hero-centred nova keeps everything in the open', () => {
    const hasLos = losOn(new Set());
    const cands = [foe(1, 0), foe(0, 1), foe(1, 1)];
    expect(castTargetsInSight('nova', cands, hero, hero, hasLos)).toEqual(cands);
  });
});

describe('nextChainLink', () => {
  it('jumps to the nearest unhit foe within range that the LAST foe can see', () => {
    const hasLos = losOn(new Set());
    const last = foe(5, 5);
    const near = foe(6, 5);   // 1 away
    const mid = foe(5, 7);    // 2 away
    const far = foe(9, 5);    // 4 away → beyond maxStep 3
    expect(nextChainLink(last, [far, mid, near], 3, hasLos)).toBe(near);
  });

  it('THE CHAIN FIX: an arc bends around a corner the hero cannot see past', () => {
    // The chain jumps from `last` to a foe hidden from the hero but in clear line of
    // `last`. A wall at (2,2) would hide (6,6) from a hero at (0,0), but the arc is
    // judged from `last`, which sees it directly.
    const hasLos = losOn(new Set(['2,2'])); // only blocks the hero→(6,6) diagonal
    const last = foe(5, 6);
    const target = foe(6, 6);   // adjacent to last, clear from last; hidden from hero
    expect(nextChainLink(last, [target], 3, hasLos)).toBe(target);
    // (the same wall would have hidden the target from a hero at 0,0)
    expect(hasLos(0, 0, 6, 6)).toBe(false);
  });

  it('skips a nearer foe the last link cannot see, taking a visible farther one', () => {
    // (6,5) is nearer but a wall at (6,5)'s path... use a wall between last and the
    // nearer foe. last=(5,5); nearer=(7,5) blocked by wall at (6,5); farther=(5,7) clear.
    const hasLos = losOn(new Set(['6,5']));
    const last = foe(5, 5);
    const nearerBlocked = foe(7, 5); // wall at (6,5) sits on the path → not visible
    const fartherClear = foe(5, 7);  // clear column
    expect(nextChainLink(last, [nearerBlocked, fartherClear], 3, hasLos)).toBe(fartherClear);
  });

  it('returns null when nothing is reachable (the chain ends)', () => {
    const hasLos = losOn(new Set());
    const last = foe(0, 0);
    expect(nextChainLink(last, [foe(9, 9)], 3, hasLos)).toBeNull();     // out of range
    expect(nextChainLink(last, [], 3, hasLos)).toBeNull();             // no candidates
    expect(nextChainLink(null, [foe(1, 1)], 3, hasLos)).toBeNull();    // no origin
    expect(nextChainLink(last, [foe(1, 1)], 3, null)).toBeNull();      // no predicate
  });
});

describe('castTargetsInSight — guards', () => {
  const hero = { x: 0, y: 0 };
  it('returns [] on empty targets, missing predicate, or missing hero', () => {
    expect(castTargetsInSight('blast', [], foe(1, 1), hero, losOn(new Set()))).toEqual([]);
    expect(castTargetsInSight('bolt', [foe(1, 1)], hero, hero, null)).toEqual([]);
    expect(castTargetsInSight('bolt', [foe(1, 1)], hero, null, losOn(new Set()))).toEqual([]);
  });
});
