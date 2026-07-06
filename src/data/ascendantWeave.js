// ── THE ASCENDANT WEAVE — board tuning (pure data) ───────────────────────────
//
// The Weave is an endgame CHOICE BOARD that boss points can be poured into, as a
// second, INDEPENDENT drawer from the same earned pool the gear slots draw from
// (see src/systems/bossSlots.js — spending here never depletes gear-slot points,
// and vice-versa). Where the gear slots are a pure "more numbers" lever, the Weave
// is about OPPORTUNITY COST and BUILD IDENTITY:
//
//   • A compact, BOUNDED constellation board — five attribute-themed arms, three
//     rings deep — where every node you light demands a point you can't get back
//     for free, so you can't have it all.
//   • ATTRIBUTE-THRESHOLD KEYSTONES — build-defining multipliers that only ignite
//     once your attributes (or your investment in that arm) cross a line.
//   • Socketed GLYPHS — gems dropped from Endless depth whose bonus multiplies the
//     nodes they physically sit near, so WHERE you place them is the puzzle.
//   • A cosmetic, infinite "Weave Depth" rank that carries the endless fantasy with
//     ZERO power — a prestige badge, nothing more.
//
// This file is PURE VALUES. The board geometry (node x/y, socket reach) is built
// once here with plain trig at module load — no RNG, no DOM, no imports from
// systems/render — mirroring how uniques.js stamps derived fields onto its DEFS.
// The math that reads this table lives in src/systems/ascendantWeave.js.
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
// node and the arm's socket are laid out along it.
const CONSTS = [
  { id: 'ferocity', name: 'The Ferocity', attr: 'might',    angle: 90 },  // straight up
  { id: 'aegis',    name: 'The Aegis',    attr: 'vitality', angle: 162 }, // upper-left
  { id: 'zephyr',   name: 'The Zephyr',   attr: 'agility',  angle: 234 }, // lower-left
  { id: 'oracle',   name: 'The Oracle',   attr: 'spirit',   angle: 306 }, // lower-right
  { id: 'fortune',  name: 'The Fortune',  attr: 'luck',     angle: 18 },  // upper-right
];

// Ring radii from the centre. Band 1 is the entry node nearest the core; band 3 is
// the deep, gated tips of each arm.
const BAND_R = { 1: 15, 2: 28, 3: 42 };

// The shared shape of every arm: an entry node (band 1, no prereq), two band-2
// branches gated behind the entry, and two band-3 tips each reachable from EITHER
// branch (reqAny). `off` fans the branches to the sides of the arm so the board
// reads as a little tree, not a straight line.
const LAYOUT = [
  { band: 1, off:  0,  reqIdx: null, anyIdx: null }, // entry
  { band: 2, off: -12, reqIdx: [0],  anyIdx: null }, // left branch
  { band: 2, off:  12, reqIdx: [0],  anyIdx: null }, // right branch
  { band: 3, off: -16, reqIdx: null, anyIdx: [1, 2] }, // left tip
  { band: 3, off:  16, reqIdx: null, anyIdx: [1, 2] }, // right tip
];

// Per-arm node payloads, indexed to LAYOUT. Deliberately MODEST and BOUNDED — the
// board's power comes from keystones + glyphs, not from fat node numbers. Keys that
// are one of the five attribute names add to that attribute; every other key is a
// gear stat code. Each arm mixes a couple of small attribute pips (which also feed
// its keystone attribute gates) with themed stat bumps.
const NODE_PAYLOADS = {
  ferocity: [{ might: 2 }, { ATK: 4 }, { PEN: 3 }, { might: 3 }, { CRITDMG: 6 }],
  aegis:    [{ vitality: 2 }, { HP: 12 }, { DR: 3 }, { vitality: 3 }, { HP: 18 }],
  zephyr:   [{ agility: 2 }, { ATKSPD: 5 }, { DODGE: 3 }, { agility: 3 }, { ACC: 6 }],
  oracle:   [{ spirit: 2 }, { SPELLPWR: 4 }, { MP: 20 }, { spirit: 3 }, { CDR: 4 }],
  fortune:  [{ luck: 2 }, { CRIT: 4 }, { luck: 2 }, { CRIT: 5 }, { luck: 3 }],
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

// Glyph SOCKETS — fixed anchor points with a reach radius. A glyph dropped in a
// socket multiplies the payload of every ALLOCATED node inside its reach, so the
// socket you choose (and thus which nodes you cover) is the decision. The `core`
// socket sits on the centre and just reaches all five entry nodes; each arm socket
// sits at its band-2 ring and reaches that arm's entry + branches (but not the deep
// tips), so no single socket can blanket a whole arm.
const sockets = [
  { id: 'core', x: 50, y: 50, radius: 16 },
  ...CONSTS.map((c) => {
    const p = place(c.angle, BAND_R[2]);
    return { id: `sock_${c.id}`, x: p.x, y: p.y, radius: 14 };
  }),
];

// KEYSTONES — the build-definers. Each belongs to an arm and lies dormant until you
// have (a) entered that arm (≥1 node lit there — this is what keeps an untouched
// board a pure no-op even for a high-attribute hero) AND (b) crossed its GATE:
//   • { attr, total }  → the hero's TOTAL of that attribute reaches `total`.
//   • { n }            → you've spent at least `n` points in that arm.
// A keystone with `statKey` + `mult` folds a multiplicative bonus into that stat
// (the classic build-definer, e.g. ×1.15). A keystone with an `effect` map folds a
// flat bonus in instead. `effectId` is the stable handle the shell keys any bespoke
// visual/behaviour off. Bounded on purpose — the biggest single mult here is ×1.20.
const keystones = [
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
    id: 'ks_bladedance', constellation: 'zephyr', name: 'Blade Dance',
    desc: 'You move between heartbeats — Attack Speed climbs by 15%.',
    gate: { attr: 'agility', total: 60 }, effectId: 'zephyrAtkSpd', statKey: 'ATKSPD', mult: 1.15,
  },
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
    id: 'ks_fortuneseye', constellation: 'fortune', name: "Fortune's Eye",
    desc: 'You see the flaw before it shows — Critical Chance rises by 20%.',
    gate: { attr: 'luck', total: 50 }, effectId: 'fortuneCrit', statKey: 'CRIT', mult: 1.20,
  },
];

// WEAVE DEPTH — the cosmetic, infinite prestige rank. Purely a badge: it grants NO
// stats, no nodes, nothing mechanical (weaveDepthRank() in the system returns only a
// rank number + the next threshold). It carries the "endless" fantasy so the board
// itself can stay small and bounded. Rank R costs `base + step·(R-1)` depth-points,
// so each rank is a little dearer than the last — an ever-receding horizon that can
// never be "finished".
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
  sockets,
  weaveDepth,
};
