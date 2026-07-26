import { describe, it, expect } from 'vitest';
import {
  rampDepth, featureUnlocked, unlockedSkillSlots,
  elitesAllowed, gearRequirementsActive, setItemsAllowed, cursedItemsAllowed,
  uniqueItemsAllowed, loadoutSwapUnlocked, detailedTooltips,
  hazardAllowed, earlyEnemyHp, playerEarlyDamage, earlyPackCap,
  firstHint, keeperIntro, starterChain, tip, deathTip, rampStatus, potionTeachDue,
} from '../../src/systems/onboarding.js';
import { RAMP_FLOOR, TIPS, HINTS, STARTER_STEPS, BEACH_POTION_HP_FRAC } from '../../src/data/onboarding.js';

describe('rampDepth', () => {
  it('coerces to an integer floor ≥ 1', () => {
    expect(rampDepth(7)).toBe(7);
    expect(rampDepth(7.9)).toBe(7);
    expect(rampDepth(1)).toBe(1);
  });
  it('treats a missing/garbage value as the most-gated floor 1', () => {
    expect(rampDepth(undefined)).toBe(1);
    expect(rampDepth(NaN)).toBe(1);
    expect(rampDepth(0)).toBe(1);
    expect(rampDepth(-5)).toBe(1);
    expect(rampDepth('nope')).toBe(1);
  });
});

describe('featureUnlocked', () => {
  it('gates a known feature on its schedule floor', () => {
    expect(featureUnlocked('loadoutSwap', 19)).toBe(false);
    expect(featureUnlocked('loadoutSwap', 20)).toBe(true);
    expect(featureUnlocked('loadoutSwap', 40)).toBe(true);
  });
  it('treats an unknown feature as ungated (always available)', () => {
    expect(featureUnlocked('totallyMadeUp', 1)).toBe(true);
  });
});

describe('unlockedSkillSlots', () => {
  it('reveals slots as the hero descends', () => {
    expect(unlockedSkillSlots(1)).toBe(1);
    expect(unlockedSkillSlots(2)).toBe(1);
    expect(unlockedSkillSlots(3)).toBe(2);
    expect(unlockedSkillSlots(7)).toBe(2);
    expect(unlockedSkillSlots(8)).toBe(3);
    expect(unlockedSkillSlots(13)).toBe(4);
    expect(unlockedSkillSlots(30)).toBe(4);
  });
  it('never exceeds four and never drops below one', () => {
    expect(unlockedSkillSlots(0)).toBe(1);
    expect(unlockedSkillSlots(999)).toBe(4);
  });
});

describe('content-kind gates', () => {
  it('elites begin on floor 4', () => {
    expect(elitesAllowed(3)).toBe(false);
    expect(elitesAllowed(4)).toBe(true);
  });
  it('gear requirements lift below floor 5', () => {
    expect(gearRequirementsActive(4)).toBe(false);
    expect(gearRequirementsActive(5)).toBe(true);
  });
  it('set/cursed/unique stagger in order', () => {
    expect(setItemsAllowed(7)).toBe(false);
    expect(setItemsAllowed(8)).toBe(true);
    expect(cursedItemsAllowed(9)).toBe(false);
    expect(cursedItemsAllowed(10)).toBe(true);
    expect(uniqueItemsAllowed(11)).toBe(false);
    expect(uniqueItemsAllowed(12)).toBe(true);
    // The schedule keeps them in the intended sequence.
    expect(RAMP_FLOOR.setItems).toBeLessThan(RAMP_FLOOR.cursedItems);
    expect(RAMP_FLOOR.cursedItems).toBeLessThan(RAMP_FLOOR.uniqueItems);
  });
  it('the second loadout waits for floor 20 and detailed tooltips for floor 10', () => {
    expect(loadoutSwapUnlocked(19)).toBe(false);
    expect(loadoutSwapUnlocked(20)).toBe(true);
    expect(detailedTooltips(9)).toBe(false);
    expect(detailedTooltips(10)).toBe(true);
  });
});

describe('hazardAllowed', () => {
  it('gates a known hazard kind on its intro floor', () => {
    expect(hazardAllowed('spikes', 2)).toBe(false);
    expect(hazardAllowed('spikes', 3)).toBe(true);
    expect(hazardAllowed('fireVent', 8)).toBe(false);
    expect(hazardAllowed('fireVent', 9)).toBe(true);
  });
  it('allows an unknown hazard kind everywhere', () => {
    expect(hazardAllowed('mystery', 1)).toBe(true);
  });
});

describe('earlyEnemyHp / earlyPackCap', () => {
  it('toughens foes on the opening floors, then bows out to full strength', () => {
    expect(earlyEnemyHp(1)).toBeGreaterThan(1);
    expect(earlyEnemyHp(5)).toBeGreaterThan(1);
    expect(earlyEnemyHp(6)).toBe(1);
    expect(earlyEnemyHp(20)).toBe(1);
  });
  it('never eases HP below full strength (it is a boost, never a relief)', () => {
    for (let f = 1; f <= 8; f++) expect(earlyEnemyHp(f)).toBeGreaterThanOrEqual(1);
  });
  it('the HP boost eases downward toward full strength as the hero descends', () => {
    expect(earlyEnemyHp(1)).toBeGreaterThanOrEqual(earlyEnemyHp(5));
  });
  it('caps early pack size, then uncaps', () => {
    expect(earlyPackCap(1)).toBe(3);
    expect(earlyPackCap(5)).toBe(7);
    expect(earlyPackCap(6)).toBeNull();
  });
});

describe('playerEarlyDamage', () => {
  it('softens the hero hit on the opening floors, then bows out to full strength', () => {
    expect(playerEarlyDamage(1)).toBeLessThan(1);
    expect(playerEarlyDamage(5)).toBeLessThan(1);
    expect(playerEarlyDamage(6)).toBe(1);
    expect(playerEarlyDamage(20)).toBe(1);
  });
  it('never lifts the hero hit above full strength (it is a ramp, never a boost)', () => {
    for (let f = 1; f <= 8; f++) expect(playerEarlyDamage(f)).toBeLessThanOrEqual(1);
  });
  it('ramps upward toward full strength as the hero descends', () => {
    expect(playerEarlyDamage(1)).toBeLessThan(playerEarlyDamage(5));
  });
  it('treats a missing/garbage floor as the most-gated floor 1', () => {
    expect(playerEarlyDamage(undefined)).toBe(playerEarlyDamage(1));
    expect(playerEarlyDamage(0)).toBe(playerEarlyDamage(1));
  });
});

describe('firstHint', () => {
  it('returns the hint payload the first time', () => {
    const h = firstHint('descend', {});
    expect(h).toBeTruthy();
    expect(h.id).toBe('descend');
    expect(typeof h.text).toBe('string');
  });
  it('returns null once taught', () => {
    expect(firstHint('descend', { descend: true })).toBeNull();
  });
  it('returns null for an unknown id, and tolerates a missing taught bag', () => {
    expect(firstHint('nope', {})).toBeNull();
    expect(firstHint('descend', null)).toBeTruthy();
  });
});

describe('keeperIntro', () => {
  it('returns the intro the first time, keyed under intro_<kind>', () => {
    const k = keeperIntro('weave', {});
    expect(k).toBeTruthy();
    expect(k.key).toBe('intro_weave');
    expect(typeof k.title).toBe('string');
  });
  it('returns null once shown or for an unknown kind', () => {
    expect(keeperIntro('weave', { intro_weave: true })).toBeNull();
    expect(keeperIntro('nope', {})).toBeNull();
    expect(keeperIntro('weave', null)).toBeTruthy();
  });
});

describe('starterChain', () => {
  it('marks the first unfinished step active', () => {
    const c = starterChain({ kill: true });
    expect(c.steps[0].done).toBe(true);
    expect(c.steps[1].done).toBe(false);
    expect(c.activeIndex).toBe(1);
    expect(c.complete).toBe(false);
  });
  it('reports completion when every step is done', () => {
    const ctx = {};
    for (const s of STARTER_STEPS) ctx[s.id] = true;
    const c = starterChain(ctx);
    expect(c.complete).toBe(true);
    expect(c.activeIndex).toBe(-1);
  });
  it('tolerates a missing context (all steps pending)', () => {
    const c = starterChain();
    expect(c.activeIndex).toBe(0);
    expect(c.complete).toBe(false);
  });
});

describe('tip / deathTip', () => {
  it('wraps the index in both directions', () => {
    expect(tip(0)).toBe(TIPS[0]);
    expect(tip(TIPS.length)).toBe(TIPS[0]);
    expect(tip(-1)).toBe(TIPS[TIPS.length - 1]);
    expect(typeof tip(NaN)).toBe('string');
  });
  it('death tip prefers the cause-specific lesson', () => {
    expect(deathTip('lava', 0)).toMatch(/[Ll]ava/);
    // Unknown cause falls back to a rotating tip.
    expect(deathTip('unknown-cause', 0)).toBe(TIPS[0]);
    expect(deathTip(null, 1)).toBe(TIPS[1]);
    // Index defaults to 0 when omitted.
    expect(deathTip(null)).toBe(TIPS[0]);
  });
});

describe('potionTeachDue', () => {
  // The beat used to fire on the FIRST blow landed, pausing the world over a
  // scratch. It now waits for a wound worth healing.
  it('holds off while the hero is barely scratched', () => {
    expect(potionTeachDue(100, 100)).toBe(false);
    expect(potionTeachDue(80, 100)).toBe(false);
  });

  it('arms once Health reaches the threshold', () => {
    expect(potionTeachDue(75, 100)).toBe(true);
    expect(potionTeachDue(40, 100)).toBe(true);
    expect(potionTeachDue(1, 100)).toBe(true);
  });

  it('reads the threshold from the schedule, not a hardcoded 75%', () => {
    const maxHp = 200, at = maxHp * BEACH_POTION_HP_FRAC;
    expect(potionTeachDue(at + 1, maxHp)).toBe(false);
    expect(potionTeachDue(at, maxHp)).toBe(true);
  });

  // A killing blow is not a teaching moment — the death screen's tip covers it and
  // the shore is about to rebuild.
  it('never arms on a lethal blow', () => {
    expect(potionTeachDue(0, 100)).toBe(false);
    expect(potionTeachDue(-5, 100)).toBe(false);
  });

  it('refuses a missing or garbage pool rather than throwing', () => {
    for (const [hp, maxHp] of [[10, 0], [10, undefined], [undefined, 100], [NaN, 100], [10, NaN]]) {
      expect(potionTeachDue(hp, maxHp)).toBe(false);
    }
  });
});

describe('rampStatus', () => {
  it('summarises the gated state at a depth', () => {
    const early = rampStatus(1);
    expect(early.depth).toBe(1);
    expect(early.skillSlots).toBe(1);
    expect(early.elites).toBe(false);
    expect(early.loadoutSwap).toBe(false);
    const deep = rampStatus(50);
    expect(deep.skillSlots).toBe(4);
    expect(deep.elites).toBe(true);
    expect(deep.loadoutSwap).toBe(true);
    expect(deep.detailedTooltips).toBe(true);
  });
});

// Sanity: every hint referenced by the systems layer carries text.
describe('HINTS data', () => {
  it('every hint has non-empty text', () => {
    for (const [id, h] of Object.entries(HINTS)) {
      expect(typeof h.text, id).toBe('string');
      expect(h.text.length, id).toBeGreaterThan(0);
    }
  });
});
