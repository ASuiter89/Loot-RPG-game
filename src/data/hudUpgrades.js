// ── HUD FIELD KIT — the Merchant's readout instruments ──
// The heads-up display starts bare: a fresh hero reads the world off the raw
// pixels — health/mana show as bars with no numbers, no minimap, no counters, no
// depth or difficulty label, no status-effect icons. The town Merchant (the FIRST
// keeper to arrive) sells these instruments one at a time; each purchase switches
// a piece of the HUD on for good (persisted per hero on player.hudUpgrades).
//
// Each entry is { key, name, icon, price, hud, desc }:
//   key   — the flag stored on player.hudUpgrades and read by hudOwned() in the shell.
//   icon  — a real atlas sprite key (never an emoji), shown on the shop row.
//   price — flat gold cost (a one-time buy; there is no per-floor upkeep).
//   hud   — the plain-language name of the HUD piece it reveals (used in tooltips).
//   desc  — the shop-row blurb.
// Ordered cheapest → priciest so the essentials read first on the Field Kit tab.

export const HUD_UPGRADES = [
  { key: 'vitals', name: 'Vital Readout', icon: 'ic_heart', price: 40,
    hud: 'health & mana numbers',
    desc: 'Print the exact numbers on your health and mana bars.' },
  { key: 'floor', name: 'Depth Gauge', icon: 'feat_gate_red', price: 40,
    hud: 'dungeon floor counter',
    desc: 'Show which floor you are on.' },
  { key: 'foes', name: 'Spyglass', icon: 'ui_foes', price: 60,
    hud: 'foes-remaining counter',
    desc: 'Tally the foes still standing between you and the stairs.' },
  { key: 'difficulty', name: 'Omen Dial', icon: 'ic_up', price: 60,
    hud: 'difficulty tier label',
    desc: 'Name the difficulty tier beside the floor.' },
  { key: 'chests', name: 'Treasure Tally', icon: 'chest', price: 90,
    hud: 'chests-remaining counter',
    desc: 'Count the unopened chests left on the floor.' },
  { key: 'status', name: 'Warding Charm', icon: 'ic_orb', price: 100,
    hud: 'status-effect icons',
    desc: 'Reveal your buff & debuff icons in the top corner.' },
  { key: 'minimap', name: "Cartographer's Map", icon: 'q_beacon', price: 150,
    hud: 'minimap',
    desc: 'Sketch the whole floor as a corner minimap.' },
];
