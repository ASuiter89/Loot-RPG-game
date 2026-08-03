import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../../src/utils/rng.js';
import { MIRRORFORGE } from '../../src/data/mirrorforge.js';
import { curseTierMult, statCurseSwing } from '../../src/systems/curseRoll.js';
import {
  fpBudget, fpSpent, fpRemaining, fpCost, matCost, canApply,
  applyAttune, applyExalt, applyDivine, applyCorrupt,
  canMirror, applyMirror, shatterToAttunement,
  radiantChance, rollRadiant, aetherUnlocked,
} from '../../src/systems/mirrorforge.js';

// A synthetic item on the minimal contract, with an unknown field (`heirloom`) we
// assert survives EVERY action, plus a per-affix unknown field (`spr`).
function mkItem(over = {}) {
  return {
    tier: 'legendary', rank: 5, ilvl: 80,
    affixes: [
      { key: 'ATK', val: 20, min: 10, max: 40, spr: 'ic_atk' },
      { key: 'HP', val: 100, min: 50, max: 200 },
      { key: 'CRIT', val: 5, min: 5, max: 5 }, // a zero-width band (min===max) edge
    ],
    heirloom: 'grandpa', // unknown top-level field — must be preserved
    ...over,
  };
}

describe('FP budget / spend / remaining', () => {
  it('computes base + perRank·rank + perIlvl·ilvl', () => {
    expect(fpBudget(mkItem())).toBe(100 + 20 * 5 + 2 * 80); // 360
  });
  it('reads spent off _fpSpent (default 0) and clamps garbage', () => {
    expect(fpSpent(mkItem())).toBe(0);
    expect(fpSpent(mkItem({ _fpSpent: 40 }))).toBe(40);
    expect(fpSpent(mkItem({ _fpSpent: -5 }))).toBe(0);
    expect(fpSpent(mkItem({ _fpSpent: 12.9 }))).toBe(12);
    expect(fpSpent(null)).toBe(0);
  });
  it('remaining is budget − spent, never negative', () => {
    expect(fpRemaining(mkItem({ _fpSpent: 100 }))).toBe(260);
    expect(fpRemaining(mkItem({ _fpSpent: 9999 }))).toBe(0);
  });
  it('handles garbage rank/ilvl gracefully (clamped to 0)', () => {
    expect(fpBudget({ rank: NaN, ilvl: undefined })).toBe(100);
    expect(fpBudget(null)).toBe(100);
    expect(fpBudget({ rank: -3, ilvl: -9 })).toBe(100);
  });
  it('honours a custom tuning object', () => {
    expect(fpBudget(mkItem(), { fp: { base: 0, perRank: 10, perIlvl: 1 } })).toBe(10 * 5 + 80);
  });
});

describe('cost lookups', () => {
  it('fpCost reads the action fp; unknown/mirror → 0', () => {
    expect(fpCost('exalt', mkItem())).toBe(MIRRORFORGE.costs.exalt.fp);
    expect(fpCost('mirror', mkItem())).toBe(0);
    expect(fpCost('bogus', mkItem())).toBe(0);
  });
  it('matCost returns a COPY of the mats bill; unknown → {}', () => {
    const m = matCost('mirror');
    expect(m.aether).toBe(MIRRORFORGE.costs.mirror.mats.aether);
    m.aether = 999; // mutating the copy must not poison the tuning data
    expect(MIRRORFORGE.costs.mirror.mats.aether).not.toBe(999);
    expect(matCost('bogus')).toEqual({});
  });
});

describe('canApply gate', () => {
  const wallet = { scrap: 1000, glimmer: 1000, core: 1000, chaos: 1000, aether: 100 };
  it('ok when FP + materials are sufficient', () => {
    expect(canApply('exalt', mkItem(), 360, wallet)).toEqual({ ok: true, reason: '' });
  });
  it('rejects an unknown action', () => {
    expect(canApply('bogus', mkItem(), 360, wallet).reason).toBe('unknown');
  });
  it('rejects a mirrored or sealed item (locked)', () => {
    expect(canApply('exalt', mkItem({ mirrored: true }), 360, wallet).reason).toBe('mirrored');
    expect(canApply('exalt', mkItem({ sealed: true }), 360, wallet).reason).toBe('sealed');
  });
  it('rejects insufficient FP', () => {
    expect(canApply('exalt', mkItem(), 1, wallet).reason).toBe('fp');
  });
  it('rejects insufficient materials (incl. a null wallet)', () => {
    expect(canApply('exalt', mkItem(), 360, { scrap: 0 }).reason).toBe('mats');
    expect(canApply('exalt', mkItem(), 360, null).reason).toBe('mats');
  });
});

describe('FP depletes across an action sequence', () => {
  it('each successful action adds its FP cost to _fpSpent, remaining falls to 0', () => {
    let it = mkItem(); // 360 budget
    expect(fpRemaining(it)).toBe(360);
    it = applyAttune(it, 'ATK', mulberry32(1));       // -40 → 320
    expect(fpSpent(it)).toBe(40);
    it = applyExalt(it, 0);                            // -55 → 265
    expect(fpSpent(it)).toBe(95);
    it = applyDivine(it, 1, false, mulberry32(2));     // -70 → 195
    expect(fpSpent(it)).toBe(165);
    expect(fpRemaining(it)).toBe(360 - 165);
    it = applyCorrupt(it, mulberry32(3));              // -90 → 105
    expect(fpSpent(it)).toBe(255);
    expect(fpRemaining(it)).toBe(360 - 255);
  });
});

describe('ATTUNE — guarantees the target key rolls strong', () => {
  it('the targeted affix always lands in the top half of its band, across seeds', () => {
    for (let s = 0; s < 50; s++) {
      const out = applyAttune(mkItem(), 'ATK', mulberry32(s));
      const atk = out.affixes.find(a => a.key === 'ATK');
      // band [10,40], floor 0.5 → guaranteed ≥ 25
      expect(atk.val).toBeGreaterThanOrEqual(25);
      expect(atk.val).toBeLessThanOrEqual(40);
    }
  });
  it('non-targeted affixes reroll across their FULL band', () => {
    const out = applyAttune(mkItem(), 'ATK', mulberry32(7));
    const hp = out.affixes.find(a => a.key === 'HP');
    expect(hp.val).toBeGreaterThanOrEqual(50);
    expect(hp.val).toBeLessThanOrEqual(200);
  });
  it('a zero-width band (min===max) is pinned to that value', () => {
    const out = applyAttune(mkItem(), 'CRIT', mulberry32(1));
    expect(out.affixes.find(a => a.key === 'CRIT').val).toBe(5);
  });
  it('is deterministic under a seeded rng', () => {
    const a = applyAttune(mkItem(), 'HP', mulberry32(99));
    const b = applyAttune(mkItem(), 'HP', mulberry32(99));
    expect(a.affixes).toEqual(b.affixes);
  });
  it('does not mutate the input and preserves unknown fields', () => {
    const src = mkItem();
    const out = applyAttune(src, 'ATK', mulberry32(1));
    expect(src.affixes[0].val).toBe(20);       // input untouched
    expect(out.heirloom).toBe('grandpa');       // unknown top-level survives
    expect(out.affixes[0].spr).toBe('ic_atk');  // unknown per-affix survives
    expect(out).not.toBe(src);
  });
  it('tolerates a null/undefined rng (defaults to low roll)', () => {
    const out = applyAttune(mkItem(), 'ATK', null);
    expect(out.affixes.find(a => a.key === 'ATK').val).toBe(25); // lo end of top half
  });
});

describe('EXALT — monotonic toward max, never exceeds', () => {
  it('halves the gap to max each cast and converges without overshooting', () => {
    let it = mkItem(); // ATK 20 / max 40
    const seen = [];
    for (let i = 0; i < 12; i++) { it = applyExalt(it, 0); seen.push(it.affixes[0].val); }
    // Non-decreasing and always ≤ max.
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    for (const v of seen) expect(v).toBeLessThanOrEqual(40);
    expect(seen[seen.length - 1]).toBe(40); // converges exactly to the ceiling
  });
  it('first cast closes exactly half the gap (20 → 30)', () => {
    expect(applyExalt(mkItem(), 0).affixes[0].val).toBe(30);
  });
  it('a value already at/over max is left unchanged (never decreases)', () => {
    const at = applyExalt(mkItem({ affixes: [{ key: 'X', val: 40, min: 0, max: 40 }] }), 0);
    expect(at.affixes[0].val).toBe(40);
    const over = applyExalt(mkItem({ affixes: [{ key: 'X', val: 55, min: 0, max: 40 }] }), 0);
    expect(over.affixes[0].val).toBe(55); // garbage over-max preserved, not reduced
  });
  it('an invalid index is a graceful no-op and burns no FP', () => {
    const out = applyExalt(mkItem(), 99);
    expect(fpSpent(out)).toBe(0);
    expect(out.affixes[0].val).toBe(20);
    expect(applyExalt(mkItem(), -1).affixes[0].val).toBe(20);
  });
  it('honours a custom exalt fraction', () => {
    const out = applyExalt(mkItem(), 0, { ...MIRRORFORGE, exaltFraction: 1 }); // straight to max
    expect(out.affixes[0].val).toBe(40);
  });
  it('does not mutate input, preserves unknowns', () => {
    const src = mkItem();
    const out = applyExalt(src, 0);
    expect(src.affixes[0].val).toBe(20);
    expect(out.heirloom).toBe('grandpa');
  });
});

describe('DIVINE — in-band reroll; Aether snaps to top decile', () => {
  it('a plain reroll stays within [min,max]', () => {
    for (let s = 0; s < 50; s++) {
      const v = applyDivine(mkItem(), 0, false, mulberry32(s)).affixes[0].val;
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThanOrEqual(40);
    }
  });
  it('with Aether the roll lands in the top decile [min+0.9·range, max]', () => {
    for (let s = 0; s < 50; s++) {
      const v = applyDivine(mkItem(), 0, true, mulberry32(s)).affixes[0].val;
      // band [10,40] → top decile ≥ 37
      expect(v).toBeGreaterThanOrEqual(37);
      expect(v).toBeLessThanOrEqual(40);
    }
  });
  it('a zero-width band is pinned', () => {
    expect(applyDivine(mkItem(), 2, true, mulberry32(1)).affixes[2].val).toBe(5);
  });
  it('invalid index → graceful no-op, no FP burn', () => {
    expect(fpSpent(applyDivine(mkItem(), 42, false, mulberry32(1)))).toBe(0);
  });
  it('is deterministic and preserves input + unknowns', () => {
    const src = mkItem();
    const a = applyDivine(src, 1, false, mulberry32(5));
    const b = applyDivine(mkItem(), 1, false, mulberry32(5));
    expect(a.affixes[1].val).toBe(b.affixes[1].val);
    expect(src.affixes[1].val).toBe(100);
    expect(a.heirloom).toBe('grandpa');
  });
  it('honours a custom aether decile', () => {
    // decile 0.5 → roll in [25,40]; still ≥ 25 for any seed
    for (let s = 0; s < 20; s++) {
      const v = applyDivine(mkItem(), 0, true, mulberry32(s), { ...MIRRORFORGE, aetherDecile: 0.5 }).affixes[0].val;
      expect(v).toBeGreaterThanOrEqual(25);
    }
  });
});

describe('CORRUPT — seeded outcomes, always sealed, never null', () => {
  it('always returns an item, always sealed, never destroyed', () => {
    for (let s = 0; s < 60; s++) {
      const out = applyCorrupt(mkItem(), mulberry32(s));
      expect(out).toBeTruthy();
      expect(out.sealed).toBe(true);
      expect(Array.isArray(out.affixes)).toBe(true);
    }
  });
  it('burns Corrupt FP and records the outcome id', () => {
    const out = applyCorrupt(mkItem(), mulberry32(1));
    expect(fpSpent(out)).toBe(MIRRORFORGE.costs.corrupt.fp);
    expect(typeof out._corrupt).toBe('string');
  });
  it('is deterministic under a seed', () => {
    const a = applyCorrupt(mkItem(), mulberry32(3));
    const b = applyCorrupt(mkItem(), mulberry32(3));
    expect(a).toEqual(b);
  });
  it('exercises every outcome kind across seeds', () => {
    const ids = new Set();
    for (let s = 0; s < 200; s++) ids.add(applyCorrupt(mkItem(), mulberry32(s))._corrupt);
    for (const id of ['blessing', 'radiant', 'signature', 'curse']) expect(ids.has(id)).toBe(true);
  });
  it('addAffix appends a bonus affix inside its band', () => {
    // Force the blessing outcome via a single-entry custom table.
    const data = { ...MIRRORFORGE, corruptOutcomes: [{ id: 'blessing', weight: 1, kind: 'addAffix', band: { min: 10, max: 40 } }] };
    const out = applyCorrupt(mkItem(), mulberry32(1), data);
    expect(out.affixes.length).toBe(4);
    const added = out.affixes[3];
    expect(added.val).toBeGreaterThanOrEqual(10);
    expect(added.val).toBeLessThanOrEqual(40);
    expect(added.corrupt).toBe(true);
  });
  it('radiant flags the item and lifts an affix into its top band', () => {
    const data = { ...MIRRORFORGE, corruptOutcomes: [{ id: 'radiant', weight: 1, kind: 'radiant' }] };
    const out = applyCorrupt(mkItem(), mulberry32(4), data);
    expect(out.radiant).toBe(true);
    // Some affix now sits at/above its 90% band mark (unless it was the zero-width one).
    const lifted = out.affixes.some(a => a.max > a.min && a.val >= a.min + (a.max - a.min) * 0.9);
    const pinned = out.affixes.some(a => a.max === a.min && a.val === a.min);
    expect(lifted || pinned).toBe(true);
  });
  it('signature brands the item with a power id', () => {
    const data = { ...MIRRORFORGE, corruptOutcomes: [{ id: 'sig', weight: 1, kind: 'signature', signature: 'mirrorbrand' }] };
    expect(applyCorrupt(mkItem(), mulberry32(1), data).signature).toBe('mirrorbrand');
  });
  it('signature falls back to the outcome id when none is given', () => {
    const data = { ...MIRRORFORGE, corruptOutcomes: [{ id: 'sig', weight: 1, kind: 'signature' }] };
    expect(applyCorrupt(mkItem(), mulberry32(1), data).signature).toBe('sig');
  });
  it('curse boosts one affix and adds an equally-strong penalty affix', () => {
    const data = { ...MIRRORFORGE, corruptOutcomes: [{ id: 'curse', weight: 1, kind: 'curse' }] };
    const out = applyCorrupt(mkItem(), mulberry32(2), data);
    expect(out.cursed).toBe(true);
    expect(typeof out.curseStat).toBe('string');
    const penalty = out.affixes.find(a => a.curse && a.val < 0);
    expect(penalty).toBeTruthy();
    // The penalty magnitude equals a curse swing sized off the boosted affix.
    const mult = curseTierMult('legendary');
    const boosted = out.affixes.find(a => a.key === out.curseStat);
    // Reconstruct the swing from the boosted affix's PRE-boost max is hard here;
    // instead assert the invariant the shared math guarantees: |penalty| ≥ 1.
    expect(Math.abs(penalty.val)).toBeGreaterThanOrEqual(1);
    expect(boosted.val).toBeGreaterThan(0);
    expect(mult).toBeGreaterThan(0);
  });
  it('curse magnitude matches statCurseSwing on the affix max (sizing check)', () => {
    // Single affix with a known max so we can predict the swing exactly.
    const item = { tier: 'legendary', rank: 5, ilvl: 80, affixes: [{ key: 'ATK', val: 20, min: 10, max: 40 }] };
    const data = { ...MIRRORFORGE, corruptOutcomes: [{ id: 'curse', weight: 1, kind: 'curse' }] };
    const out = applyCorrupt(item, mulberry32(1), data);
    const swing = statCurseSwing(40, curseTierMult('legendary'));
    const penalty = out.affixes.find(a => a.curse);
    expect(penalty.val).toBe(-swing);
  });
  it('curse on an item with NO affixes seals but does NOT flag it cursed', () => {
    // The contract lists only sculptable (unlocked) properties, so a headline-only
    // weapon or a fixed unique/set piece arrives with an empty list. There is nothing
    // to gift and nothing to charge for, so flagging it cursed would brand it with a
    // skull and zero drawback — a cursed item with no downside, which a curse must
    // never be. It still seals and still records the outcome; it just isn't a curse.
    const data = { ...MIRRORFORGE, corruptOutcomes: [{ id: 'curse', weight: 1, kind: 'curse' }] };
    const out = applyCorrupt({ tier: 'rare', rank: 3, ilvl: 10, affixes: [] }, mulberry32(1), data);
    expect(out.cursed).toBeFalsy();
    expect(out.curseStat).toBeUndefined();
    expect(out.sealed).toBe(true);
    expect(out._corrupt).toBe('curse');
    expect(out.affixes).toEqual([]);
  });

  it('never flags cursed without a real penalty affix, across seeds and affix counts', () => {
    const data = { ...MIRRORFORGE, corruptOutcomes: [{ id: 'curse', weight: 1, kind: 'curse' }] };
    const shapes = [
      [],
      [{ key: 'ATK', val: 20, min: 10, max: 40 }],
      [{ key: 'ATK', val: 20, min: 10, max: 40 }, { key: 'HP', val: 100, min: 50, max: 200 }],
    ];
    for (const affixes of shapes) {
      for (let s = 0; s < 30; s++) {
        const out = applyCorrupt({ tier: 'legendary', rank: 5, ilvl: 80, affixes: affixes.map(a => ({ ...a })) }, mulberry32(s), data);
        const penalty = out.affixes.find(a => a.curse && a.val < 0);
        expect(!!out.cursed).toBe(!!penalty);   // the flag follows the drawback, always
      }
    }
  });
  it('an unknown outcome kind still seals safely', () => {
    const data = { ...MIRRORFORGE, corruptOutcomes: [{ id: 'weird', weight: 1, kind: '???' }] };
    const out = applyCorrupt(mkItem(), mulberry32(1), data);
    expect(out.sealed).toBe(true);
    expect(out._corrupt).toBe('weird');
  });
  it('an empty outcome table still seals and burns FP, applies no effect', () => {
    const out = applyCorrupt(mkItem(), mulberry32(1), { ...MIRRORFORGE, corruptOutcomes: [] });
    expect(out.sealed).toBe(true);
    expect(out._corrupt).toBeUndefined();
    expect(fpSpent(out)).toBe(MIRRORFORGE.costs.corrupt.fp);
  });
  it('does not mutate input and preserves unknown fields', () => {
    const src = mkItem();
    const out = applyCorrupt(src, mulberry32(1));
    expect(src.sealed).toBeUndefined();
    expect(out.heirloom).toBe('grandpa');
  });
});

describe('MIRROR — lock a perfect copy', () => {
  it('canMirror ok on a fresh worked item', () => {
    expect(canMirror(mkItem(), 360)).toEqual({ ok: true, reason: '' });
  });
  it('rejects null / already-mirrored / sealed', () => {
    expect(canMirror(null, 360).reason).toBe('noitem');
    expect(canMirror(mkItem({ mirrored: true }), 360).reason).toBe('mirrored');
    expect(canMirror(mkItem({ sealed: true }), 360).reason).toBe('sealed');
  });
  it('rejects when FP remaining is below the mirror FP cost (custom tuning)', () => {
    const data = { ...MIRRORFORGE, costs: { ...MIRRORFORGE.costs, mirror: { fp: 50, mats: {} } } };
    expect(canMirror(mkItem(), 10, data).reason).toBe('fp');
    expect(canMirror(mkItem(), 50, data).ok).toBe(true);
  });
  it('applyMirror flags mirrored, preserves everything else, does not mutate', () => {
    const src = mkItem();
    const out = applyMirror(src);
    expect(out.mirrored).toBe(true);
    expect(src.mirrored).toBeUndefined();
    expect(out.heirloom).toBe('grandpa');
    expect(out.affixes[0].val).toBe(20);
  });
});

describe('SHATTER → Attunement (pity currency)', () => {
  it('scales with rank + a slice of ilvl', () => {
    // perShatter 5 + perRank 3·5 + floor(80/20) = 5 + 15 + 4 = 24
    expect(shatterToAttunement(mkItem())).toBe(24);
  });
  it('adds the radiant and mirrored bonuses', () => {
    expect(shatterToAttunement(mkItem({ radiant: true }))).toBe(24 + 10);
    expect(shatterToAttunement(mkItem({ mirrored: true }))).toBe(24 + 25);
    expect(shatterToAttunement(mkItem({ radiant: true, mirrored: true }))).toBe(24 + 10 + 25);
  });
  it('handles garbage items without throwing, never negative', () => {
    expect(shatterToAttunement(null)).toBe(5); // just the base
    expect(shatterToAttunement({ rank: -9, ilvl: -9 })).toBe(5);
  });
  it('honours a custom tuning object', () => {
    const t = { attunement: { perShatter: 0, perRank: 1, radiantBonus: 0, mirroredBonus: 0, perIlvlDiv: 10 } };
    expect(shatterToAttunement({ rank: 4, ilvl: 30 }, t)).toBe(4 + 3);
  });
});

describe('RADIANT chance — monotonic, capped', () => {
  it('climbs with depth', () => {
    expect(radiantChance(0)).toBeCloseTo(0.02, 10);
    expect(radiantChance(10)).toBeCloseTo(0.07, 10);
    // Monotonic non-decreasing across a sweep.
    let prev = -1;
    for (let d = 0; d <= 200; d += 5) { const c = radiantChance(d); expect(c).toBeGreaterThanOrEqual(prev); prev = c; }
  });
  it('is hard-capped', () => {
    expect(radiantChance(100000)).toBe(MIRRORFORGE.radiant.cap);
  });
  it('clamps negative / garbage depth to the base', () => {
    expect(radiantChance(-50)).toBeCloseTo(0.02, 10);
    expect(radiantChance(NaN)).toBeCloseTo(0.02, 10);
  });
  it('honours a custom radiant curve', () => {
    expect(radiantChance(4, { radiant: { chanceBase: 0.1, perDepth: 0.1, cap: 0.3 } })).toBeCloseTo(0.3, 10);
  });
});

describe('rollRadiant', () => {
  it('true when rng < chance, false otherwise (deterministic edges)', () => {
    expect(rollRadiant(() => 0, 0)).toBe(true);       // 0 < 0.02
    expect(rollRadiant(() => 0.99, 0)).toBe(false);   // 0.99 ≥ 0.02
    expect(rollRadiant(null, 0)).toBe(true);          // null rng → 0
  });
  it('over many seeded rolls the hit rate tracks the chance at depth', () => {
    const rng = mulberry32(42);
    let hits = 0; const N = 4000;
    for (let i = 0; i < N; i++) if (rollRadiant(rng, 50)) hits++; // chance = 0.02+0.25 = 0.27
    expect(hits / N).toBeGreaterThan(0.24);
    expect(hits / N).toBeLessThan(0.30);
  });
});

describe('aetherUnlocked gate', () => {
  it('locked before the depth gate, unlocked at/after it', () => {
    expect(aetherUnlocked(89)).toBe(false);
    expect(aetherUnlocked(90)).toBe(true);
    expect(aetherUnlocked(500)).toBe(true);
  });
  it('clamps garbage depth (locked)', () => {
    expect(aetherUnlocked(NaN)).toBe(false);
    expect(aetherUnlocked(-10)).toBe(false);
  });
  it('honours a custom gate', () => {
    expect(aetherUnlocked(5, { aether: { minEndlessDepth: 5 } })).toBe(true);
  });
});
