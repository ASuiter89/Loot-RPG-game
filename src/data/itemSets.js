// ── EQUIPMENT SETS ── the top-rarity chase. A set is a named collection of gear
// pieces (one per listed `slot`); wearing more matched pieces lights escalating
// stat tiers, and wearing EVERY piece completes the set — its final tier plus a
// signature `power` (a unique effect folded into totalStat, not just more raw
// stats) turn on and a golden aura wraps the hero.
//
// Pure data — no game state, DOM or RNG. Consumed by src/systems/itemSets.js
// (piece counts, completion, stat contribution, drop rolls) and rendered by the
// legacy tooltip. Design rules this table must uphold (guarded by
// test/data/itemSets.test.js):
//
//   • `slots` lists exactly the gear slots a set has a piece for. Its length IS
//     the set's size — the "Worn: n / size" denominator. Sets deliberately VARY
//     in size (2 → 6 here) so each feels distinct: small sets complete fast for a
//     punchy payoff, large sets are a long chase for a commanding one.
//   • `bonus` thresholds are keyed by matched-piece count. There is one tier per
//     "interesting" count, and the TOP threshold equals `slots.length` (the
//     completion tier). More than four pieces ⇒ more than four tiers.
//   • Between them the sets cover EVERY equipment slot, so a set piece can roll
//     for any slot the loot table produces.
//   • Stat keys are STAT_SHORT keys; percent stats (PCT_STATS) read as written.
export const ITEM_SETS = {
  // ── Herald's Fortune (2 pieces) ── the smallest set: two trinkets, quick to
  // complete, all about spoils. A pure treasure-hunter's kit.
  herald: {
    name: "Herald's", color: '#ffc24b',
    slots: ['ring', 'amulet'],
    bonus: {
      2: { GOLDFIND: 30, MAGICFIND: 20, XPGAIN: 15 },
    },
    power: { name: 'Golden Windfall', stats: { GOLDFIND: 40, MAGICFIND: 25, MATFIND: 25 },
      desc: 'Foes spill more gold, drop rarer loot, and yield richer crafting materials.' },
  },
  // ── Reaver's Wrath (3 pieces) ── a small, savage kit: arm, chest, hands. Fast
  // to assemble and built to end fights early.
  reaver: {
    name: "Reaver's", color: '#ff7a5c',
    slots: ['weapon', 'chest', 'hands'],
    bonus: {
      2: { ATK: 12, CRIT: 7 },
      3: { ATK: 30, CRIT: 16, IDMG: 16 },
    },
    power: { name: 'Bloodfrenzy', stats: { LEECH: 8, CLEAVE: 30, EXEC: 12 },
      desc: 'Hits cleave into nearby foes, leech their life, and execute the wounded.' },
  },
  // ── Arcanist's Regalia (4 pieces) ── the caster's chase: weapon, off-hand and
  // both trinkets. Deep mana, hard-hitting spells, fast recharge.
  arcanist: {
    name: "Arcanist's", color: '#c77bff',
    slots: ['weapon', 'offhand', 'ring', 'amulet'],
    bonus: {
      2: { SPELLPWR: 10, MP: 50 },
      3: { CDR: 8, MCR: 12 },
      4: { SPELLPWR: 24, MP: 150, CASTSPD: 14 },
    },
    power: { name: 'Arcane Overflow', stats: { CDR: 10, MPLEECH: 10, SPELLPWR: 14 },
      desc: 'Skills recharge faster and the damage you deal refunds mana.' },
  },
  // ── Warden's Bastion (5 pieces) ── the guardian's full harness: shield and
  // every armour slot. A long build toward near-unbreakable defense.
  warden: {
    name: "Warden's", color: '#7fd0ff',
    slots: ['offhand', 'head', 'chest', 'hands', 'legs'],
    bonus: {
      2: { DEF: 14, HP: 50 },
      3: { BLOCK: 12, DR: 6 },
      5: { DEF: 40, HP: 170, THORNS: 12 },
    },
    power: { name: 'Aegis Wall', stats: { DR: 10, THORNS: 12, BLOCK: 10 },
      desc: 'Turn aside more blows and reflect a punishing share of every hit back at attackers.' },
  },
  // ── Stalker's Shroud (6 pieces) ── the grand set: weapon plus five worn
  // pieces. The longest chase, rewarding a blistering hit-and-vanish assassin.
  stalker: {
    name: "Stalker's", color: '#63e6a8',
    slots: ['weapon', 'head', 'chest', 'hands', 'legs', 'ring'],
    bonus: {
      2: { SPD: 6, CRIT: 6 },
      3: { DODGE: 8, ACC: 8 },
      4: { ATKSPD: 12, DBLSTRIKE: 10 },
      6: { SPD: 12, CRIT: 14, CRITDMG: 40 },
    },
    power: { name: 'Ghost Step', stats: { DODGE: 10, DBLSTRIKE: 18, CRITDMG: 30 },
      desc: 'Blur between strikes — slip more blows, and each hit twins into a second.' },
  },
};
