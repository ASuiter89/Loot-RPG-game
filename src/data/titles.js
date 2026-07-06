// Hall of Deeds cosmetics — PURE VALUE tables for the power-free renown rewards.
//
// The Hall of Deeds is account-wide RENOWN: it fuses every long-horizon system
// (Collection, Bestiary, Conquest, depth records, Bounties, class breadth) into a
// single ladder whose payouts NEVER touch power. Everything a rank grants lives
// here as inert data — a title string, a frame sprite, a badge sprite — so the
// systems layer can hand the shell a reward id and the shell just looks up how to
// draw it. No logic, no imports from systems/render/legacy: this is a leaf.

// TITLES — the flavour name a player can wear under their hero on the roster and the
// leaderboard. `id` is the stable key stored in the save (player.deeds.title); `text`
// is the display string. Ordered roughly by prestige so the wardrobe reads as a
// climb. A title is PURE COSMETIC — it changes no stat, only how the name renders.
export const TITLES = [
  { id: 'title_unproven',   text: 'the Unproven' },      // rank 1 — everybody starts here
  { id: 'title_delver',     text: 'the Delver' },
  { id: 'title_collector',  text: 'the Collector' },
  { id: 'title_warden',     text: 'Warden of the Deep' },
  { id: 'title_conqueror',  text: 'the Conqueror' },
  { id: 'title_loremaster',  text: 'the Loremaster' },
  { id: 'title_paragon',    text: 'Paragon of Deeds' },
  { id: 'title_immortal',   text: 'the Immortal Name' },
];

// FRAMES — decorative borders drawn around a hero portrait / roster card. The value
// is a sprite-index PLACEHOLDER key: the atlas art is authored later, and the shell
// resolves the key through drawSpriteC/dlIcon like every other asset (never an emoji
// standing in for the frame itself). `tier` lets the UI tint the border by prestige.
export const FRAMES = [
  { id: 'frame_iron',    sprite: 'deed_frame_iron',    tier: 1 },
  { id: 'frame_bronze',  sprite: 'deed_frame_bronze',  tier: 2 },
  { id: 'frame_silver',  sprite: 'deed_frame_silver',  tier: 3 },
  { id: 'frame_gold',    sprite: 'deed_frame_gold',    tier: 4 },
  { id: 'frame_radiant', sprite: 'deed_frame_radiant', tier: 5 },
];

// BADGES — small emblems pinned to the profile, one per themed milestone. Same
// sprite-index placeholder contract as FRAMES. These are the "I did the thing"
// trophies the renown ladder hands out at its reward ranks.
export const BADGES = [
  { id: 'badge_firstdeed', sprite: 'deed_badge_firstdeed', tier: 1 },
  { id: 'badge_hunter',    sprite: 'deed_badge_hunter',    tier: 2 },
  { id: 'badge_hoarder',   sprite: 'deed_badge_hoarder',   tier: 3 },
  { id: 'badge_champion',  sprite: 'deed_badge_champion',  tier: 4 },
  { id: 'badge_eternal',   sprite: 'deed_badge_eternal',   tier: 5 },
];
