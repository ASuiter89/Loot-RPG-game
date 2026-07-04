# Bugs & suspicious code found during the refactor

This is a **pure refactor**: behavior is preserved and these are **not fixed
inline**. They are logged here (with location + why they look wrong) so they can
be addressed deliberately, separately, later. "Suspicious" ≠ confirmed — some may
be intentional; each needs its own verification before any fix.

| # | Location (baseline `bf3e1b4`) | Symptom / why it looks wrong | Confidence |
|---|---|---|---|
| B1 | `LEGACY_EMOJI_KEYS`, index.html ~5487–5493 | Object literal with **duplicate keys** — many entries are the identical `'<span data-spr=…></span>'` string mapping to different icon keys. Duplicate keys silently overwrite, so only the last mapping per key survives and most of the table is dead. The old-emoji→icon migration it claims to do is largely a no-op. | High |
| B2 | Atlas-dimension fallbacks: `cursorSwatchIcon` (~5885), `dlIconFill` (~6249) use `naturalHeight || 2672`; `dlIconAt` (~6234) uses `256`×`144` | Three different hard-coded fallback atlas sizes for the **same** sprite sheet; at least one is stale. Only matters before the atlas image loads, but the disagreement is a latent icon-misplacement bug. | Medium |
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
