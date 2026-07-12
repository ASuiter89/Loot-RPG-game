// ── THE ASCENDANT WEAVE — board tuning (pure data) ───────────────────────────
//
// The Weave is an endgame CHOICE BOARD that boss points are poured into — the sole
// spender of the earned boss-point pool (one point per boss floor first-cleared; see
// src/systems/bossPoints.js). Rather than a pure "more numbers" lever, the Weave is
// about OPPORTUNITY COST and BUILD IDENTITY:
//
//   • A bounded constellation board — five attribute-themed arms, FOUR rings deep —
//     where every node you light demands a point you can't get back for free, so you
//     can't have it all. The board is large enough to sink a long boss-point haul
//     into, but every arm competes with the others for the same pool.
//   • ATTRIBUTE-THRESHOLD & INVESTMENT KEYSTONES — build-defining multipliers that
//     only ignite once your attributes (or your investment in that arm, or your total
//     board spend) cross a line. They ladder UP: an arm's cheap keystone lights early,
//     its apex keystone demands a deep, dedicated build.
//   • A cosmetic, infinite "Weave Depth" rank that carries the endless fantasy with
//     ZERO power — a prestige badge, nothing more.
//
// This file is PURE VALUES. The board geometry (node x/y) is built once here with
// plain trig at module load — no RNG, no DOM, no imports from systems/render —
// mirroring how uniques.js stamps derived fields onto its DEFS. The math that reads
// this table lives in src/systems/ascendantWeave.js.
//
// Attribute keys are the game's five: might / vitality / agility / spirit / luck
// (see src/data/attributeScaling.js). A payload/effect key that is NOT one of those
// five is a gear STAT code (ATK, HP, DR, CRIT, …) exactly as the item system uses.

const RAD = Math.PI / 180;

// Place a point on the board at a compass angle (math degrees, y flipped for the
// canvas's y-down space) and radius from the board centre (50, 50). Rounded to keep
// the data table tidy and diff-friendly.
function place(angleDeg, radius) {
  return {
    x: Math.round((50 + radius * Math.cos(angleDeg * RAD)) * 100) / 100,
    y: Math.round((50 - radius * Math.sin(angleDeg * RAD)) * 100) / 100,
  };
}

// The five constellations — one per attribute — arranged as the points of a
// pentagon so no arm crowds another. `angle` is the arm's compass heading; every
// node is laid out along it.
const CONSTS = [
  { id: 'ferocity', name: 'The Ferocity', attr: 'might',    angle: 90 },  // straight up
  { id: 'aegis',    name: 'The Aegis',    attr: 'vitality', angle: 162 }, // upper-left
  { id: 'zephyr',   name: 'The Zephyr',   attr: 'agility',  angle: 234 }, // lower-left
  { id: 'oracle',   name: 'The Oracle',   attr: 'spirit',   angle: 306 }, // lower-right
  { id: 'fortune',  name: 'The Fortune',  attr: 'luck',     angle: 18 },  // upper-right
];

// Ring radii from the centre. Band 1 is the entry node nearest the core; band 4 is
// the deep, gated apex of each arm.
const BAND_R = { 1: 13, 2: 24, 3: 35, 4: 46 };

// The shared shape of every arm: an entry node (band 1, no prereq), two band-2
// branches gated behind the entry, two band-3 tips each reachable from EITHER branch
// (reqAny), and two band-4 apexes each gated behind its own side's tip (a dedicated,
// deep commitment). `off` fans the branches to the sides of the arm so the board
// reads as a little tree, not a straight line.
const LAYOUT = [
  { band: 1, off:   0, reqIdx: null, anyIdx: null }, // 0 entry
  { band: 2, off: -13, reqIdx: [0],  anyIdx: null }, // 1 left branch
  { band: 2, off:  13, reqIdx: [0],  anyIdx: null }, // 2 right branch
  { band: 3, off: -20, reqIdx: null, anyIdx: [1, 2] }, // 3 left tip
  { band: 3, off:  20, reqIdx: null, anyIdx: [1, 2] }, // 4 right tip
  { band: 4, off: -11, reqIdx: [3],  anyIdx: null }, // 5 left apex (needs left tip)
  { band: 4, off:  11, reqIdx: [4],  anyIdx: null }, // 6 right apex (needs right tip)
];

// Per-arm node payloads, indexed to LAYOUT. Deliberately BOUNDED — the board's power
// comes from keystones, not from fat node numbers — but the deep band-4 apexes pay a
// bigger themed bump than the shallow nodes, so pushing an arm to its tip is worth it.
// Keys that are one of the five attribute names add to that attribute (which also
// feeds that arm's attribute-gated keystones); every other key is a gear stat code.
const NODE_PAYLOADS = {
  ferocity: [{ might: 2 }, { ATK: 4 }, { PEN: 3 }, { might: 3 }, { CRITDMG: 6 }, { ATK: 9 }, { might: 4 }],
  aegis:    [{ vitality: 2 }, { HP: 12 }, { DR: 3 }, { vitality: 3 }, { HP: 18 }, { HP: 28 }, { vitality: 4 }],
  zephyr:   [{ agility: 2 }, { ATKSPD: 5 }, { DODGE: 3 }, { agility: 3 }, { ACC: 6 }, { ATKSPD: 9 }, { agility: 4 }],
  oracle:   [{ spirit: 2 }, { SPELLPWR: 4 }, { MP: 20 }, { spirit: 3 }, { CDR: 4 }, { SPELLPWR: 9 }, { spirit: 4 }],
  fortune:  [{ luck: 2 }, { CRIT: 4 }, { luck: 2 }, { CRIT: 5 }, { luck: 3 }, { CRIT: 8 }, { luck: 4 }],
};

// Build the flat node list. Every node: stable id (`<arm>_<n>`), its arm, ring band,
// a fixed cost of 1 point, board coords, its payload, and its prereqs expressed as
// node ids (req = ALL of, reqAny = ANY of). Entry nodes carry neither.
const nodes = [];
for (const c of CONSTS) {
  const ids = LAYOUT.map((_, i) => `${c.id}_${i + 1}`);
  LAYOUT.forEach((L, i) => {
    const pos = place(c.angle + L.off, BAND_R[L.band]);
    const node = {
      id: ids[i],
      constellation: c.id,
      band: L.band,
      cost: 1,
      x: pos.x,
      y: pos.y,
      payload: NODE_PAYLOADS[c.id][i],
    };
    if (L.reqIdx) node.req = L.reqIdx.map((j) => ids[j]);
    if (L.anyIdx) node.reqAny = L.anyIdx.map((j) => ids[j]);
    nodes.push(node);
  });
}

// KEYSTONES — the build-definers. Each belongs to an arm and lies dormant until you
// have (a) entered that arm (≥1 node lit there — this is what keeps an untouched
// board a pure no-op even for a high-attribute hero) AND (b) crossed its GATE. A gate
// may carry any combination of conditions, ALL of which must hold:
//   • { attr, total } → the hero's TOTAL of that attribute reaches `total`.
//   • { n }           → you've spent at least `n` points in that arm.
//   • { boardPts }    → you've lit at least `boardPts` nodes across the WHOLE board.
// A keystone with `statKey` + `mult` folds a multiplicative bonus into that stat (the
// classic build-definer, e.g. ×1.15). A keystone with an `effect` map folds a flat
// bonus in instead. `effectId` is the stable handle the shell keys any bespoke
// visual/behaviour off. Bounded on purpose — the biggest single mult here is ×1.25,
// and the fattest ones sit behind the steepest gates, so stacking them all demands a
// dedicated, deeply-invested build.
const keystones = [
  // ── The Ferocity (might) ──
  {
    id: 'ks_unbroken', constellation: 'ferocity', name: 'Unbroken Advance',
    desc: 'Momentum never lets your blows soften — Attack Power surges by 15%.',
    gate: { attr: 'might', total: 60 }, effectId: 'ferocityAtk', statKey: 'ATK', mult: 1.15,
  },
  {
    id: 'ks_overwhelm', constellation: 'ferocity', name: 'Overwhelming Force',
    desc: 'Every strike lands to break — Critical Damage grows by 12%.',
    gate: { n: 4 }, effectId: 'ferocityCritDmg', statKey: 'CRITDMG', mult: 1.12,
  },
  {
    id: 'ks_sunder', constellation: 'ferocity', name: 'Sundering Edge',
    desc: 'Your edge finds the seam in any guard — a flat +12 Armor Penetration.',
    gate: { attr: 'might', total: 100 }, effectId: 'ferocityPen', effect: { PEN: 12 },
  },
  {
    id: 'ks_titanic', constellation: 'ferocity', name: 'Titanic Might',
    desc: 'Nothing you swing feels heavy — Attack Power climbs a further 18%.',
    gate: { n: 6 }, effectId: 'ferocityAtk2', statKey: 'ATK', mult: 1.18,
  },
  {
    id: 'ks_annihilate', constellation: 'ferocity', name: 'Annihilation',
    desc: 'A dedicated engine of ruin — Attack Power multiplies by a final 25%.',
    gate: { attr: 'might', total: 150, boardPts: 24 }, effectId: 'ferocityAtk3', statKey: 'ATK', mult: 1.25,
  },

  // ── The Aegis (vitality) ──
  {
    id: 'ks_bulwark', constellation: 'aegis', name: 'Bulwark Heart',
    desc: 'The Weave anchors your life — maximum Health rises by 15%.',
    gate: { attr: 'vitality', total: 60 }, effectId: 'aegisHp', statKey: 'HP', mult: 1.15,
  },
  {
    id: 'ks_stoneskin', constellation: 'aegis', name: 'Stoneskin',
    desc: 'Your skin turns to warded stone — a flat +8 Damage Reduction.',
    gate: { n: 4 }, effectId: 'aegisDr', effect: { DR: 8 },
  },
  {
    id: 'ks_rampart', constellation: 'aegis', name: 'Living Rampart',
    desc: 'Vitality pours into a deeper well — maximum Health rises another 20%.',
    gate: { attr: 'vitality', total: 100 }, effectId: 'aegisHp2', statKey: 'HP', mult: 1.20,
  },
  {
    id: 'ks_immovable', constellation: 'aegis', name: 'Immovable',
    desc: 'You simply do not fall — a flat +12 Damage Reduction.',
    gate: { n: 6 }, effectId: 'aegisDr2', effect: { DR: 12 },
  },
  {
    id: 'ks_undying', constellation: 'aegis', name: 'Undying Aegis',
    desc: 'Life without limit — maximum Health multiplies by a final 25%.',
    gate: { attr: 'vitality', total: 150, boardPts: 24 }, effectId: 'aegisHp3', statKey: 'HP', mult: 1.25,
  },

  // ── The Zephyr (agility) ──
  {
    id: 'ks_bladedance', constellation: 'zephyr', name: 'Blade Dance',
    desc: 'You move between heartbeats — Attack Speed climbs by 15%.',
    gate: { attr: 'agility', total: 60 }, effectId: 'zephyrAtkSpd', statKey: 'ATKSPD', mult: 1.15,
  },
  {
    id: 'ks_slipstream', constellation: 'zephyr', name: 'Slipstream',
    desc: 'Blows slide past a body already elsewhere — a flat +10 Evasion.',
    gate: { n: 4 }, effectId: 'zephyrDodge', effect: { DODGE: 10 },
  },
  {
    id: 'ks_tempo', constellation: 'zephyr', name: 'Perfect Tempo',
    desc: 'Every motion flows into the next — Attack Speed climbs another 20%.',
    gate: { attr: 'agility', total: 100 }, effectId: 'zephyrAtkSpd2', statKey: 'ATKSPD', mult: 1.20,
  },
  {
    id: 'ks_deadeye', constellation: 'zephyr', name: 'Deadeye',
    desc: 'No opening escapes you — a flat +12 Accuracy.',
    gate: { n: 6 }, effectId: 'zephyrAcc', effect: { ACC: 12 },
  },
  {
    id: 'ks_flurry', constellation: 'zephyr', name: 'Endless Flurry',
    desc: 'A storm of steel with no gaps — Attack Speed multiplies by a final 25%.',
    gate: { attr: 'agility', total: 150, boardPts: 24 }, effectId: 'zephyrAtkSpd3', statKey: 'ATKSPD', mult: 1.25,
  },

  // ── The Oracle (spirit) ──
  {
    id: 'ks_deepwell', constellation: 'oracle', name: 'Deep Well',
    desc: 'You draw from a bottomless font — Spell Power swells by 15%.',
    gate: { attr: 'spirit', total: 60 }, effectId: 'oracleSpell', statKey: 'SPELLPWR', mult: 1.15,
  },
  {
    id: 'ks_quickcast', constellation: 'oracle', name: 'Quickened Casting',
    desc: 'The words come faster — Cooldown Reduction improves by 10%.',
    gate: { n: 4 }, effectId: 'oracleCdr', statKey: 'CDR', mult: 1.10,
  },
  {
    id: 'ks_overflow', constellation: 'oracle', name: 'Overflowing Font',
    desc: 'The font brims over its banks — Spell Power swells another 20%.',
    gate: { attr: 'spirit', total: 100 }, effectId: 'oracleSpell2', statKey: 'SPELLPWR', mult: 1.20,
  },
  {
    id: 'ks_alacrity', constellation: 'oracle', name: 'Arcane Alacrity',
    desc: 'Spells barely rest before the next — Cooldown Reduction improves 15% more.',
    gate: { n: 6 }, effectId: 'oracleCdr2', statKey: 'CDR', mult: 1.15,
  },
  {
    id: 'ks_ascension', constellation: 'oracle', name: 'Ascension',
    desc: 'You speak with the Weave’s own voice — Spell Power multiplies by a final 25%.',
    gate: { attr: 'spirit', total: 150, boardPts: 24 }, effectId: 'oracleSpell3', statKey: 'SPELLPWR', mult: 1.25,
  },

  // ── The Fortune (luck) ──
  {
    id: 'ks_fortuneseye', constellation: 'fortune', name: "Fortune's Eye",
    desc: 'You see the flaw before it shows — Critical Chance rises by 20%.',
    gate: { attr: 'luck', total: 50 }, effectId: 'fortuneCrit', statKey: 'CRIT', mult: 1.20,
  },
  {
    id: 'ks_jackpot', constellation: 'fortune', name: 'Jackpot',
    desc: 'When luck breaks, it breaks hard — Critical Damage grows by 15%.',
    gate: { n: 4 }, effectId: 'fortuneCritDmg', statKey: 'CRITDMG', mult: 1.15,
  },
  {
    id: 'ks_windfall', constellation: 'fortune', name: 'Windfall',
    desc: 'The dice keep falling your way — Critical Damage grows another 20%.',
    gate: { attr: 'luck', total: 90 }, effectId: 'fortuneCritDmg2', statKey: 'CRITDMG', mult: 1.20,
  },
  {
    id: 'ks_providence', constellation: 'fortune', name: 'Providence',
    desc: 'Fate itself takes your side — Critical Chance multiplies by a final 25%.',
    gate: { attr: 'luck', total: 130, boardPts: 24 }, effectId: 'fortuneCrit2', statKey: 'CRIT', mult: 1.25,
  },
];

// WEAVE DEPTH — the cosmetic, infinite prestige rank. Purely a badge: it grants NO
// stats, no nodes, nothing mechanical (weaveDepthRank() in the system returns only a
// rank number + the next threshold). It carries the "endless" fantasy so the board
// itself can stay bounded. Rank R costs `base + step·(R-1)` depth-points, so each rank
// is a little dearer than the last — an ever-receding horizon that can never be
// "finished".
const weaveDepth = {
  base: 5,   // depth-points to reach rank 1
  step: 3,   // each further rank costs 3 more than the one before
  // Flavour titles cycled for the rank badge (last one repeats forever). Cosmetic.
  titles: ['Unwoven', 'Woven', 'Threaded', 'Patterned', 'Starlit', 'Constellate', 'Ascendant'],
};

// The single exported table the system reads.
export const WEAVE = {
  constellations: CONSTS,
  nodes,
  keystones,
  weaveDepth,
};
