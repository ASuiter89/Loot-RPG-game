import { describe, it, expect } from 'vitest';
import { SKILL_MILESTONES } from '../../src/data/skillMilestones.js';
import { milestonePower, passiveMilestonePower } from '../../src/systems/skillMath.js';

describe('SKILL_MILESTONES data validity', () => {
  it('is exactly the three rank 3 / 7 / 10 milestones, ascending', () => {
    expect(SKILL_MILESTONES.map(m => m.rank)).toEqual([3, 7, 10]);
  });

  it('every entry has the full { rank, pips, name, perk, activeDesc, passiveDesc } shape', () => {
    for (const [i, m] of SKILL_MILESTONES.entries()) {
      expect(typeof m.rank, `entry ${i} rank`).toBe('number');
      for (const k of ['pips', 'name', 'perk', 'activeDesc', 'passiveDesc']) {
        expect(typeof m[k], `entry ${i} ${k}`).toBe('string');
        expect(m[k].length, `entry ${i} ${k} non-empty`).toBeGreaterThan(0);
      }
    }
  });

  it('pips escalate ✦ → ✦✦ → ✦✦✦ (one per milestone reached)', () => {
    expect(SKILL_MILESTONES.map(m => m.pips)).toEqual(['✦', '✦✦', '✦✦✦']);
  });

  it('each milestone rank is a real power breakpoint for actives AND passives', () => {
    // The presentation table must line up with where the math actually spikes
    // (src/systems/skillMath.js): crossing INTO a milestone rank raises power, and
    // the rank just below it does not. Guards the copy from drifting out of sync
    // with the numbers should the breakpoints ever move.
    for (const m of SKILL_MILESTONES) {
      expect(milestonePower(m.rank), `active spike at rank ${m.rank}`)
        .toBeGreaterThan(milestonePower(m.rank - 1));
      expect(passiveMilestonePower(m.rank), `passive spike at rank ${m.rank}`)
        .toBeGreaterThan(passiveMilestonePower(m.rank - 1));
    }
  });

  it("doesn't leak the pips glyph into the descriptions (rendered separately)", () => {
    for (const m of SKILL_MILESTONES) {
      expect(m.activeDesc.includes('✦'), `${m.name} activeDesc`).toBe(false);
      expect(m.passiveDesc.includes('✦'), `${m.name} passiveDesc`).toBe(false);
    }
  });
});
