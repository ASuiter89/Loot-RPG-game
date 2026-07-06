# Controller (gamepad) support — the full map

Dungeon Loot is **desktop-first (keyboard + mouse), with additive input layers**.
Controller support is the third such layer, built exactly like the touch layer:

- **Additive & non-destructive.** Gamepad is keyed off a JS-toggled `body.pad`
  class (revealed on the first real gamepad input, dropped when the last pad
  disconnects). Keyboard + mouse stay fully live the entire time — a gamepad never
  disables them, and a machine with no pad is byte-identical to before. This mirrors
  `body.touch`; unlike touch, `body.pad` does **not** swap the layout, it only adds
  focus rings + button-glyph hints.
- **Reuses the same window-bridged handlers** the keyboard and touch layers call
  (`doDash`, `pickup`, `castSkillById`, `enterTown`, `togglePanel`, …). No game
  logic is forked per input device.
- **Standard Gamepad mapping.** Button indices follow the W3C "standard" mapping,
  which the browser normalises across PlayStation (DualShock/DualSense), Xbox, and
  Steam Deck / generic XInput pads. So one map works on all of them; only the glyph
  labels differ (✕○□△ for PlayStation, A/B/X/Y for Xbox — chosen from the pad id).
- **Pure input math is unit-tested** (`src/systems/gamepadMath.js`); the polling +
  DOM wiring lives in `src/legacy/game.js` (coverage-excluded), next to the touch
  wiring it mirrors.

The design goal is **everything in the game is doable on a controller** — every
gameplay action, every menu, every shop/craft screen, text entry, and (as a
universal safety net) a virtual mouse cursor for anything a pad can't reach directly.

---

## Two contexts + two modal fallbacks

The layer is a small state machine. Each poll it resolves the active **context** and
routes buttons accordingly:

| Context | When | What the sticks/buttons do |
|---|---|---|
| **Play** | In the dungeon, no menu open | Left stick moves; buttons act/cast (below) |
| **Menu** | Any overlay open, or the Bag focused | D-pad/left-stick move focus; A activates; B backs out |
| **Text entry** (fallback) | A text field was activated | On-screen keyboard captures the pad |
| **Virtual cursor** (fallback) | Toggled with R3 | Right stick = mouse, A = click, works over canvas **and** DOM |

"Menu" auto-engages whenever a world-pausing overlay opens (settings, town, shop,
mystic, class pick, death, greed/boss prompts, leaderboards, slots, keybinds …) and
auto-releases when it closes. On the desktop layout the Bag is a permanent column,
so **Circle** (Bag) in Play explicitly enters Menu focus on it, and **B/Circle**
backs out to Play.

---

## Play context (dungeon)

```
                              ▲ D-pad Up: Swap weapon set
   L1 (hold) = SKILL layer    ◀ D-pad Left: Health potion    ▶ D-pad Right: Mana potion
   R1 = Dash                  ▼ D-pad Down: Cycle target focus
   L2 = (free / reserved)
   R2 = Sprint (hold)                                        △ Triangle: Town portal
                                                       □          ○  Circle: Open Bag
   Left stick = Move          Right stick = inspect foe /     □ Square: Toggle log
   L3 = Collapse minimap        scroll the open log           ✕ Cross: Interact / Use
                              R3 = toggle virtual cursor
```

**Face buttons — no modifier (actions):**
- **✕ / A** — Interact / Use (`pickup`): open a chest underfoot, talk to the
  merchant/mystic/NPC, use what you're standing on. (Descending stairs, breaking
  cracked walls, teleporter pads, shrines/fountains all happen by *walking* into
  them, so movement + this button covers them.)
- **○ / B** — Open the Bag / inventory (`togglePanel` / `toggleBag`) and enter Menu
  focus on it.
- **□ / X** — Toggle the combat log (`toggleLog`).
- **△ / Y** — Town portal (`enterTown`).

**Face buttons — hold L1 (skill layer):** casts the four manual skill slots.
- **L1 + ✕** → Skill 1  · **L1 + ○** → Skill 2 · **L1 + □** → Skill 3 · **L1 + △** → Skill 4
  (`castSkillById(slotSkill(n).id)`). The dedicated auto-cast slot fires itself, as
  always — no button needed.

**Shoulders / triggers:**
- **R2** — Sprint, hold (sets `sprintHeld`, same as Shift). Works with either sprint
  mode; in Toggle mode a tap latches auto-sprint.
- **R1** — Dash (`doDash`) in the current movement direction.
- **L1** — the skill modifier above (held).

**D-pad — quick items & toggles:**
- **Left** — Health potion (`useHealthPotion`) · **Right** — Mana potion
  (`useManaPotion`) — mirrors the HP-left / MP-right skill-bar layout.
- **Up** — Swap weapon set (`toggleGearSet`) · **Down** — Cycle auto-attack focus
  (`cycleTargetMode`).

**Sticks:**
- **Left stick** — analog 8-way movement, injected into `updatePlayer`'s input
  vector exactly like the touch joystick (`padStick.ix/iy/mag`).
- **Right stick** — nudges a soft **inspect reticle** over the map (pops a foe's
  codex card, same as mouse hover); while the combat log is expanded (□), it scrolls
  the log's history instead. Idle → hidden.
- **L3** (left-stick click) — collapse/expand the minimap.
- **R3** — toggle the **virtual cursor** (universal fallback, below).

**System:**
- **Options / Start** — Pause → Settings menu (`toggleSettingsMenu`).
- **View / Select / Share** — toggle the on-screen **controller cheat-sheet**.

---

## Menu context (every overlay, shop, craft screen, the Bag)

One generic **spatial focus navigator** drives *all* ~28 overlays and the Bag with
no per-menu wiring — it just walks the visible, enabled, clickable elements of the
topmost open container.

- **D-pad / Left stick** — move focus to the nearest focusable element in that
  direction (`pickInDirection`). A focus ring is drawn on it and **its tooltip pops**
  (foe/gear/skill card or the control's hover tip), satisfying "tooltips on selected".
- **✕ / A** — activate the focused element (`.click()`), or:
  - a text `<input>` → open the on-screen keyboard;
  - a `<select>` → step to the next option (matches the "tap to cycle" audio controls).
- **○ / B** — Back / cancel (`handleEscape` → closes the topmost overlay / steps back
  a service panel / exits Bag focus to Play).
- **L1 / R1** — previous / next **tab** where a tabbed strip exists (Settings tabs,
  Bag HERO/SKILLS/LOOT tabs, leaderboard Std/HC + Floor/Level/Gold/Power, shop
  sort/filter). Falls back to no-op when the container has no tabs.
- **D-pad left/right on a focused `<select>`** cycles its option in place, so a long
  native dropdown (the music-vibe picker) never needs the OS list.
- **Right stick / Left stick held** — scroll the focused scroll region so nothing is
  unreachable in a long list.
- Focus auto-initialises to the container's first element (reading order) when it
  opens, and is kept on-screen (scroll-into-view).

This covers, with the same code: the **Bag** (inspect/equip/salvage/sort/filter,
paper-doll, the SKILLS tree, assigning skills to slots via `openSlotPicker`, the
auto-cast slot, cycling target mode), the **Merchant / Mystic / Enchanter /
Transmuter / Forge / Ramen House / Stash / Mercenaries**, **Settings** (+ Keybinds,
which capture a *keyboard* key so are marked keyboard-only), **Leaderboards**,
**Bestiary**, **Achievements**, **Save Slots**, **Class pick**, **Death / Hardcore
death / Greed / Boss gate** prompts, and the **Title** screen.

### Things that were mouse-only — and their controller path
- **Drag-to-reorder the skill bar / drag-to-slot cooking** — drag is an *enhancement*;
  both already have click paths (tap a slot → assign picker; batch-cook buttons), so
  they're fully reachable. (A future nicety: A-to-grab / A-to-drop.)
- **Hover-only tooltips** — surfaced on focus (synthetic `mouseenter`), so the pad
  reads every card the mouse could.
- **Native `<select>` (music vibe)** — A / D-pad cycles the option, never needs the
  OS dropdown.

---

## Text entry (fallback) — on-screen keyboard

The only true text fields are **hero name** and the optional **cloud-save login**
(email + password). Activating one with ✕ opens a compact grid keyboard:
D-pad moves over the keys, ✕ types the highlighted key, with **⌫ Backspace**,
**Space**, **⇧ Shift/case**, and **✓ Done** (commits + closes). ○ cancels. Hero name
also offers a **🎲 Random** key. This makes account sign-in and naming fully
controller-operable.

---

## Virtual cursor (fallback) — a real mouse on a stick

**R3** toggles a soft pointer you drive with the **right stick**; **✕** left-clicks
by dispatching real pointer/mouse events at the cursor via `elementFromPoint`, so it
works over the **canvas** (click-to-move, chase a specific foe, inspect) *and* any
**DOM** element. This is the guarantee that *anything* the mouse can reach, the pad
can too — a catch-all for any affordance the focus navigator doesn't model. ○ / R3
again exits cursor mode.

---

## Glyph hints & discoverability

- On `body.pad`, contextual button glyphs appear on the key affordances (Bag/Town/Log
  buttons, the skill slots show their `L1+face` glyph, menu back/confirm hints).
- **View/Select** opens a full cheat-sheet overlay of the whole map (the diagram
  above, live).
- Glyphs auto-switch between **PlayStation** (✕ ○ □ △, L1/R2 …) and **Xbox**
  (A B X Y, LB/RT …) sets based on the pad's `id`; Steam Deck reports as Xbox-style.
- `gameGuide('controller')` documents the scheme for the AI-play API, and a CHANGELOG
  entry ships with it.
