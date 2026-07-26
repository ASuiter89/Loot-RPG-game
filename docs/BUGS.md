# Bugs & suspicious code found during the refactor

This is a **pure refactor**: behavior is preserved and these are **not fixed
inline**. They are logged here (with location + why they look wrong) so they can
be addressed deliberately, separately, later. "Suspicious" ≠ confirmed — some may
be intentional; each needs its own verification before any fix.

| # | Location (baseline `bf3e1b4`) | Symptom / why it looks wrong | Confidence |
|---|---|---|---|
| B1 | `LEGACY_EMOJI_KEYS`, index.html ~5487–5493 | Object literal with **duplicate keys** — many entries are the identical `'<span data-spr=…></span>'` string mapping to different icon keys. Duplicate keys silently overwrite, so only the last mapping per key survives and most of the table is dead. The old-emoji→icon migration it claims to do is largely a no-op. | High |
| ~~B2~~ | ~~Atlas-dimension fallbacks disagree for the same sheet~~ | **FIXED 2026-07-25** — the last stale fallback (`dlIconTrimFill`, `256`×`144`) now matches the 960×960 every other atlas reader uses. | — |
| B3 | Overlapping adjacency scanners: `enemiesAdjacent` (~19934), `adjacentEnemies` (~21550), `adjacentToPlayer` (~22130), `enemiesNear` (~22136) | Four near-identical foe-selection helpers with **subtly different predicates** (Chebyshev == 1 vs ≤ 1, goblin exclusion vs not, self exclusion vs not). Easy for callers to pick the wrong one; a likely source of off-by-one target-selection quirks. | Medium |
| B4 | Duplicated offense chain: `rollPlayerHit` (~21559) vs `applyOffenseMods` (~22226) | The full damage multiplier chain (power buff, food %, class mult, diff debuff, dmgUp, IDMG, BOSSDMG, zeal, execute, crit, armor/pen) is implemented **twice**. Not a bug today, but any future balance change applied to one and not the other silently diverges auto-attacks from skills. | Medium (drift risk) |
| B5 | `cloudScheduleSettings` (~28072) wraps `cloudEnabled()`/`authState` in try/catch | Comment admits settings setters fire **during load before cloud bindings are initialized** (a temporal-dead-zone hazard worked around, not fixed). Fragile load-order dependency. | Low |
| B6 | `PALETTE` snapshot (~5094) + `SET_RARITY_COLOR`/`ICON_EMPTY_COLOR` (~5494/5498) | `PALETTE` is a **one-time** `getComputedStyle` snapshot despite the "single source of truth" comment; and two rarity colors are hardcoded hex that must be manually kept in sync with `--set`/tokens. Any later CSS token change won't propagate to canvas. Drift risk. | Low |
| B7 | Dead code | `schedulePortalTick`/`portalTick` no-ops (~12588); `runEnemyTurn`'s combat-buff aging loop is self-described legacy/unused; `move()` compat shim; `ENEMY_BEHAVIOR` legacy map superseded by `MONSTERS[type].behavior`. | High (dead, harmless) |

## Handling policy

- Do **not** fix any of the above while extracting a module — extraction must
  preserve the current (possibly buggy) behavior exactly.
- When a fix is eventually made, it gets its **own** branch/PR with its own tests,
  and the row here is struck through with a link.

## Fixed since

- **2026-07-25 — the run modifiers that were resolved but never applied.** Four of the
  five seasonal-Cycle headline knobs (`egCycleLootWeights`/`egCyclePayout`/`egCycleXp`/
  `egCycleEnemyAffix`) and three Dread-Covenant knobs (`egCovHeal`, `egCovRarityMult`,
  `egCovBossPointMult`) were defined, displayed in the town panels, and read by no call
  site. Same shape as B7 (dead code) but player-visible: the panel promised a bargain the
  game never honoured. Now wired, with `test/smoke/run-modifiers.mjs` as the guard.
- **2026-07-25 — duplicate object keys.** `src/data/enemyDefense.js` listed `deathknight`
  twice (the deep-roster mob's profile was dead code, silently overridden by the boss row
  that shares its type key) and the `gameGuide` alias map listed `stamina` twice — the same
  class of bug as B1. `test/baseline/duplicate-keys.test.js` now fails the suite on any
  duplicate key in `src/`, so this can't recur silently.
- **2026-07-25 — skill costs disagreed across the UI.** `castSkillById` discounted a cast
  by Mana Cost Reduction; the skill bar, its tooltips and the tree did not, so a castable
  skill could grey out as unaffordable and every quoted price was too high. All prices now
  route through `src/systems/skillCost.js`.
