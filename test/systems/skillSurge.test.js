import { describe, it, expect } from 'vitest';
import {
  activeArchetype, activeSurgePerks, applySurgeCastMods, surgeHasteFrac,
  SURGE_MILESTONE_RANKS,
} from '../../src/systems/skillSurge.js';
import { ACTIVE_SURGE_ARCHETYPES, ACTIVE_SURGE_OVERRIDES } from '../../src/data/skillSurges.js';

describe('activeArchetype classification', () => {
  it('sorts a summon before anything else', () => {
    expect(activeArchetype({ shape: 'summon', summon: { kind: 'skeleton', count: 2 } })).toBe('conjure');
    // even a damaging teleport that also summons is a conjure
    expect(activeArchetype({ shape: 'teleport', wpn: 1.9, summon: { kind: 'shadow' } })).toBe('conjure');
  });

  it('sorts a no-damage support cast by its effect', () => {
    expect(activeArchetype({ shape: 'self', buff: [{ id: 'dmgUp', dur: 6, mag: 0.7 }] })).toBe('ward');
    expect(activeArchetype({ shape: 'teleport', buff: [{ id: 'dodgeUp', dur: 6, mag: 0.4 }] })).toBe('blink');
    expect(activeArchetype({ shape: 'self', heal: { flat: 40 } })).toBe('mend');
  });

  it('sorts damaging casts by shape', () => {
    expect(activeArchetype({ shape: 'chain', spell: 1, chain: 3 })).toBe('arc');
    expect(activeArchetype({ shape: 'line', wpn: 2.2, range: 7 })).toBe('lance');
    expect(activeArchetype({ shape: 'random', wpn: 1, count: 3 })).toBe('storm');
    expect(activeArchetype({ shape: 'blast', spell: 2, radius: 3, range: 6 })).toBe('siege');
    expect(activeArchetype({ shape: 'cleave', wpn: 1.5 })).toBe('cleave');
  });

  it('splits a nova on whether it inflicts a status', () => {
    expect(activeArchetype({ shape: 'nova', wpn: 2.2, radius: 2 })).toBe('burst');
    expect(activeArchetype({ shape: 'nova', spell: 1.6, radius: 3, status: { effect: 'burn', dur: 4, chance: 1 } })).toBe('affliction');
  });

  it('routes execute/crit single-target strikes to assassinate', () => {
    expect(activeArchetype({ shape: 'bolt', wpn: 4.5, crit: true, range: 7 })).toBe('assassinate');
    expect(activeArchetype({ shape: 'melee', wpn: 2.6, execute: 0.3, crit: true })).toBe('assassinate');
    expect(activeArchetype({ shape: 'teleport', wpn: 2.6, execute: 0.4 })).toBe('assassinate');
    // a plain damaging teleport (no execute/crit) is still an assassination by shape
    expect(activeArchetype({ shape: 'teleport', wpn: 1.9 })).toBe('assassinate');
  });

  it('routes a multi-hit melee to flurry, a plain one to strike', () => {
    expect(activeArchetype({ shape: 'melee', wpn: 1.5, repeat: 3 })).toBe('flurry');
    expect(activeArchetype({ shape: 'melee', wpn: 2.0 })).toBe('strike');
  });

  it('routes a plain bolt to bolt', () => {
    expect(activeArchetype({ shape: 'bolt', spell: 1.5, range: 6 })).toBe('bolt');
  });

  it('falls back sensibly for a missing/garbage cast', () => {
    expect(activeArchetype(null)).toBe('strike');
    expect(activeArchetype(undefined)).toBe('strike');
    expect(activeArchetype({})).toBe('ward');              // no damage, no heal/teleport → treated as a support cast
    expect(activeArchetype({ shape: 'weird', wpn: 1 })).toBe('strike'); // damage with an unknown shape → default
  });
});

describe('activeSurgePerks resolution', () => {
  it('returns null for a node with no cast (a passive)', () => {
    expect(activeSurgePerks({ id: 'w_p00', type: 'passive' })).toBeNull();
    expect(activeSurgePerks(null)).toBeNull();
  });

  it('resolves the archetype perks for a normal active', () => {
    const r = activeSurgePerks({ id: 'r_a30', cast: { shape: 'bolt', wpn: 1.2, spell: 0.9, crit: true, range: 6 } });
    expect(r.archetype).toBe('assassinate');
    expect(r.perks).toBe(ACTIVE_SURGE_ARCHETYPES.assassinate);
  });

  it('prefers a per-id override over the archetype default', () => {
    const r = activeSurgePerks({ id: 'b_warbringer', cast: { shape: 'nova', wpn: 3, radius: 4, execute: 0.3, status: { effect: 'poison', dur: 4, chance: 1 } } });
    expect(r.perks).toBe(ACTIVE_SURGE_OVERRIDES.b_warbringer);
  });
});

describe('applySurgeCastMods', () => {
  it('returns the cast untouched below rank 3', () => {
    const cast = { shape: 'chain', chain: 3 };
    const perks = ACTIVE_SURGE_ARCHETYPES.arc;
    expect(applySurgeCastMods(cast, 2, perks)).toBe(cast); // same reference — nothing applied
    expect(applySurgeCastMods(cast, 0, perks)).toBe(cast);
  });

  it('never mutates the input cast or its nested objects', () => {
    const cast = { shape: 'nova', radius: 3, status: { effect: 'burn', dur: 4, chance: 0.7 } };
    const snapshot = JSON.parse(JSON.stringify(cast));
    applySurgeCastMods(cast, 10, ACTIVE_SURGE_ARCHETYPES.affliction);
    expect(cast).toEqual(snapshot);
  });

  it('accumulates reach across earned milestones (arc chain)', () => {
    const perks = ACTIVE_SURGE_ARCHETYPES.arc; // 3:+1 chain, 7:haste, 10:+2 chain
    expect(applySurgeCastMods({ shape: 'chain', chain: 3 }, 3, perks).chain).toBe(4);
    expect(applySurgeCastMods({ shape: 'chain', chain: 3 }, 7, perks).chain).toBe(4);
    expect(applySurgeCastMods({ shape: 'chain', chain: 3 }, 10, perks).chain).toBe(6);
  });

  it('grows a summon count and lifespan (conjure)', () => {
    const perks = ACTIVE_SURGE_ARCHETYPES.conjure; // 3:+6 ttl, 7:haste+4 ttl, 10:+1 count
    const out = applySurgeCastMods({ shape: 'summon', summon: { kind: 'skeleton', count: 2, ttl: 22 } }, 10, perks);
    expect(out.summon.count).toBe(3);
    expect(out.summon.ttl).toBe(22 + 6 + 4);
  });

  it('lifts and clamps a status (affliction)', () => {
    const out = applySurgeCastMods({ shape: 'nova', radius: 3, status: { effect: 'burn', dur: 4, chance: 0.7 } }, 10, ACTIVE_SURGE_ARCHETYPES.affliction);
    expect(out.radius).toBe(4);              // +1 at rank 10
    expect(out.status.dur).toBe(8);          // +2 (rank 7) +2 (rank 10)
    expect(out.status.chance).toBeCloseTo(0.85, 10); // +0.15, still under 1
    // chance never exceeds 1
    const capped = applySurgeCastMods({ shape: 'nova', radius: 3, status: { effect: 'burn', dur: 4, chance: 0.95 } }, 3, ACTIVE_SURGE_ARCHETYPES.affliction);
    expect(capped.status.chance).toBe(1);
  });

  it('strengthens and lengthens a buff without mutating the source (ward)', () => {
    const cast = { shape: 'self', buff: [{ id: 'dmgUp', dur: 6, mag: 0.7 }] };
    const out = applySurgeCastMods(cast, 10, ACTIVE_SURGE_ARCHETYPES.ward);
    expect(out.buff[0].mag).toBeCloseTo(0.84, 6); // ×1.2 at rank 3
    expect(out.buff[0].dur).toBe(6 + 3 + 4);       // +3 (rank 7) +4 (rank 10)
    expect(cast.buff[0].mag).toBe(0.7);            // source intact
  });

  it('scales a heal (mend)', () => {
    const out = applySurgeCastMods({ shape: 'self', heal: { flat: 25, perLevel: 2 } }, 10, ACTIVE_SURGE_ARCHETYPES.mend);
    // rank 3 ×1.2 then rank 10 ×1.3
    expect(out.heal.flat).toBe(Math.round(Math.round(25 * 1.2) * 1.3));
  });

  it('raises an execute threshold with Math.max (assassinate)', () => {
    const out = applySurgeCastMods({ shape: 'teleport', wpn: 2, execute: 0.3, range: 7 }, 10, ACTIVE_SURGE_ARCHETYPES.assassinate);
    expect(out.execute).toBe(0.35);   // max(0.3, 0.35)
    expect(out.range).toBe(9);        // +1 (rank 3) +1 (rank 10)
    // a lower incoming execute is raised; a higher one is kept
    const kept = applySurgeCastMods({ shape: 'melee', wpn: 2, execute: 0.4 }, 10, ACTIVE_SURGE_ARCHETYPES.assassinate);
    expect(kept.execute).toBe(0.4);
  });

  it('no-ops a mod whose target field is absent', () => {
    // conjure's summonCount on a cast with no summon touches nothing
    const cast = { shape: 'bolt', range: 6 };
    const out = applySurgeCastMods(cast, 10, ACTIVE_SURGE_ARCHETYPES.conjure);
    expect(out.summon).toBeUndefined();
  });

  it('applies the full mod vocabulary from a synthetic perk table', () => {
    // Exercises every lever at once (pull / crit / count / lifesteal / detonate /
    // a single-object buff / heal.pctDmg) on one cast.
    const perks = {
      3: { desc: 'x', mods: { count: 1, lifesteal: 0.1, buffMag: 0.5 } },
      7: { desc: 'y', mods: { detonate: 0.5, healMul: 0.2 } },
      10: { desc: 'z', mods: { pull: true, crit: true, count: 2 } },
    };
    const cast = {
      shape: 'random', count: 3, wpn: 1,
      buff: { id: 'dmgUp', dur: 6, mag: 0.4 },   // single object, not an array
      heal: { pctDmg: 0.2 }, detonate: 1,
    };
    const out = applySurgeCastMods(cast, 10, perks);
    expect(out.count).toBe(6);                     // 3 + 1 + 2
    expect(out.lifesteal).toBeCloseTo(0.1, 10);
    expect(out.detonate).toBeCloseTo(1.5, 10);
    expect(out.pull).toBe(true);
    expect(out.crit).toBe(true);
    expect(Array.isArray(out.buff)).toBe(true);    // normalised to an array
    expect(out.buff[0].mag).toBeCloseTo(0.6, 6);   // ×1.5
    expect(out.heal.pctDmg).toBeCloseTo(0.24, 6);  // ×1.2
    expect(cast.pull).toBeUndefined();             // source never mutated
  });
});

describe('surgeHasteFrac', () => {
  it('is 0 below the first haste milestone', () => {
    expect(surgeHasteFrac(2, ACTIVE_SURGE_ARCHETYPES.arc)).toBe(0);
    expect(surgeHasteFrac(6, ACTIVE_SURGE_ARCHETYPES.arc)).toBe(0); // arc's haste is at rank 7
  });

  it('sums the recharge fractions of every earned milestone', () => {
    expect(surgeHasteFrac(7, ACTIVE_SURGE_ARCHETYPES.arc)).toBeCloseTo(0.15, 10);
    // strike stacks a rank-3 and a rank-10 haste
    expect(surgeHasteFrac(3, ACTIVE_SURGE_ARCHETYPES.strike)).toBeCloseTo(0.12, 10);
    expect(surgeHasteFrac(10, ACTIVE_SURGE_ARCHETYPES.strike)).toBeCloseTo(0.12 + 0.15, 10);
  });

  it('is 0 for an archetype that trades recharge away (ward has haste only at 10)', () => {
    expect(surgeHasteFrac(7, ACTIVE_SURGE_ARCHETYPES.ward)).toBe(0);
    expect(surgeHasteFrac(10, ACTIVE_SURGE_ARCHETYPES.ward)).toBeCloseTo(0.20, 10);
  });

  it('is 0 with no perks', () => {
    expect(surgeHasteFrac(10, null)).toBe(0);
  });
});

describe('SURGE_MILESTONE_RANKS', () => {
  it('is the three milestone ranks', () => {
    expect(SURGE_MILESTONE_RANKS).toEqual([3, 7, 10]);
  });
});
