import { describe, it, expect } from 'vitest';
import {
  scaleDeadZone, joystickVector, sprintFromMagnitude, slideOrigin, JOY_DEFAULTS,
} from '../../src/systems/joystickMath.js';

describe('scaleDeadZone', () => {
  it('zeroes input at or below the dead-zone', () => {
    expect(scaleDeadZone(0, 0.12)).toBe(0);
    expect(scaleDeadZone(0.12, 0.12)).toBe(0);
    expect(scaleDeadZone(0.05, 0.12)).toBe(0);
  });
  it('rescales the range above the dead-zone to 0..1 with no jump at the edge', () => {
    // just past the edge → near 0 (no snap to a big value)
    expect(scaleDeadZone(0.121, 0.12)).toBeCloseTo(0.001 / 0.88, 6);
    // halfway between dead-zone and rim
    expect(scaleDeadZone(0.56, 0.12)).toBeCloseTo((0.56 - 0.12) / 0.88, 6);
    // full throw → 1
    expect(scaleDeadZone(1, 0.12)).toBeCloseTo(1, 10);
  });
  it('clamps raw magnitude above 1', () => {
    expect(scaleDeadZone(1.5, 0.12)).toBeCloseTo(1, 10);
  });
  it('handles a zero dead-zone (linear passthrough)', () => {
    expect(scaleDeadZone(0.4, 0)).toBeCloseTo(0.4, 10);
  });
  it('a dead-zone at/above 1 is clamped so nothing but the very rim reads', () => {
    expect(scaleDeadZone(0.5, 1)).toBe(0);
    expect(scaleDeadZone(1, 1)).toBeCloseTo(1, 10); // 0.99 clamp: (1-0.99)/(1-0.99)=1
  });
});

describe('joystickVector', () => {
  const R = 50;
  it('returns zero for a non-positive radius', () => {
    expect(joystickVector({ x: 0, y: 0 }, { x: 30, y: 0 }, 0)).toEqual({ ix: 0, iy: 0, mag: 0 });
    expect(joystickVector({ x: 0, y: 0 }, { x: 30, y: 0 }, -5)).toEqual({ ix: 0, iy: 0, mag: 0 });
  });
  it('returns zero when the thumb sits exactly on the origin', () => {
    expect(joystickVector({ x: 10, y: 10 }, { x: 10, y: 10 }, R)).toEqual({ ix: 0, iy: 0, mag: 0 });
  });
  it('returns zero inside the dead-zone', () => {
    // 5px of 50 = 0.1 raw, below the 0.12 dead-zone
    expect(joystickVector({ x: 0, y: 0 }, { x: 5, y: 0 }, R)).toEqual({ ix: 0, iy: 0, mag: 0 });
  });
  it('points right with full magnitude at the rim', () => {
    const v = joystickVector({ x: 0, y: 0 }, { x: 50, y: 0 }, R);
    expect(v.ix).toBeCloseTo(1, 6);
    expect(v.iy).toBeCloseTo(0, 6);
    expect(v.mag).toBeCloseTo(1, 6);
  });
  it('screen-down maps to +iy (no axis flip needed)', () => {
    const v = joystickVector({ x: 0, y: 0 }, { x: 0, y: 50 }, R);
    expect(v.iy).toBeGreaterThan(0);
    expect(v.ix).toBeCloseTo(0, 6);
  });
  it('clamps magnitude to 1 past the rim but keeps direction', () => {
    const v = joystickVector({ x: 0, y: 0 }, { x: 500, y: 0 }, R);
    expect(v.mag).toBeCloseTo(1, 6);
    expect(v.ix).toBeCloseTo(1, 6);
  });
  it('produces a unit-length direction for a diagonal push', () => {
    const v = joystickVector({ x: 0, y: 0 }, { x: 40, y: 40 }, R);
    // direction is normalized, then scaled by mag → |(ix,iy)| === mag
    expect(Math.hypot(v.ix, v.iy)).toBeCloseTo(v.mag, 6);
    expect(v.ix).toBeCloseTo(v.iy, 6); // symmetric 45°
  });
});

describe('sprintFromMagnitude', () => {
  it('sprints only when pushed near the rim', () => {
    expect(sprintFromMagnitude(0.5)).toBe(false);
    expect(sprintFromMagnitude(0.91)).toBe(false);
    expect(sprintFromMagnitude(0.92)).toBe(true);
    expect(sprintFromMagnitude(1)).toBe(true);
  });
  it('respects a custom threshold', () => {
    expect(sprintFromMagnitude(0.7, 0.6)).toBe(true);
    expect(sprintFromMagnitude(0.5, 0.6)).toBe(false);
  });
});

describe('slideOrigin', () => {
  const R = 50;
  it('leaves the origin put while the thumb is within the radius', () => {
    expect(slideOrigin({ x: 0, y: 0 }, { x: 30, y: 0 }, R)).toEqual({ x: 0, y: 0 });
    expect(slideOrigin({ x: 0, y: 0 }, { x: 50, y: 0 }, R)).toEqual({ x: 0, y: 0 });
  });
  it('drags the origin to sit exactly one radius behind a far thumb', () => {
    const o = slideOrigin({ x: 0, y: 0 }, { x: 120, y: 0 }, R);
    expect(o.x).toBeCloseTo(70, 6);   // 120 - 50
    expect(o.y).toBeCloseTo(0, 6);
    // new distance thumb↔origin is exactly the radius
    expect(Math.hypot(120 - o.x, 0 - o.y)).toBeCloseTo(R, 6);
  });
  it('slides along a diagonal, preserving direction', () => {
    const thumb = { x: 300, y: 400 }; // dist 500 from origin
    const o = slideOrigin({ x: 0, y: 0 }, thumb, R);
    expect(Math.hypot(thumb.x - o.x, thumb.y - o.y)).toBeCloseTo(R, 4);
    // origin lies on the origin→thumb ray
    expect(o.y / o.x).toBeCloseTo(400 / 300, 6);
  });
  it('returns the origin unchanged for a non-positive radius', () => {
    expect(slideOrigin({ x: 3, y: 4 }, { x: 99, y: 99 }, 0)).toEqual({ x: 3, y: 4 });
  });
});

describe('JOY_DEFAULTS', () => {
  it('exposes the tuning constants', () => {
    expect(JOY_DEFAULTS.deadZone).toBeGreaterThan(0);
    expect(JOY_DEFAULTS.sprintAt).toBeGreaterThan(0.5);
  });
});
