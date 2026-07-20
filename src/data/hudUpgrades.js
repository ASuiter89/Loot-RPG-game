// ── HUD UPGRADES — the Craftsman's readout instruments & bag tools ──
// The heads-up display and loot bag start bare: a fresh hero reads the world off the
// raw pixels — health/mana/stamina/XP show as bars with no numbers, no minimap, no counters, no
// depth or difficulty label, no status-effect icons — the loot bag auto-groups
// items by gear category (rarest first) but shows no item level, gold value, salvage
// yield, Power ratings, stat compare, re-sort/filter or auto-loot, and the hero's own
// derived-stats panel and skill surge bonuses stay hidden too.
// The town Craftsman (a founding keeper, on hand from your first town visit) builds
// these one at a time; each purchase switches a piece on for good (persisted per hero
// on player.hudUpgrades).
//
// Each entry is { key, name, icon, cost, group, hud, desc }:
//   key   — the flag stored on player.hudUpgrades and read by hudOwned() in the shell.
//   icon  — a real atlas sprite key (never an emoji), shown on the shop row.
//   cost  — a mixed one-time price { gold, scrap, glimmer, core } (any subset), paid
//           through the shared wallet helpers (canAfford / spendCost); there is no
//           per-floor upkeep. The Craftsman literally builds each instrument, so the
//           pricier pieces draw finer materials — Scrap on the cheap readouts, Glimmer
//           from the mid tier up, and a Core on the two premium tools (the minimap and
//           auto-loot), gating those behind reaching a difficulty that drops Core.
//   group — which bench section it lists under: 'readout' (HUD overlay pieces),
//           'bag' (loot-bag conveniences), or 'sheet' (the hero's own character &
//           skill readouts). See renderHudKitHTML in the shell.
//   hud   — the plain-language name of the piece it reveals (used in tooltips/logs).
//   desc  — the shop-row blurb.
// Ordered cheapest → priciest (by gold) WITHIN each group so the essentials read first.

export const HUD_UPGRADES = [
  // ── HUD READOUTS — the heads-up-display overlay pieces. ──
  // Cheapest → priciest by gold, which doubles as the recommended reading order:
  // the essential Vital Readout first, the premium tools (status strip, minimap)
  // last. The lightweight trinkets (XP numbers, difficulty label, chest tally) sit
  // cheap in the middle — nice-to-haves, not full instruments, so they're priced
  // to match rather than like the counters and readouts around them.
  { key: 'vitals', name: 'Vital Readout', icon: 'ic_heart', cost: { gold: 360, scrap: 10 }, group: 'readout',
    hud: 'health, mana & stamina numbers',
    desc: 'Print the exact numbers on your health, mana and stamina bars.' },
  { key: 'floor', name: 'Depth Gauge', icon: 'feat_gate_red', cost: { gold: 360, scrap: 10 }, group: 'readout',
    hud: 'dungeon floor counter',
    desc: 'Show which floor you are on.' },
  { key: 'xpnums', name: 'Ascension Gauge', icon: 'ui_level', cost: { gold: 390, scrap: 10 }, group: 'readout',
    hud: 'experience-to-level numbers',
    desc: 'Print your experience-to-next-level numbers on the XP bar.' },
  { key: 'difficulty', name: 'Omen Dial', icon: 'ic_up', cost: { gold: 420, scrap: 8 }, group: 'readout',
    hud: 'difficulty tier label',
    desc: 'Name the difficulty tier beside the floor.' },
  { key: 'chests', name: 'Treasure Tally', icon: 'chest', cost: { gold: 480, scrap: 14 }, group: 'readout',
    hud: 'chests-remaining counter',
    desc: 'Count the unopened chests left on the floor.' },
  { key: 'foes', name: 'Spyglass', icon: 'ui_foes', cost: { gold: 540, scrap: 20 }, group: 'readout',
    hud: 'foes-remaining counter',
    desc: 'Tally the foes still standing between you and the stairs.' },
  { key: 'status', name: 'Warding Charm', icon: 'ic_orb', cost: { gold: 1020, scrap: 45, glimmer: 5 }, group: 'readout',
    hud: 'status-effect icons',
    desc: 'Reveal your buff & debuff icons in the top corner.' },
  { key: 'minimap', name: "Cartographer's Map", icon: 'q_beacon', cost: { gold: 1440, scrap: 60, glimmer: 8, core: 2 }, group: 'readout',
    hud: 'minimap',
    desc: 'Sketch the whole floor as a corner minimap.' },
  // ── BAG & LOOT TOOLS — conveniences for reading and handling loot. ──
  { key: 'ilvl', name: "Assayer's Glass", icon: 'ui_level', cost: { gold: 300, scrap: 8 }, group: 'bag',
    hud: 'item level',
    desc: 'Print each gear piece item level in your bag and tooltips.' },
  { key: 'value', name: 'Coin Scale', icon: 'ic_money', cost: { gold: 330, scrap: 10 }, group: 'bag',
    hud: 'item gold value',
    desc: 'Print each item gold value in your bag; Merchant sell prices always show.' },
  { key: 'scrapval', name: 'Salvage Gauge', icon: 'mat_scrap', cost: { gold: 360, scrap: 12 }, group: 'bag',
    hud: 'item salvage yield',
    desc: 'Preview the materials each item sheds when scrapped.' },
  { key: 'rankings', name: "Appraiser's Loupe", icon: 'ui_power', cost: { gold: 450, scrap: 15 }, group: 'bag',
    hud: 'item Power ratings',
    desc: 'Print each gear piece Power rating in your bag and worn slots.' },
  { key: 'compare', name: 'Gauging Calipers', icon: 'scroll', cost: { gold: 720, scrap: 30, glimmer: 3 }, group: 'bag',
    hud: 'quick stat compare',
    desc: 'Show the +/- stat swing of each item against your equipped gear.' },
  { key: 'sortfilter', name: "Quartermaster's Ledger", icon: 'ui_bag', cost: { gold: 900, scrap: 40, glimmer: 4 }, group: 'bag',
    hud: 'bag sort & filter',
    desc: 'Sort and filter your bag by rarity, Power, slot, value or stat.' },
  { key: 'autoloot', name: 'Sorting Sieve', icon: 'mat_scrap', cost: { gold: 1200, scrap: 55, glimmer: 6, core: 1 }, group: 'bag',
    hud: 'auto-loot rules',
    desc: 'Auto-scrap or auto-sell loot of chosen rarities the moment it drops.' },
  // ── CHARACTER & SKILL SHEET — readouts for your own hero, not loot. ──
  { key: 'statsheet', name: "Adept's Slate", icon: 'ic_target', cost: { gold: 600, scrap: 20 }, group: 'sheet',
    hud: 'derived-stats panel',
    desc: 'Show the full derived-stats breakdown under your gear.' },
  { key: 'surges', name: "Sage's Codex", icon: 'ic_wand', cost: { gold: 660, scrap: 22, glimmer: 2 }, group: 'sheet',
    hud: 'skill surge bonuses',
    desc: 'Reveal each skill surge bonus and its rank milestone.' },
];

// The two bench sections, in display order, with the section blurb the HUD-upgrades
// bench prints above each group. The shell renders one .shop-grid per group.
export const HUD_UPGRADE_GROUPS = [
  { id: 'readout', label: 'HUD Readouts',
    blurb: 'Instruments that build out your heads-up display — start with the Vital Readout, then add floor, XP & foe counters, status icons and the minimap.' },
  { id: 'bag', label: 'Bag & Loot Tools',
    blurb: 'Tools for reading and handling loot — item level, gold value, salvage yield, Power, stat compare, bag sort/filter, and auto-loot rules.' },
  { id: 'sheet', label: 'Character & Skill Sheet',
    blurb: 'Readouts for your own hero — the derived-stats breakdown and each skill surge bonus.' },
];
