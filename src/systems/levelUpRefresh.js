// ── LEVEL-UP REFRESH — the second wind a level grants ────────────────────────
//
// A level already tops HP, MP and Stamina back to their freshly recomputed maxima.
// Cooldowns are the fourth thing a fight burns through, and leaving them running
// made the milestone land half-empty: ding mid-fight on a full mana bar and you
// still stand there watching a 20s active tick down. So a level wipes every skill
// cooldown too — the whole kit comes back, not just the bars.
//
// This is the pure part of that: how many skills the wipe actually CUT SHORT, so
// the log only speaks up when the refresh did something (levelling with everything
// already off cooldown says nothing rather than announcing a no-op).
//
// Pure: no state, no clock, no DOM.

// `cds` is the live cooldown map (skill id → seconds remaining, i.e.
// `player.skillCds`). Returns the map to install plus the count that were still
// running. A fresh EMPTY map, not zeroes in place: the world tick walks this object
// every frame, so spent entries shouldn't outlive their cooldown.
export function refreshSkillCooldowns(cds) {
  let cleared = 0;
  for (const id in (cds || {})) if ((Number(cds[id]) || 0) > 0) cleared++;
  return { cooldowns: {}, cleared };
}
