# Refactor CHANGELOG — what moved where

A running, newest-first log of the modularization. This tracks **structure**
(code relocation, tooling) — it is distinct from the in-game `CHANGELOG` array in
`index.html` (which is player-facing patch notes). Each entry keeps the build +
test suite + smoke green.

> Legend: 🏗️ tooling · 📦 extraction (code moved out of the monolith) · 🧪 tests ·
> 📄 docs

## Balance — per-spell mana audit (staff bolt · Mage openers · a rate guard)

Follow-up sweep over all 210 actives plus every non-skill mana cost, hunting the
same hidden-tax shape the previous entry fixed globally.

- 📦 `STAFF_BOLT_MP` (2, was a bare `4`) added to `src/data/skillCosts.js`, with
  `staffBoltCost()` / `canPayStaffBolt()` / `payStaffBolt()` in `src/legacy/game.js`
  replacing the literal that had been written twice — once in `tryRangedAttack`, once
  in `updatePlayerCombat`. It now routes through `skillCastCost`, so Mana Cost
  Reduction discounts it like any cast, and returns 0 for `classNoMana()`: a
  Bloodletter failed the old `player.mp < 4` check on every swing and so silently
  never auto-attacked at all while holding a Staff.
- ⚖️ The four Mage band-0 bolts re-priced for their cadence — Firebolt / Frost Shard /
  Spark 6 → 3 MP, Arcane Missile 7 → 4. They are the ONLY 1-second-cooldown skills in
  the game and were authored at the same per-cast price as everyone else's 2-4s
  openers, so they demanded 6.00-7.00 MP/sec against a game-wide band of 0.50-3.50.
  Mage burden (median band-0/1 demand ÷ own in-combat regen) 184% → 138%, level with
  warrior 136% / windblade 137%; with the Staff bolt included, 248% → 170%.
- 🧪 New `test/data/skillManaCosts.test.js` — parses all 210 actives out of the tree
  JSON and pins cost as a RATE (cost ÷ cooldown), which is where this class of bug
  hides: a global 5.5 MP/s ceiling, a tighter 4.0 band-0 ceiling, a per-cast cap for
  any skill on a ≤1s cadence, and a check that cost growth per rank stays under damage
  growth. Verified it fails on the pre-fix values before landing.
- 🧪 `test/smoke/run-modifiers.mjs` §6 proves the staff bolt end-to-end: priced like a
  cast, halved by 100% MCR, and 0 for a no-mana hero.
- 📄 `gameState().player.boltCost` (what the next auto-attack charges; 0 for every
  non-Staff weapon) and a corrected `gameGuide("combat")` line.

## Balance — mana economy audit (cast costs · regen · auto-cast reserve)

- 📦 New `src/data/manaRegen.js` — the regen tuning that had been inlined in the
  shell: `MP_REGEN_FLAT_PER_BEAT` (0.15, unchanged), the new
  `MP_REGEN_PCT_PER_BEAT` (0.012 → 3%/sec of max MP), and
  `MANA_COMBAT_REGEN_MULT` (0.5 → 0.65), moved out of `src/legacy/game.js`.
- 📦 New `src/systems/manaRegen.js` — pure `mpRegenPerSec({maxMp, spirit, gear,
  skills, shrinePctMp}, ticksPerSec)`, `gatedMpRegen(rate, inCombat)` and
  `secondsToFullMp(maxMp, rate)`. The shell keeps the SUMS (it owns
  `totalStat`/`attrCoef`/`shrineFx`); the module owns the SHAPE. `applyRegen()` and
  `mpRecoveryRate()` both route their in-combat gate through `gatedMpRegen`, so the
  ration is applied in one place instead of two hand-copied expressions.
- 📦 `SKILL_MP_MULT` and `MANA_PER_RANK` moved from module-locals in
  `src/systems/skillMath.js` to `src/data/skillCosts.js`, beside the blood-cost
  tuning — one file to open when casting feels starved. `SKILL_MP_MULT` 1.5 → 1.0,
  so an authored `mp` on a skill node is the cost actually charged.
- 📦 `AUTO_CAST_MANA_RESERVE` (0.30) added to `src/data/skillCosts.js` and
  `autoCastAffordsMana()` to `src/systems/skillCost.js` — the mana mirror of the
  existing `AUTO_CAST_LIFE_RESERVE` / `autoCastAffordsLife` pair. Wired into
  `castSkillById`'s `auto` path, the auto-slot tooltip, and
  `gameState().autoSkill.held` (which also forces `.ready` false).
- 🧪 New `test/systems/manaRegen.test.js` (11 tests) incl. a regression pinning that
  refill time stays flat as the pool grows; `test/systems/skillCost.test.js` and
  `test/systems/skillMath.test.js` extended; `test/data/manaRegenStats.test.js`
  re-pinned to the new wiring; `test/smoke/run-modifiers.mjs` gained a §5 proving
  end-to-end that a Fortune-Seeker's auto-cast stops at the reserve while a manual
  cast still spends past it.
- 📄 `gameGuide()` "healing" (mana rules), "autocast" (both reserves) and the MPREG
  stat blurb updated off the stale "halved in combat" / "slower regen" copy.

## Feature — auto-attack shape (pierce · ricochet · multishot · rebound)

- 📦 New `src/data/autoAttackMods.js` — the modifier roster (`AUTO_MOD_KEYS`,
  `AUTO_MOD_INFO`), per-modifier ceilings (`AUTO_MOD_CAPS`), geometry + damage
  falloff (`AUTO_MOD_TUNING`, `AUTO_MOD_BOUNCE`) and the passive grant table
  (`AUTO_MOD_NODES`: node id → `{ at, grant }`, mirroring `data/passiveSurges.js` so
  the giant class-tree JSON is untouched).
- 📦 New `src/systems/autoAttackMods.js` — pure targeting/damage math with the LOS
  predicate injected the way `systems/aoeTargeting.js` does it: `clampAutoMods`
  (caps + "a Rebound always carries a ricochet"), `autoModMult` (per-hop taper),
  `nodeAutoMod`/`sumNodeAutoMods`, `pierceTargets` (ray projection + perpendicular
  offset), `ricochetChain` (built on `nextChainLink`; a bounce skips LOS and reaches
  further), `multishotTargets`, `describeAutoMods`. No DOM, no RNG, no clock.
- 📦 `src/legacy/game.js`: `autoAttackMods()` aggregates worn `ITEM_POWERS[k].auto`
  grants + ranked passives, memoized in the `loadoutCache` (bumped on every gear /
  skill change) so `attackEnemy` pays one lookup per swing; `applyAutoShape()` lands
  the extra hits through `attackEnemy`'s own `swing` closure, so each rolls its own
  accuracy, crit and on-hit procs. Sits after the Cleave % splash (which must keep
  measuring the blow itself) and before the leech lines (which should count the
  extras).
- 📦 Four new `ITEM_POWERS` — `piercing`, `caroming`, `volleying`, `rebounding` —
  each carrying an `auto` grant plus a small `stats` map so the piece is never dead
  in a single-target fight. Seven unique weapons re-pointed onto them.
- ⚖️ Auto-attack-only tuning, so none of it inflates skill builds: new
  `ATTR_DMG_PER_POINT_BASIC` (2.95, was pinned to the skill lane's 2.6) splits the
  Might auto lane off its own dial; `ATKSPD` joins the ring affix pool (2 → 3 slots
  against Skill Power's 5); `DBLSTRIKE_SCALE` 100 → 85 and the `DBLSTRIKE`/`CLEAVE`
  affix curves rise (both are paths a spell can never reach).
- 📄 Surfaced everywhere the AI-play API and the UI already report offense:
  `gameState().player.offense.autoAttack`, a `gameGuide("damage")` paragraph, a hero
  sheet row, a skill-card row on every granting node, and a new wiki article.
- 🧪 `test/systems/autoAttackMods.test.js` (40 cases — caps, the bounce implication,
  taper monotonicity, ray geometry incl. diagonals and off-line rejection, chain
  reach/LOS/no-repeat, multishot range + sight gating, and the data table's own
  invariants) and `test/smoke/auto-attack-shape.mjs`, which boots the real game,
  lays four foes out by hand and asserts one swing reaches all of them — and that a
  shapeless hero still hits exactly one.

## Art — the Gun category reads as a rifle

- 🏗️ `tools/gun-sprite.mjs` redraws `w_gun` as a long-barrelled flintlock rifle,
  measured off the shipped tiles rather than eyeballed: authored in a frame rotated
  45° so it runs corner to corner like every other long weapon (muzzle upper-left,
  butt lower-right — the angle `drawHeldWeapon` assumes when it mirrors for a
  right-facing hero), a 6px barrel to match the spear shaft's perpendicular line
  weight, and per-part gradient shading + hash grain so its colour spread sits in
  the shipped range (957 colours / mean luma 50, vs the spear's 895/58).
- 📦 The bag icon is redrawn to match, staying upright like the spear and staff
  vector icons: five bold shapes in the sword's blade/guard/grip/pommel idiom.
- 📦 Rifle art made the sub-type names wrong — a 1H "Flintlock" and a "Hand Cannon"
  both read as handguns — so they become **Carbine** (1H) and **Longrifle** (2H)
  across `WEAPON_SUBTYPES`, `data/gearBases.js`, `data/uniques.js` and the guide
  topics. Stats, reach and gates are unchanged; both uniques keep their ids.
- 🧪 `test/data/gearBases.test.js` widens the Gun coverage rule: the category is
  Luck-gated and reachable by the Rogue as well as the Fortune-Seeker.

## Feature — the Gun weapon line, and an even equip-gate grid

- 📦 New `src/data/gearBases.js` — the canonical `SLOT_BASES` roster plus the three
  equip-gate tables (`WEAPON_REQ` / `OFFHAND_REQ` / `ARMOR_REQ`), lifted out of the
  monolith so a base can never exist without a gate (or a gate without a base). The
  shell's `SLOTS[*].names` and `itemAttrReq` now read them; `BASE_SLOT` and
  `gateFor(slot, base)` are derived there too.
- 🧪 `test/data/gearBases.test.js` (new) enforces the two coverage rules the audit
  produced: **every slot offers a base gated on all five attributes**, and **every
  class has a weapon gated on each attribute its skills scale off**. It parses
  `CLASSES` / `WEAPON_SUBTYPES` out of the monolith as text (the
  `test/data/classRoster.test.js` pattern), so the rules track the shipped tables.
- 🧪 `test/data/uniques.test.js` and `test/data/itemSets.test.js` import `SLOT_BASES`
  instead of each hand-copying it, so a new base without its unique fails there
  rather than sliding past a stale fixture.
- 🏗️ New `tools/gun-sprite.mjs` — hand-authors the `w_gun` atlas tile and writes it
  into the packed sprite atlas at cell 99, the one free slot. Idempotent: every
  other cell round-trips byte-identically through the canvas encoder. (Redrawn as a
  rifle in the art pass below.)
- 📄 The `gear`, `classes`, `weapons-reach` and attack-speed guide topics plus the
  wiki's "Bases & Class Lean" entry describe the Gun category and the even gate grid.

## Balance — per-flask Potency, depth-priced Blessings

- 📦 New `src/data/goldDrops.js` — the kill-payout roll's constants (`GOLD_DROP_MIN`/
  `MAX`/`PER_DEPTH`, plus `GOLD_DROP_FLAT` as the roll's mean). The shell's gold drop
  now reads them instead of the inline `rnd(2, 8) + dungeonLevel * 3`, so the price
  curve below and the payout can't drift apart.
- 📦 `systems/healerBuffs.js` — `blessingCost(base, depth)` replaces the hero-level
  curve (`BLESSING_COST_GROWTH`/`BLESSING_COST_CAP` retired) with `base ×
  BLESSING_DISCOUNT × avgGoldDrop(depth)/avgGoldDrop(1)`. New `avgGoldDrop(depth)`
  exported alongside. Price now tracks the floor's income linearly, so no cap is
  needed. Both call sites in the shell pass `curDepth()`.
- 📦 Potion Mastery is four tracks, not three: `POTION_TRACKS` gains `pwrhp`/`pwrmp`
  (`potionPowerHpLvl` / `potionPowerMpLvl`) and `potionPowerLvl(flask)` takes a flask
  like `potionCdLvl` does. A save-load migration hands an older hero their old
  `potionPowerLvl` ranks on BOTH flasks, then retires the field.
- 🧪 `test/data/goldDrops.test.js` (new) pins the roll; `test/systems/healerBuffs.test.js`
  covers `avgGoldDrop`, the half-off cut, the flat price/income ratio, and that the new
  curve undercuts the old one at every depth.
- 📄 `gameState().player.potionSip` (share + amount + rank, per flask) and the
  `healing` / `town` guide topics describe the split tracks and the new pricing.

## Feature — special item kinds (and "Cursed" stops lying)

- 🐛 **The reported bug was a NAME collision, not the curse math.** `'Cursed'` sat in
  the cosmetic `PREFIXES` table, so an ordinary green rolled as a "Cursed Cap" with no
  drawback anywhere on it — every screenshot of a "cursed item with no negative stats"
  was a plain item wearing the word. Replaced with `'Gilded'`; a special item is marked
  by its FLAG + pixel icon, never by its name. `renameLegacyCursedPrefix` heals saved
  names (bag, both gear sets, stash, wardrobe) through the new `healItemName`.
- 📦 New `src/data/specialItems.js` — the kind table (`SPECIAL_ITEM_KINDS`: weight,
  label, atlas sprite, value multiplier, flavour, blurb) plus per-kind tuning
  (`FORTUNE_STATS`/`FORTUNE_TIER_MULT`, `DEEPFORGE_ILVL`, `STORIED_EXTRA_STATS`).
- 📦 New `src/systems/specialItems.js` — `rollSpecialKind(rng, kinds)` (weights read as
  percentage points, so they sum to the 22% special rate), `eligibleSpecialKinds` /
  `fortuneStats` (Fortunate needs a finder stat in the slot pool), `fortuneStatValue`,
  `deepforgeIlvl`, `storiedStatCount`. Pure — rng injected, no DOM.
- 📦 `generateItem` now rolls the kind BEFORE affixes (deepforged/storied shape how
  they generate) and applies cursed/fortunate after. The old inline `Math.random() <
  0.12` curse block became one branch of the family; curse math still lives in
  `systems/curseRoll.js`.
- 📦 `lockedStats` now also protects a fortunate item's finder stat, so the Enchanter
  can't reroll the outsized roll back down to a normal one.
- 🐛 `repairCurseOverflow` clamped EVERY loaded item to the curse ceiling — and a
  fortunate roll out-reaches that ceiling by design, so a stash/load round trip would
  have silently shaved every fortunate item. The bound is per-stat now.
- 📦 `curseMark` → `specialMark` (+ `specialKindOf`), driving the marker off the kind
  rather than the cursed flag; `test/smoke/handler-globals.json` follows the rename.
- 🧪 `test/systems/specialItems.test.js` — weight bands and the null tail, eligibility
  (and that an ineligible kind is dropped, not re-weighted), the fortunate ceiling
  relationship vs `cursedStatCeiling` (the invariant the repair bug broke), deepforge
  monotonicity + clamping, storied counts.
- 📄 `gameGuide("loot")` splits into one paragraph per kind and reports `special` /
  `fortuneStat` / `curseStat` on each item; the wiki's "Cursed Items" page is now
  "Special Items"; onboarding copy reads "set & special pieces".

## UI — the stair into a guardian floor rings red

- 📦 New `src/systems/descentSignal.js` — the boss-floor cadence (`BOSS_EVERY`,
  `isBossDepth`) plus `descentSignal(dl)`, which answers whether the down-stair on a
  floor drops you onto a guardian. Pure: a depth in, a `'boss'`/`'normal'` key out.
- 📦 `src/legacy/game.js`: the cleared down-stair's pulsing ring picks its colour from
  that key — `PALETTE.danger` when a guardian waits below, `PALETTE.gold` otherwise —
  and both stroke and glow now read from the `PALETTE` mirror instead of hardcoded
  `rgba(...)` literals. Legacy `isBossLevel` delegates to `isBossDepth`, so the every-5th
  cadence has one home.
- 🧪 `test/systems/descentSignal.test.js` — the cadence across tier boundaries and into
  Endless, the descent that lands on a guardian, and garbage depths.
- 📄 `gameState().stairs.bossBelow` exposes the same fact; `gameGuide("bosses")` and the
  floor-clear topic describe the red ring.

## Fix — a hunting foe never wedges itself behind cover

- 📦 New `src/systems/chasePath.js` — the chase search, extracted from the legacy
  `enemyPathStep` BFS and generalised to a `size x size` BODY. `chaseStep(...)` floods
  over body PLACEMENTS (so a wide foe only steps where its whole bulk fits and refuses
  a gap narrower than itself), keeps the no-diagonal-squeeze rule, and — the part that
  fixes the report — returns a step toward the CLOSEST reachable placement when the
  hero is unreachable, so nothing ever freezes out of reach. `bodyDist`/`bodyFits` are
  exported for the geometry. Pure: flat `blocked`/`solid` grids in, one step out.
- 📦 `src/legacy/game.js`: `enemyPathStep` is now a thin wrapper that hands the module
  the current grids and the foe's footprint. The multi-tile branch of `enemyMove` calls
  it instead of the old greedy "step on x, else step on y" — a single solid tile on the
  one axis that mattered used to pin a boss in place permanently. Its corner-cut test
  now reads walls **and** furniture (matching `enemyStep`'s own check) so a planned
  diagonal is never one the step then refuses. `hasLineToPlayer` sights from any tile of
  a wide body, not just its top-left anchor.
- 🧪 `test/systems/chasePath.test.js` — routing around walls, the reported
  boss-behind-a-rock case, refusing a one-row gap a 2x2 body can't use (while a lone
  foe slips through it), never overlapping solid, stopping beside rather than on the
  hero, the corner-cut, the closest-approach fallback, and the 16-bit stamp wrap.
- 🧪 `test/smoke/boss-pathing.mjs` (+ `npm run smoke`) — drives the REAL AI over
  deterministic arenas via a new `__bossChaseTest()` preview hook; verified to fail
  against the old greedy code (`stuck: true`, zero tiles moved).
- 📄 `gameGuide("enemies")` now states that foes pathfind around cover, that cover
  breaks line of sight without pinning anything, and how a wide body's footprint
  limits which gaps it can take.

## Balance — the second skill tier waits for level 6

- 📦 New `src/data/skillTiers.js` — the tier→hero-level ladders, extracted from the
  legacy `WEB_BANDS`/`SKILL_BANDS`/`ASC_BANDS` locals. `SKILL_TIER_LEVELS` gates both
  base webs (`[1, 6, 9, 16, 24, 30]`; tier 1 was 4) and `ASC_TIER_LEVELS` keeps the
  path tree's cosmetic default. The dead grid ladder (`SKILL_BANDS`, reachable only by
  a non-ascension `buildTree` call that no longer exists) folded into the web one.
- 📦 New `src/systems/skillTiers.js` — `tierUnlockLevel(tier, ladder)` /
  `tierUnlocked(level, tier, ladder)`, the clamped lookup `buildWeb`/`buildTree` now
  call instead of indexing a local array.
- 🧪 `test/data/skillTiers.test.js` + `test/systems/skillTiers.test.js` — the ladder's
  shape (ascending, affordable at one point per level), the level-6 gate, clamping
  past the last tier, and the empty/missing-ladder fallbacks.
- 📄 `gameGuide("skills")` and the wiki's Levelling page now name the tier ladder.

## Feature — the camera pulls back for a boss fight

- 📦 New `src/systems/cameraZoom.js` — the follow camera's view width, extracted from
  the legacy `const VIEW_TILES = 13`. `targetViewTiles()` picks the stop (13 normal,
  17 while a guardian lives); `makeZoom`/`stepZoom`/`zoomAnimating` run a smoothstep
  glide between them. Pure: no DOM, no clock — `game.js` owns the value and feeds it
  a frame delta.
- 📦 The pull-back is capped by `MIN_BOSS_TILE_PX` rather than a fixed number, so a
  phone or a foldable cover screen gets less of the effect instead of an unreadable
  one; a screen already below that floor stays at the normal view.
- 🧪 `src/legacy/game.js`: `viewZoom` + `updateViewZoom(dt)` in the frame loop, and
  `drawLPCTerrain` now takes the STRETCH path while the glide is in flight — the same
  one a live window drag uses. A glide crosses a dozen integer tile sizes inside a
  second, and a full-floor terrain bake at each would hitch the fight. `resizeCanvas`
  snapshots the map box's shorter axis in CSS px so the camera never forces layout.
- 🧪 `test/systems/cameraZoom.test.js` — the stops, the small-screen cap, the ease
  curve (leans in rather than lurching), exact landing, frame-rate independence,
  mid-glide reversal, and that a settled frame allocates nothing.

## Fix — boss arenas are big enough for the guardian that holds them

- 📦 `src/systems/bossArena.js` now owns the arena RADIUS too (`ARENA_R`, 15 — was a
  legacy-local `BOSS_ARENA_R = 10`), so the one constant every clearance rule is
  derived from sits beside those rules. `src/legacy/game.js` imports it.
- 📦 The perimeter lap lane is measured in TILES (`ARENA_RING_TILES`) instead of as a
  fraction of R. A fraction thins to ~2.6 tiles on the diagonals — exactly where the
  corner cover sits — so a 3×3 guardian could squeeze past a pillar on one exact tile
  and, since it lumbers greedily rather than pathing, visibly wedged there instead.
  New `maxFeatureR()` takes the tighter of the tile ring and the old fraction.
- 📦 A blob reaching past that bound is now slid inward WHOLE (`pullInside`) rather
  than having its out-of-bounds cells dropped, so a 2×2 column can't come out an L.
  The plaza and N-S lane widen to match (`ARENA_PLAZA_CHEB` 4, `ARENA_LANE_HALF` 2).
- 🧪 `arenaNavIssues` gains `'boss-pinch'`, backed by exported `pinchAnchors()` —
  articulation points of the guardian's roaming graph, i.e. the one-tile needles it
  wedges on. Every shipped layout had them at R=10 (the Elder Dragon's roost: 36);
  all fifteen are at zero now. Gated to multi-tile guardians, since a 1×1 foe paths
  around obstacles and legitimately noses into single-tile nooks.
- 🧪 `test/systems/bossArena.test.js` grows the ring/lap-lane, blob-integrity and
  pinch cases; it now runs at `ARENA_R` rather than a hardcoded 10.

## Fix — a death on the beach tutorial stays on the beach

- 📦 New `src/systems/shoreDeath.js` (`deathRoute`) — the priority order a killing
  blow resolves through (Last Stand → revive bowl → Hardcore permadeath → the shore
  retry → town), lifted out of `handleDeath`'s inline `if` chain and unit-tested.
- 🧪 `src/legacy/game.js`: new `shoreDeath()` beside `handleDeath()`. Falling on the
  opening beach used to revive the hero in TOWN — and a save taken in town never
  resumes the shore (`savedOnShore`), so one lost first fight skipped the tutorial,
  its starter weapon and its level-up for good. The shore is now rebuilt around the
  hero at no cost (bag kept, no gold/XP taken, no grave); `showDeathScreen` gained an
  `onShore` variant and `gameState()` a `shore` flag (the beach and real floor 1 both
  run at depth 1). Hardcore is untouched: one life, beach included.
- 🧪 `test/smoke/tutorial-resume.mjs` grows a step 4 — kill the hero on the resumed
  shore and assert the beach rebuilds, the bag survives and the save still reads the
  shore.

## Fix — the run modifiers a hero opts into now actually apply

- 📦 New `src/data/skillCosts.js` (`MIN_CAST_COST`, `LIFE_COST_PER_MP`,
  `BLOOD_PRICE_MULT`, `AUTO_CAST_LIFE_RESERVE`) + `src/systems/skillCost.js`
  (`castCost`, `lifeCost`, `canAfford`, `autoCastAffordsLife`, `costLabel`). The
  price of a cast was computed in three places with three different answers — the
  shell discounted the rank cost by Mana Cost Reduction, `gameState()` mirrored it,
  and the HUD did not — so a hero with MCR read a price they weren't charged and saw
  castable skills greyed out. The shell's `skillCastCost` / `skillBloodCost` /
  `canAffordSkill` / `skillCostText` are thin wrappers over the pure module, and
  every bar, tooltip, tree node and snapshot now reads through them.
  `gameState().skills[i]` gains `hpCost` (the blood a life-caster pays; 0 otherwise).
- 📦 New `src/data/seasonAffixes.js` + `src/systems/seasonAffix.js` — the
  frenzied / volatile / armored modifiers a Cycle's headline rule names. The rule
  table has always carried an `enemyAffix` knob; nothing resolved it, so the affix
  was inert. `enemyAttackInterval` and `enemyArmorBase` now read it, and
  `onEnemyDefeated` detonates a volatile corpse (non-lethal, capped at a share of
  max HP, like every other hazard).
- 🧪 `src/legacy/game.js`: the four remaining cycle hooks (`egCycleXp`,
  `egCyclePayout`, the new `egCycleTierShift`, `egCycleEnemyAffix`) were **defined
  and never called** — only `egCycleDensity` was wired — so four of the five
  headline knobs did nothing. All XP grants now funnel through one `grantXp`; bounty
  gold goes through `egCyclePayout`; `rollTier` shifts its rolled tier via
  `seasonShiftTier` (never past a locked colour). `egCycleMod()` is memoized on
  (live cycle | enrolment) so the hot paths don't re-resolve per call.
- 🧪 Same for the covenants: `egCovHeal` was dead (the healing debuff applied
  nowhere) and `egCovRarityMult` / `egCovBossPointMult` were only ever displayed.
  Healing is now scaled in `queueHeal` + the instant branch of `applyHeal` (never
  twice); rarity scales the per-tier chance and its cap in `rollTier`; and because a
  boss point is DERIVED from the first-clear ledger, the boss-point multiplier banks
  its fraction on `player.dreadBossPoints` (absent on old saves → 0) and pays a whole
  point each time it crosses 1, read back through the new `bossPointsPool()`.
- 🧪 `gameState().endgame.cycle` gains `cycleId`, `rule` and `applied` so an agent
  can see which rule is live and the values it is actually applying.
- 🧪 New `test/systems/skillCost.test.js`, `test/systems/seasonAffix.test.js`, and
  `test/smoke/run-modifiers.mjs` (drives the real built game: enrol → every knob
  moves; un-enrol → neutral; swear → healing docked and rarity up; MCR un-greys a
  castable skill; a blood-caster's auto-cast holds its reserve).
- 🧪 New `test/baseline/duplicate-keys.test.js` fails the suite on a duplicate object
  key anywhere in `src/` (esbuild's `duplicate-object-key` warning). It caught two:
  `src/data/enemyDefense.js` defined `deathknight` twice — the deep-roster mob's
  tuned profile was dead, silently overridden by the boss row that shares its type
  key — and the `gameGuide` alias map listed `stamina` twice. `esbuild` is now an
  explicit devDependency (it was already present transitively via Vite).

## Feature — three new classes; the mercenary system removed

- 📦 `src/data/attributeScaling.js` grows from a 4-rank to a 7-rank
  `CLASS_SCALE_LADDER`. The three new classes INTERLEAVE at ranks #3/#5/#7 so the
  four original classes stay at #1/#2/#4/#6 — whose ladder values are exactly the
  old `[1.20, 1.00, 0.78, 0.55]`. Adding a class therefore re-tuned **nothing**;
  `test/systems/attributeScaling.test.js` pins that invariant per channel.
- 📦 New `CLASS_DMG_ATTR2` + `ATTR_DMG_PER_POINT_HYBRID` model a HYBRID class whose
  skills scale off the SUM of two attributes at a lower per-point rate (so a point in
  either is worth the same and there is no dump-stat skew). `src/systems/attributeScaling.js`
  gains the pure `classDamageAttr2`, `classDamageAttrs`, `isHybridClass`,
  `classDmgPerPoint`, `skillAttrPower` and `skillAttrCoef`; the shell's
  `skillAttrDamage` / `physModelAttrDamage` / `attrPowerAxes` route through them
  instead of re-deriving the single-attribute case inline.
- 🧪 `src/legacy/game.js` gains the three classes: `CLASSES`, `CLASS_DMG_DEALT`/
  `CLASS_DMG_TAKEN`, the innate-passive one-liners, `SKILL_TREES` (30 passives +
  30 actives each, 180 nodes), six `ASCENSIONS`, `SKILL_BRANCHES`/`SKILL_BRANCH_DESC`
  and `lastStandLog` lines. Node ids keep the `<letter>_<p|a><band><branch>` shape
  (`f_`/`z_`/`l_`) that `tools/skill-icons/skills.mjs` parses icon keys out of.
- 🧪 NO-MANA classes: new `CLASS_NO_MANA` / `classNoMana` / `paysSkillsInLife` /
  `skillLifeCost`, generalizing the existing Blood Pact life-cost path.
  `baseMaxMp()` returns 0, both MP HUD rows and the mana flask hide, the hero sheet
  drops its mana rows, and a single `canAffordSkill` predicate now backs the skill
  bar, the tooltips and `gameState().skills[].ready` so they cannot disagree with
  `castSkillById`. A no-mana cast costs a SHARE of max HP, so it keeps mattering at
  depth; it can never be lethal and never interrupts the Spirit Veil window.
- 📦 Hero walk art accepts SINGLE-ROW (front-facing) strips: `HERO_STRIP_ART` +
  `_mkStripSheet` mark a sheet `_rows: 1`, and `drawHeroWalk`/`heroWalkIcon` clamp to
  row 0. The three new classes reuse the former mercenary walk strips; swapping in
  full 4-direction art later needs no draw-code change.
- 🗑️ The Sellsword keeper and the whole mercenary system are removed:
  `src/data/mercenaries.js`, `src/systems/mercPricing.js` and their tests are
  deleted, along with `spawnMerc`/`openMercCamp`/`renderMercCamp`/`hireMerc`, the
  `.merc-card` CSS one-off, the town roster entry and the wiki/guide copy.
  `TOWN_SERVICE_ARRIVALS` renumbers so the keeper ladder stays contiguous.
- 🧪 New `test/data/classRoster.test.js` — the first coverage the class trees and the
  per-class `ASCENSIONS` have ever had. It parses the monolith as text (the
  `test/systems/vfx.test.js` pattern) and asserts unique node ids, resolvable
  same-tree prerequisites, packed `@ks` keystone tiles, per-class branch tables, and
  that the three new classes stay summon-free (one sprite on screen each).
- 🧪 New `test/smoke/new-classes.mjs` (wired into `npm run smoke`) drives the real
  built game: the picker offers all seven, each tree renders and its roots are
  learnable, Luck moves Fortune-Seeker skill damage, both Windblade attributes pay
  equally, and the Bloodletter's cast spends health in proportion to max HP and is
  refused rather than lethal at 1 HP.

## Feature — music-style picker is multi-select

- 📦 New leaf `src/systems/musicVibe.js`: pure selection math over an injected rng —
  `parseVibe`/`serializeVibe` (stored as `'auto'` or a sorted index list; an old
  single-index save still parses), `toggleVibe`, `pickVibeSection` (next style from
  the allowed pool, avoiding the current one when the pool leaves a choice), and
  `pickStartSection`. Unit-tested (`test/systems/musicVibe.test.js`).
- 📦 `src/data/musicSections.js` gains `MUSIC_VIBE_TAGS` (a genre tag per style),
  driving the picker labels from data; the data test enforces one tag per style.
- 🧪 `src/legacy/game.js` swaps the single-lock vibe logic for the new module: the
  soundtrack drifts only among the selected styles (`applyMusicVibe`), and the native
  `<select>` becomes a fluid chip grid (`renderMusicVibeControls` → `toggleMusicVibe`
  / `setMusicVibeAll`, both window-bridged + in the smoke handler allowlist).

## UI — skill detail card decluttered; damage clause extracted

- 📦 New leaf module `src/systems/skillText.js`: pure `stripDamageClause` that strips
  a description's `{dmg}` clause (in a handful of grammatical frames, with a
  bare-"damage" fallback for novel ones). The detail card uses it so its flavour line
  no longer repeats the range shown in its own Damage / DPS rows.
- 🧪 `test/systems/skillText.test.js` covers each frame + the fallback / idempotence /
  empty-input guards.
- 📄 `.sk-pop` styling neutralized in `src/styles.css`: the type line, mech chips,
  on-rank-up values, the renamed "Surge bonuses" ladder (was "Rank bonuses"),
  requirement rows and the secondary buttons drop their accent colours; the sole
  remaining pop is the pink surge glow on the Learn button when a level-up crosses a
  rank-3/7/10 milestone. Refund / off-bar buttons use monochrome outline glyphs.

## Feature — Shrine boons are data-driven (15 new kinds)

- 📦 New leaf `src/data/shrines.js`: the whole Shrine catalog (classic +
  15 new kinds) as pure data — name/icon/flash/floors/`fx` magnitudes/log per kind.
- 📦 New `src/systems/shrineEffects.js`: pure `defaultShrineBuffs`, `shrineFxFrom`
  (summed boon magnitude for an effect key — the shrine twin of foodFx/healerFx),
  `activeShrineBuffs`, and the weighted `pickShrineKind`. Unit-tested
  (`test/systems/shrineEffects.test.js`).
- 🧪 `activateShrine()` keeps the five classic cases and routes every other kind
  through one generic `applyShrineBoon()`; new boons fold into combat live via
  `shrineFx(key)` terms added beside the existing foodFx/healerFx terms (gold, xp,
  crit, dodge, magic/material find, spell/skill power, lifesteal, thorns, HP/MP
  regen, defense, move & attack speed, plus a free-Stamina Vigor gate). The status
  strip / gameState effects / STATUS_META now iterate the catalog, and `window.buffs`
  is exposed through the `__dlLive` test seam. Healing Fountain also tops Stamina.

## Tooling — changelog merge conflicts auto-resolve (`merge=union`)

- 🏗️ New `.gitattributes` marks `src/data/changelog.js` `merge=union`: git keeps
  BOTH sides' prepended entries when merging/rebasing instead of conflicting, so two
  open `claude/*` PRs no longer collide on the changelog (only same-day order may
  shuffle — cosmetic; the data test pins date order only). GitHub honors this
  server-side, so PRs stop going "dirty" on the changelog and auto-merge stops
  skipping them. Verified with an isolated two-branch prepend/merge test.
- 📄 `CLAUDE.md` "stalled PR" rule updated to describe the union-merge behavior.

## Feature — name screen requires a hero name

- 📦 New leaf module `src/systems/heroName.js`: pure `normalizeHeroName` (trim +
  collapse whitespace + 16-char cap) and `isValidHeroName`, lifted out of the
  inline name-parsing in `submitName()`. Unit-tested
  (`test/systems/heroName.test.js`, 100% cov).
- 🧪 `submitName()` now rejects a blank name and nudges the box (scroll-to-top +
  shake with a danger border) instead of silently defaulting to "Adventurer";
  name-screen copy trimmed, and the leaderboards link + play glyph dropped.

## Tooling — hands-off PR pipeline (auto-open on push)

- 🏗️ New `.github/workflows/auto-pr.yml`: a push to a `claude/*` branch opens its
  PR into `main` (idempotent) and dispatches `auto-merge.yml`, so a session's job
  ends at "push" — CI opens the PR and merges it on green. Closes the loop
  push → auto-pr → auto-merge → deploy with no human step. Uses the built-in
  `GITHUB_TOKEN`, or an `AUTO_PR_TOKEN` PAT secret when the repo's "Actions may
  create PRs" setting is unavailable.
- 📄 `CLAUDE.md` PR rule + feature checklist updated: sessions don't open or ask
  about the PR — a green, pushed branch is "done".

## Feature — Floor-5 town unlock; keeper waves; strolling townsfolk

- 📦 New leaf module `src/systems/townWander.js`: pure helpers for the town's
  strolling keepers — `randomDistinctTiles` (fresh random keeper spots each visit),
  `wanderNeighbors`/`pickWanderTarget` (in-patch orthogonal amble with an injected
  rng), and `joinNames` (the arrivals banner's "A, B & C" join). Fully unit-tested
  (`test/systems/townWander.test.js`, 100% cov).
- 📦 `src/data/townLayout.js` gains `TOWN_SERVICE_WAVES` (keeper → boss-kill wave),
  `TOWN_ENDGAME_KINDS` (the fixed sanctum keepers), and `TOWN_WANDER` (stroll tuning).
- 🧪 The legacy shell: town is sealed until the Floor 5 guardian falls (`townUnlocked`
  gates the Town Portal); keepers now unlock by boss-kill WAVES via a single
  `townServiceReq`/`townServiceAvailable` (the ad-hoc per-keeper level/depth/difficulty
  `req`s on `TOWN_MENU` are gone). `buildTown` scatters the regular keepers to random
  reachable tiles and gives most a slow wander (`updateTownNpcs` on the frame loop);
  endgame keepers keep their grove. A `checkTownArrivals` + `showNpcBanner` pair pops
  an arrivals banner (`#npc-banner`) when a wave lands; `graduateToTown` carries the
  hero from the first Floor 5 clear into the celebrating camp with Floor 6 held for the
  Town Portal. New persisted `player.pendingTownGraduation` + `player.knownServices`
  (save-migration seeds a silent baseline). The HUD BOUNTY/MEALS belt chips gate on
  their keeper. `gameState().menu.townServices` + the `gameGuide("town")` topic follow.

## Removal — Ascendant Weave glyphs & sockets; bigger board + more keystones

- 📦 Deleted `src/data/glyphs.js` + `src/systems/glyphRoll.js` (and their tests
  `test/data/glyphs.test.js`, `test/systems/glyphRoll.test.js`). The Weave no longer
  has a socketable-gem layer; its power is nodes + keystones only.
- 📦 `src/systems/ascendantWeave.js` drops `socketIndex`/`glyphRadiusNodes` and the
  glyph amplification path; `weaveStatContribution(board, attrs, data)` loses its
  `glyphs` argument. `keystonesActive` now AND-combines any of `{attr,total}`,
  `{n}`, and a new `{boardPts}` (total board spend) gate condition.
- 📦 `src/data/ascendantWeave.js` grows each arm from 5 nodes/3 rings to 7 nodes/4
  rings (a band-4 apex pair), drops the `sockets` table, and expands the keystone
  list from 8 to 24 with laddered, higher gates.
- 🧪 The legacy shell removes glyph drop/socket UI, imports, `player.weaveGlyphs`
  (save-migration now deletes it), the deep-Endless glyph faucet, and the
  `weaveSocketUI`/`weaveUnsocketUI` window bridges; `gameState().endgame.weave`
  swaps the `glyphs` count for `spent`. Unused `glyph*` atlas tiles pruned from
  `src/assets/endgameArt.js`.

## Removal — Boss-point gear-slot investment

- 📦 Deleted `src/systems/bossSlots.js` + `src/data/bossSlots.js` (and
  `test/systems/bossSlots.test.js`). That feature let a hero spend Boss Points to
  level gear slots per gear set; it's removed. Boss Points now feed only the
  Ascendant Weave.
- 📦 New leaf module `src/systems/bossPoints.js` keeps the one helper still needed —
  `pointsEarned` (boss points = distinct boss floors first-cleared) — which the Weave
  and the town-service gate consume. `test/systems/bossPoints.test.js` covers it.
- 🧪 The legacy shell drops all gear-slot wiring: `slotMult`/`slotLevels`, the GEAR-tab
  panel + nudge, the Trainer respec row, the leaderboard slot-level badge, and the
  save-migration now deletes any stored `player.slotLevels`. `gameState().menu`
  swaps `bossSlots` for a plain `bossPointsEarned`; the `progression` guide topic
  now points at the Weave.

## Feature — Bestiary codex & unique/set Collection vault tab

- 📦 New pure module `src/systems/bestiary.js` holds the kill-gated reveal logic
  shared by the live inspect card and the new Bestiary screen: `isBestiaryFieldKnown`
  (a regular species reveals one stat field per kill-threshold, fully known at the
  cap; a boss is all-or-nothing on its first kill), `fieldRevealThreshold`,
  `speciesDiscovered`, `bestiaryRevealRatio`. The monolith's `statKnown` now
  delegates to it.
- 📦 New pure module `src/systems/uniqueCollection.js` turns the static unique/set
  data into the Collection tab's model: `buildCollectionCatalog` (one entry per
  authored artifact), `itemCatalogKey` (maps a stored item back to its slot),
  `groupStoredArtifacts` (best-roll-first stacks over `stash.items`, so the tab is a
  pure VIEW — no new save data), `collectionFacets`/`filterCatalog`/`acquiredKeySet`/
  `collectionProgress`. The legacy `renderStash` now renders Storage + Collection
  tabs; a per-species specimen record (`player.bestiaryLore`) is captured on kill so
  the codex has depth-scaled numbers to show. `gameState().menu` gains `bestiary` +
  `collection` summaries; `gameGuide` gains `bestiary` + `collection` topics.
- 🧪 `test/systems/bestiary.test.js` and `test/systems/uniqueCollection.test.js`
  cover the reveal thresholds, boss gating, catalog build, item→slot keying,
  best-first grouping, filtering and progress.

## Fix — AoE spells blast from the point of impact

- 📦 New pure module `src/systems/aoeTargeting.js` holds the per-shape line-of-sight
  targeting brain: `castTargetsInSight` (a BLAST spreads its splash from the impact
  point — LOS judged from the detonation, not the hero — while bolt/nova/line
  radiate from the hero), `splashTargetsFrom` (foes an impact tile can see, reused
  by mark **detonation** bursts), `nextChainLink` (a chain arc jumps foe→foe, each
  hop's LOS judged from the previous link), and `isImpactAoeShape`. All pure over an
  injected LOS predicate.
- The monolith's `resolveCast` now delegates to it: blast/chain target the nearest
  foe the hero can SEE (new `nearestVisibleFoeInRange` adapter), a blast's radius
  damage and detonation bursts spread from the impact via LOS from that point, and
  `chainTargets` gates each link with `nextChainLink`. Fixes area spells (Meteor,
  Fireball, Blizzard, …) only hitting foes the HERO could see rather than the whole
  pack around the impact. `gameGuide("skills")` updated.
- 🧪 `test/systems/aoeTargeting.test.js` — the meteor-behind-a-wall fix, impact-LOS
  splash, projectile-can't-reach fizzle, chain-bends-around-a-corner, and guards.

## Feature — build-aware gear Power

- 📦 The **Power model** moved out of `src/legacy/game.js` into pure, testable
  modules: `src/systems/gearPower.js` holds the effective combat-score math
  (`combatScore` = normalized effective offense + survivability, `powerScalar` its
  concave-compressed form, `offenseScore`/`defenseScore`, `applyDelta`,
  `marginalPower`); `src/data/gearPower.js` holds every tuning constant. Power is
  now the marginal combat-score an item's affixes buy for the CURRENT build, so a
  stat the hero can't use (Crit Damage with no crit, Spell Power on a martial
  build) adds ~0. The old static `STAT_POWER_WEIGHTS` / `statPowerWeight` /
  `attrPowerWeight` / `ATTR_POWER_WEIGHT` / `ATTR_DMG_POWER` / `TIER_POWER_BONUS`
  and their window-bridge entries are gone.
- The monolith keeps a thin **adapter**: `buildPowerContext` (the live build read
  into a numeric context, cached per loadout epoch, buffs/food excluded so Power is
  a stable property), `itemPowerContribution` / `attrPowerAxes` (affixes → context
  deltas), `itemFlatPower` (build-independent utility/tier nudge), and the
  rewritten `itemPower` / `playerPower` / `equipUpgradeDelta` /
  `gearContributionPower` / `gearSetPower`. `playerPower` = `K·powerScalar(build)`
  + worn flats, and "from gear" is a clean delta so POWER decomposes exactly into
  gear + level/attribute/skill base.
- `gameState().player` now reports `power` + `gearPower`, each `brief` gear item
  carries `pow` + `upgrade`, and `gameGuide("power")` explains the model. Smoke
  contract gains the `power` topic.
- 🧪 `test/systems/gearPower.test.js` — the crit-damage-with-no-crit-is-zero case,
  class/build gating (Spell Power vs. Attack Speed, leech scaling with DPS),
  monotonicity, calibration range, naked-hero no-crash, and add/remove symmetry.

## Feature — equipment sets reborn as fixed named artifacts (20 sets)

- 📦 The set **roster** lives in `src/data/itemSets.js` (`ITEM_SETS`) — now 20
  sets, each a family of pre-defined, NAMED `pieces` shaped exactly like a unique
  (`{id, base, slot, name, native, mods[6], power, flavor}`) plus set-level
  `bonus` tiers and a completion `power`. Pure helpers live in
  `src/systems/itemSets.js`: `setPieceCount`, `setTopTier`, `setComplete`,
  `setStatContribution`, `setSlots`, `setPiecePool`, `rollSetPiece`,
  `setsCoverAllSlots`.
- 🏗️ `buildUnique` was refactored into a shared `buildFixedArtifact(def, lvl,
  membership)`; `buildSetPiece` reuses it, stamping `item.set`/`item.setPiece`
  (instead of `item.unique`) so a set piece is a fixed artifact (native + six
  mods + its own power + `baseStats`, `fixed:true`) that ALSO feeds the
  worn-count set bonuses. `generateItem`'s red-tier branch now short-circuits to
  `buildSetPiece(pickSetPiece(forceSlot), lvl)` or `buildUnique(...)`; the old
  random-affix-plus-`item.set`-tag path is gone.
- Set pieces now inherit unique treatment everywhere: the Enchanter leaves them
  read-only (set-aware "Set piece — properties fixed on drop" copy in the detail
  card + fixed-enchant view), the loot banner still reads "SET PIECE" in teal, and
  `gameState()`'s brief item surfaces `set`/`setPiece`/`fixed`. The wider set
  tooltip lists the set's named pieces and ticks the ones you wear. `gameGuide`
  loot/autoloot topics rewritten.
- 🧪 `test/systems/itemSets.test.js` (piece counts, completion, contribution,
  slots, pool, slot-scoped piece rolls, coverage) and a rebuilt
  `test/data/itemSets.test.js` that mirrors the unique conventions per piece
  (native/headline/6-mods/caster-martial/power/flavor/distinct-signature) plus
  set-level shape, varied sizes and full slot coverage.

## Feature — fractional damage rolls + spell damage ranges + per-hit tooltips

- 📦 Pure **damage-roll math** extracted to `src/systems/damageRoll.js`:
  `rollDecimals`/`quantizeRoll` (≈3-significant-figure precision — 2 decimals below
  10, 1 below 100, whole numbers at 100+), `rollDamage` (a continuous, injected-rng
  roll over a range) and `spreadRange` (a spell's symmetric low–high from its center
  and a spread fraction). Injected rng keeps it deterministic and unit-tested.
- 📦 Per-spell **damage spreads** live in `src/data/spellSpread.js`
  (`SPELL_SPREAD` map + `DEFAULT_SPELL_SPREAD` + `spellSpreadFor`) — how wide each
  spell rolls, authored for variety (tight bolts, wild storms).
- The monolith now imports both: `getWeaponDamage` and `skillSpellDamage` roll
  fractional values (so a small range doesn't collapse into a few integers once
  buffs scale it); `rollPlayerHit` defers its rounding to the end so that roll
  survives the multiplier chain; spells roll `spreadRange(center, spread)`.
- `skillDamagePreview` reworked to return a **per-hit** Damage range (+ a separate
  `strikes` count and an absolute-`base` range), fixing the tooltip that multiplied
  the range by hit count. Descriptions weave in the base range and drop the
  redundant synergy sentence; rank-up previews the new range; `gameState().skills`
  and the `gameGuide('damage')` topic updated to match.
- 🧪 `test/systems/damageRoll.test.js` and `test/data/spellSpread.test.js`.

## Feature — Sellsword multi-floor hire + pricing overhaul

- 📦 Mercenary **content + pricing** moved out of `src/legacy/game.js`:
  `MERC_TYPES` (now with a per-merc `accent`), `MERC_ART`, the new
  `MERC_DURATIONS` (1/10/30-floor contracts) and `MERC_PRICE` tuning live in
  `src/data/mercenaries.js`; the pure cost model (`mercFloorRate`, `mercCost`)
  lives in `src/systems/mercPricing.js`. The monolith imports them back and its
  old `MERC_FLOORS`/`mercCost`/`MERC_TYPES`/`MERC_ART` definitions are gone.
- The Sellsword camp now hires for a chosen contract length (like a Mystic pact),
  the per-floor cost is far higher and scales with the deepest floor reached, and
  longer contracts get a gentle per-floor discount. `renderMercCamp` reuses the
  `.pact-card` component; `hireMerc(id, floors)` takes the duration.
- 🧪 `test/systems/mercPricing.test.js` (depth scaling, gentle bulk discount,
  drastic-increase check) and `test/data/mercenaries.test.js` (data shape).

## Feature — ascendancy skill points (own pool)

- 📦 The skill-point **economy** moved from `src/legacy/game.js` into
  `src/systems/skillMath.js`: `earnedSkillPoints` plus the new `earnedAscPoints`
  and the tuning constants (`SKILL_POINTS_PER_LEVEL`, `SKILL_POINTS_AT_START`,
  `ASCEND_LEVEL`, `ASC_POINT_EVERY`). Pure functions, imported back into the
  monolith. Ascendancy (path) skills now spend a separate `player.ascPoints`
  pool (one every 5 levels from level 20); path skills lost their level gate.
- 🧪 `test/systems/skillMath.test.js` gains coverage for `earnedSkillPoints` and
  the `earnedAscPoints` cadence.

## Fix — GitHub Pages subpath deploy

- 🏗️ `index.html` now references `./src/main.js` and `./src/styles.css`
  **relatively** (were absolute `/src/…`). Absolute paths resolve to the domain
  root and 404 on a GitHub Pages **project subpath** (`/Loot-RPG-game/`), which
  served the raw source unstyled. Relative paths resolve under the subpath so the
  module graph loads as-is.
- 🏗️ Added a root `.nojekyll` so GitHub Pages serves `src/` verbatim.
- 🧪 Baseline gates now **require** relative asset paths (reject `/src/…`); added
  `npm run smoke:pages` (raw source over HTTP, the Pages path) alongside
  `npm run smoke` (built `dist/`). Both green.

## Phase 3b — externalize the CSS

- 📦 The 4.3k-line inline `<style>` moved to `src/styles.css`, referenced by a
  render-blocking `<link rel="stylesheet">` in `<head>`. index.html: 770 lines
  (markup + head only). Vite emits a separate hashed `.css` asset in the build.
- 🏗️ `tools/styles-lint.js` now lints `src/styles.css` (whole file = CSS; `:root`
  = token defs).
- 🧪 Smoke gains a `--gold` token check that proves the externalized CSS is
  applied **before** game.js's `getComputedStyle`-based `PALETTE` snapshot runs
  (the one real timing risk). Verified applied in both `vite build` and the dev
  server (browser-checked `--gold` = `#e8c267`).

## Phase 4 — incremental pure-module extraction (with tests)

Each increment: move a self-contained pure cluster verbatim into a `src/` module,
replace its definition in `game.js` with an `import`, add unit tests, and verify
`vite build` + smoke (behavior identical) + suite green.

**Increment 5 — terrain-pack pipeline (swap the ground art)**
- 📦 `src/systems/terrainAtlas.js` — pure autotile + converter core for importing
  a new terrain pack: `cornerMask`, `terrainHash`, `resolveTileId`, atlas
  id math, `blobTemplateToRole` (a pack's Wang layout → the game's `{mask:id}`
  table), `packRoleIntoAtlas` (append tiles + record pixel copies). No DOM/canvas.
- 📦 `src/data/terrainPacks.js` — pack registry + per-biome selection
  (`TERRAIN_PACKS`, `BIOME_PACK_OVERRIDES`, `packForBiome`, `terrainPacksInUse`).
  Overrides empty by default ⇒ world renders byte-identically. game.js now
  generates the terrain **credits** from this registry (import `terrainPacksInUse`),
  so attribution stays truthful as packs are added.
- 🧪 `test/systems/terrainAtlas.test.js` (18) incl. a fidelity round-trip that
  rebuilds the real LPC `Grass` role id-for-id; `test/data/terrainPacks.test.js`
  (7). 100 % lines/funcs/statements over the new modules.
- 📄 `docs/terrain-packs.md` — evaluation + import recipe: the AI-license filter
  (Type-1 "no training on the art" = OK vs Type-2 "no AI in the project" = out),
  the recommended pack (Epic RPG World) + biome map, and the mechanical swap.
- 🏗️ `src/render/procTerrain.js` + a `?terrain=proc` preview path in game.js — a
  procedural terrain-pack renderer that paints the dungeon ground (floor/wall/
  water/lava) via 2-corner-Wang blending, to preview a full terrain swap in the
  real engine. Off by default (flag-gated); `scripts/terrain-preview-shot.mjs`
  boots it in Chromium and screenshots real levels. `src/render/**` excluded from
  coverage (canvas draw layer, characterized by smoke).
- ✅ 151 tests, coverage 100/100/100/99, build + smoke green (208/208 handlers,
  full gameState/gameGuide contract); normal play unaffected (flag off).

**Increment 1 — pure formula/utility leaves**
- 📦 `src/utils/color.js` ← `shadeColor`, `hexA`, `_parseRGBA` (pure colour math,
  zero deps).
- 📦 `src/systems/skillMath.js` ← `milestonePower`, `rankScale`, `skillManaCost`
  (+ their private `MANA_PER_RANK` / `SKILL_MP_MULT` consts) — pure skill-rank math.
- 🧪 Full unit tests for both (`test/utils/color.test.js`,
  `test/systems/skillMath.test.js`); 100 % coverage over all extracted modules.
- ✅ game.js still strict-ESM-parses; build + smoke green; 93 tests pass. The
  `window` bridge still resolves (imported names stay in module scope).

**Increment 2 — a core formula + the first data module**
- 📦 `src/systems/ratings.js` ← `rated` (the core rating→chance formula) +
  `ratePct` + `SKILL_RATING`. Pure.
- 📦 `src/data/changelog.js` ← the 330-entry `CHANGELOG` array (player-facing
  patch notes) — the first `data/` extraction, per the data-driven-design rule.
  game.js: 25,488 → 25,097 lines.
- 🧪 `test/systems/ratings.test.js` (formula + monotonicity + asymptote) and
  `test/data/changelog.test.js` (entry-shape validity, newest-first ordering, and
  the "never reference another game" changelog rule as an enforced data check).
- ✅ build + smoke green (behavior identical), 108 tests, 100 % coverage over all
  extracted modules.

**Increment 3 — the persistence repository seam (Supabase isolation)**
- 📦 `src/persistence/leaderboardRepo.js` — the first repository. Pure request
  builders (`buildSubmitRequest`, `buildFetchUrl`, `buildRangeHeaders`,
  `restHeaders`) + `createLeaderboardRepo({ fetchImpl, url, key })` with an
  **injected `fetch`**. game.js's `lbSubmit`/`lbFetch` now route their Supabase
  REST through it (identical requests: same endpoints, headers, `on_conflict`,
  Range paging, abort-timeout, error propagation) — the inline `fetch` calls are
  gone from the leaderboard path.
- 🧪 `test/persistence/leaderboardRepo.test.js` — 11 tests against a **mock
  `fetch`** (never hits the backend): request shape, Standard/Hardcore filtering,
  multi-page concatenation, non-OK throw, submit error-swallowing, and
  timeout arm/clear via injected timer/AbortController.
- ✅ Establishes the D8 pattern for the remaining Supabase surface (saves, auth,
  settings). game.js parses, build + smoke green, 121 tests, 100 % coverage.

## Phase 3 — inline `<script>` → ES module + `window` bridge

- 📦 **The 24.2k-line inline `<script>` moved verbatim** into
  `src/legacy/game.js` (an ES module); `index.html` now loads it via
  `src/main.js` (`<script type="module">`). `index.html` shrank 29,314 → 5,083
  lines (6.9 MB → 664 KB); the `<style>` block stays inline for now.
- 📦 **Transitional `window` bridge** appended to `game.js`: all **1,188**
  top-level functions are re-exposed as `window` properties (they were global in
  the old classic script), and **36** handler-referenced state globals are
  exposed as **live getters/setters backed by the module bindings** — so a
  handler that reads `player.gold` sees the current value and one that writes
  `selectedSkillId=null` updates the real variable. Verified the script parses as
  a strict ES module (no duplicate decls / octals / sloppy-only constructs).
- 🧪 **Smoke upgraded** to serve over HTTP (a Vite module bundle can't load over
  `file://`) and to verify the bridge: all **208** inline-handler target
  functions present on `window`, live state accessors read/write through, and a
  real inline `onclick="openAccount()"` click opens `#account-overlay`.
  `test/smoke/handler-globals.json` pins the handler set.
- 🧪 Baseline gates updated for the new structure: the syntax gate now
  strict-ESM-parses every `src/**` + `test/**` module; the structure gate finds
  the Supabase config / console API / CHANGELOG / bridge in `src/legacy/game.js`
  and the module entry in `index.html`.
- ✅ Verified: `vite build` ok, `vite` dev server serves the module, smoke passes
  on the built `dist`, 70 unit/characterization tests green, coverage 100 % over
  extracted `src/**`, styles-lint clean. **No game behavior changed** — same
  33-key `gameState()` / 18-topic `gameGuide()` contract.

## Phase 0–2 — Discovery, tooling & green baseline

- 📄 **Discovery inventory** recorded in [`DISCOVERY.md`](./DISCOVERY.md):
  rendering = Canvas 2D only (no WebGL); **zero runtime dependencies** (Supabase
  via raw `fetch`, fonts/art embedded base64); 1,188 functions + 552 module-scope
  vars in one scope; 253 inline handlers → 171 global functions; 164
  `Math.random` / 99 `localStorage` / 49 clock call sites; full subsystem +
  persistence map.
- 📄 **Architecture & migration plan** recorded in [`DECISIONS.md`](./DECISIONS.md):
  the single-file→modular pivot (static bundle preserved), the `src/` taxonomy,
  dependency rules, the strangler + `window`-bridge migration, injected RNG/clock,
  and the persistence repository seam. Suspicious code logged in
  [`BUGS.md`](./BUGS.md) (not fixed — pure refactor).
- 🏗️ **Vite** added (`vite.config.js`, `base: './'`) — `npm run build` emits a
  static `dist/` bundle; verified byte-identical to the source `index.html` at
  baseline. `dist/` + `coverage/` git-ignored.
- 🏗️ **Vitest + jsdom + coverage-v8** configured (thresholds 90/90/85/90 over
  extracted `src/**`, legacy excluded). **Playwright** smoke wired against the
  pre-installed Chromium.
- 🧪 **Baseline characterization (all green):**
  - `test/baseline/index-syntax.test.js` — every inline script parses (`vm`).
  - `test/baseline/index-structure.test.js` — ~30 critical DOM ids, Supabase
    config, `window.gameState/gameGuide` exposure, inline-handler surface.
  - `test/smoke/smoke.mjs` — boots the real game in Chromium; pins the full
    `gameState()` 33-key + `gameGuide()` 18-topic contract; passes on source
    **and** built `dist`.
- 📦 **First pure module extracted:** `src/utils/rng.js` — injectable/seedable RNG
  (`mulberry32`, `sysRandom`, `rndInt`, `rndFloat`, `pick`, `chance`, `shuffle`)
  with full unit tests (`test/utils/rng.test.js`). This is the seam that makes
  loot/combat/mapgen deterministically testable without changing shipped behavior.

_Baseline gate status: `npm test` 60 passing · `npm run build` ok · `npm run
smoke` ok (source + dist)._
