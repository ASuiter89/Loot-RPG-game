import { describe, it, expect } from 'vitest';
import { isRiskySwap, blockGearSwap, GEARSET_RISK_RATIO } from '../../src/systems/gearSetSwap.js';

describe('isRiskySwap', () => {
  it('flags an empty target as risky', () => {
    expect(isRiskySwap(100, 0)).toBe(true);
  });

  it('flags a target below half the current worn power', () => {
    expect(isRiskySwap(100, 49)).toBe(true);
  });

  it('allows a target at or above half the current power', () => {
    expect(isRiskySwap(100, 50)).toBe(false);
    expect(isRiskySwap(100, 80)).toBe(false);
  });

  it('never flags a swap UP (target at least as strong)', () => {
    expect(isRiskySwap(100, 100)).toBe(false);
    expect(isRiskySwap(100, 250)).toBe(false);
    expect(isRiskySwap(0, 0)).toBe(false);   // both empty: no protection lost
    expect(isRiskySwap(0, 120)).toBe(false); // gearing up from naked
  });

  it('respects a custom ratio', () => {
    expect(isRiskySwap(100, 70, 0.8)).toBe(true);
    expect(isRiskySwap(100, 70, 0.5)).toBe(false);
  });

  it('defaults the ratio to GEARSET_RISK_RATIO', () => {
    expect(isRiskySwap(100, 100 * GEARSET_RISK_RATIO - 1)).toBe(true);
    expect(isRiskySwap(100, 100 * GEARSET_RISK_RATIO)).toBe(false);
  });
});

describe('blockGearSwap', () => {
  it('blocks a risky downgrade while in danger', () => {
    expect(blockGearSwap({ inDanger: true, curPower: 100, tgtPower: 0 })).toBe(true);
    expect(blockGearSwap({ inDanger: true, curPower: 100, tgtPower: 20 })).toBe(true);
  });

  it('allows any swap when not in danger', () => {
    expect(blockGearSwap({ inDanger: false, curPower: 100, tgtPower: 0 })).toBe(false);
    expect(blockGearSwap({ inDanger: false, curPower: 100, tgtPower: 20 })).toBe(false);
  });

  it('allows a safe (non-downgrade) swap even in danger', () => {
    expect(blockGearSwap({ inDanger: true, curPower: 100, tgtPower: 100 })).toBe(false);
    expect(blockGearSwap({ inDanger: true, curPower: 40, tgtPower: 200 })).toBe(false);
  });

  it('coerces a truthy non-boolean inDanger', () => {
    expect(blockGearSwap({ inDanger: 1, curPower: 100, tgtPower: 0 })).toBe(true);
  });

  it('treats missing args as no block', () => {
    expect(blockGearSwap()).toBe(false);
  });
});
