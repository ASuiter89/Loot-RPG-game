import { describe, it, expect } from 'vitest';
import {
  pointInDisc, pointInRing, distToSegment, pointInLane, angleDiff, pointInCone,
  telegraphPhase, telegraphFill, telegraphDanger, stepTelegraph,
  TELE_WINDUP, TELE_ACTIVE, TELE_DONE,
} from '../../src/systems/telegraph.js';

describe('telegraph geometry', () => {
  it('pointInDisc: inside, on edge, outside', () => {
    expect(pointInDisc(0, 0, 0, 0, 2)).toBe(true);
    expect(pointInDisc(2, 0, 0, 0, 2)).toBe(true);   // on the boundary counts
    expect(pointInDisc(2.01, 0, 0, 0, 2)).toBe(false);
    expect(pointInDisc(3, 4, 0, 0, 5)).toBe(true);
  });

  it('pointInRing: safe in the hole and beyond, lethal in the band', () => {
    expect(pointInRing(0, 0, 0, 0, 2, 4)).toBe(false);   // centre hole is safe
    expect(pointInRing(3, 0, 0, 0, 2, 4)).toBe(true);    // in the band
    expect(pointInRing(5, 0, 0, 0, 2, 4)).toBe(false);   // beyond the outer edge
  });

  it('distToSegment / pointInLane: perpendicular offset misses', () => {
    expect(distToSegment(1, 0, 0, 0, 10, 0)).toBeCloseTo(0);
    expect(distToSegment(5, 3, 0, 0, 10, 0)).toBeCloseTo(3);
    // clamps to the endpoints beyond the segment
    expect(distToSegment(-4, 0, 0, 0, 10, 0)).toBeCloseTo(4);
    expect(pointInLane(5, 0.5, 0, 0, 10, 0, 1)).toBe(true);   // inside the lane width
    expect(pointInLane(5, 1.5, 0, 0, 10, 0, 1)).toBe(false);  // stepped out of the lane
  });

  it('angleDiff wraps to (-PI, PI]', () => {
    expect(angleDiff(0.1, -0.1)).toBeCloseTo(0.2);
    expect(Math.abs(angleDiff(Math.PI + 0.1, -Math.PI + 0.1))).toBeLessThan(1e-9);
  });

  it('pointInCone: inside the wedge vs behind the boss', () => {
    // Cone facing +x (0 rad), ±45°, radius 5.
    expect(pointInCone(3, 0, 0, 0, 0, Math.PI / 4, 5)).toBe(true);      // straight ahead
    expect(pointInCone(3, 3, 0, 0, 0, Math.PI / 4, 5)).toBe(true);      // 45° edge
    expect(pointInCone(-3, 0, 0, 0, 0, Math.PI / 4, 5)).toBe(false);    // behind
    expect(pointInCone(6, 0, 0, 0, 0, Math.PI / 4, 5)).toBe(false);     // out of range
  });
});

describe('telegraph phase / fill', () => {
  const mk = (age) => ({ age, tell: 1.0, active: 0.1 });
  it('reports windup, then active, then done', () => {
    expect(telegraphPhase(mk(0))).toBe(TELE_WINDUP);
    expect(telegraphPhase(mk(0.5))).toBe(TELE_WINDUP);
    expect(telegraphPhase(mk(1.0))).toBe(TELE_ACTIVE);
    expect(telegraphPhase(mk(1.05))).toBe(TELE_ACTIVE);
    expect(telegraphPhase(mk(1.2))).toBe(TELE_DONE);
  });
  it('fill ramps 0→1 across the windup and clamps', () => {
    expect(telegraphFill(mk(0))).toBeCloseTo(0);
    expect(telegraphFill(mk(0.5))).toBeCloseTo(0.5);
    expect(telegraphFill(mk(1.0))).toBeCloseTo(1);
    expect(telegraphFill(mk(2.0))).toBeCloseTo(1);   // never exceeds 1
  });
});

describe('telegraphDanger dispatch', () => {
  it('routes each shape to its hit-test', () => {
    expect(telegraphDanger({ shape: 'disc', x: 0, y: 0, r: 2 }, 1, 0)).toBe(true);
    expect(telegraphDanger({ shape: 'ring', x: 0, y: 0, innerR: 2, r: 4 }, 0, 0)).toBe(false);
    expect(telegraphDanger({ shape: 'lane', x1: 0, y1: 0, x2: 10, y2: 0, halfW: 1 }, 5, 0.5)).toBe(true);
    expect(telegraphDanger({ shape: 'cone', x: 0, y: 0, facing: 0, halfAngle: Math.PI / 4, r: 5 }, 3, 0)).toBe(true);
    expect(telegraphDanger({ shape: 'nope' }, 0, 0)).toBe(false);
  });
});

describe('stepTelegraph', () => {
  it('fires justDetonated exactly once on the windup→active transition', () => {
    const t = { age: 0, tell: 1.0, active: 0.2, resolved: false };
    let s = stepTelegraph(t, 0.5); expect(s.phase).toBe(TELE_WINDUP); expect(s.justDetonated).toBe(false);
    s = stepTelegraph(t, 0.6); expect(s.phase).toBe(TELE_ACTIVE); expect(s.justDetonated).toBe(true);
    t.resolved = true;   // edge marks it resolved after dealing damage
    s = stepTelegraph(t, 0.05); expect(s.phase).toBe(TELE_ACTIVE); expect(s.justDetonated).toBe(false);
    s = stepTelegraph(t, 0.2); expect(s.phase).toBe(TELE_DONE);
  });
});
