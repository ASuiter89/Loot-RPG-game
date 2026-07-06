// THE RENOWN TRACK — the account-wide ladder the Hall of Deeds' renown feeds into.
// PURE VALUES (the only import is the sibling cosmetic table, another leaf).
//
// Renown earned from completed deeds (see data/deeds.js) accumulates forever and
// never resets — it is a lifetime account total. Crossing a rank's cumulative
// `renownNeeded` unlocks that rank's `reward`, and every reward is POWER-FREE:
//   • stashTab — a permanent extra stash tab (storage QoL, not power)
//   • frame    — a portrait border cosmetic (data/titles.js FRAMES)
//   • badge    — a profile emblem cosmetic (data/titles.js BADGES)
//   • title    — a wearable name suffix (data/titles.js TITLES)
//   • qol      — a pure quality-of-life unlock (e.g. an extra loadout preset slot)
//
// `renownNeeded` is CUMULATIVE and STRICTLY ASCENDING (a data-validity test pins
// this): rank N unlocks once lifetime renown ≥ its threshold. Rank 1 sits at 0 so a
// brand-new account already holds the opening rank (and its starter title), matching
// the "front-loaded" feel of the deed list. The final rank (11,000) demands close to
// the entire ~11,890 renown the catalog can grant, so it is a true end-of-account cap.
import { TITLES } from './titles.js';

export const RENOWN_TRACK = {
  ranks: [
    { rank: 1,  renownNeeded: 0,     reward: { type: 'title',    id: 'title_unproven' } },
    { rank: 2,  renownNeeded: 300,   reward: { type: 'stashTab',  id: 'stash_deeds_1' } },
    { rank: 3,  renownNeeded: 800,   reward: { type: 'frame',     id: 'frame_iron' } },
    { rank: 4,  renownNeeded: 1500,  reward: { type: 'title',     id: 'title_delver' } },
    { rank: 5,  renownNeeded: 2500,  reward: { type: 'badge',     id: 'badge_firstdeed' } },
    { rank: 6,  renownNeeded: 3800,  reward: { type: 'stashTab',  id: 'stash_deeds_2' } },
    { rank: 7,  renownNeeded: 5400,  reward: { type: 'frame',     id: 'frame_gold' } },
    { rank: 8,  renownNeeded: 7200,  reward: { type: 'qol',       id: 'qol_loadout_slot' } },
    { rank: 9,  renownNeeded: 9000,  reward: { type: 'title',     id: 'title_conqueror' } },
    { rank: 10, renownNeeded: 11000, reward: { type: 'frame',     id: 'frame_radiant' } },
  ],
};

// The titles the renown ladder can hand out, surfaced here so the shell has a single
// import for "what can I wear from the Hall of Deeds." Kept as a re-export (not a
// copy) so titles.js stays the one source of truth for the strings.
export const RENOWN_TITLES = TITLES;
