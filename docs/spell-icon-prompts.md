# Spell-icon art prompts — Fortune-Seeker · Windblade · Bloodletter

Copy-paste prompts for generating bespoke skill-icon art for the three later
classes with Google Gemini.

**Why this exists:** all three classes currently BORROW icon keys from the
original four (`f_a00 "Chance Shot"` renders `sk_ra_throwknife`, a Rogue
throwing-knife). 90 active skills across the three classes point at Warrior /
Rogue / Mage / Templar art. `tools/skill-icons/colors.mjs` already reserves
their tile palettes, noting they "only take effect once bespoke `sk_f_`/`sk_z_`/
`sk_l_` art is generated".

---

## 1. Read this first — generate the ART ONLY, not the badge

`tools/skill-icons/compose.mjs` draws the finished badge: the class-coloured
raised metal-bead frame, the dark class-tinted recessed well, the inner shadow,
the vignette and the gloss sweep. It also cuts the octagon keystone variant.

**Gemini must produce only the bare subject on a plain background.** If it draws
its own border or backing plate you get a double frame, and the alpha-trim step
(which crops to the subject's bounding box and scales it to fill the well) will
size the icon to that frame instead of the artwork.

```
Gemini  →  1024×1024 PNG, white bg      ← this document
   ↓       background removed → transparent PNG
   ↓       tools/skill-icons/compose.mjs  → 128px class badge (+ @ks octagon)
   ↓       tools/skill-icons/pack.mjs     → 96px cells in the packed atlas
   ↓       src/assets/skillIconsAtlas.js
   →       drawn in-game at ≤64px
```

### Sizes and resolution

| | Value |
|---|---|
| Ask Gemini for | **1024 × 1024 px, 1:1 square** (512×512 is the floor — that's what the Scenario call uses today) |
| Format | PNG |
| Background | Pure white `#FFFFFF`, flat and uniform — **or** true transparency if you can get it reliably |
| Apparent pixel grid | **48 × 48 logical pixels**, upscaled with hard nearest-neighbour edges |
| Subject coverage | ~90% of the frame, centred |
| Final legibility bar | must still read at **64 px** — that's the largest it is ever drawn in game |

Background removal is **required** if you generate on white. A white-background
PNG is fully opaque, so `compose.mjs`'s alpha-trim finds no transparent margin,
skips the crop, and composites a white square into the well. Either ask Gemini
for a transparent PNG, or run the white output through a background remover
(the repo's existing `removeBackground` in `tools/skill-icons/scenario.mjs`
does this, as does any standard tool).

---

## 2. The prompt template

Paste the whole block. Replace `<CLASS PALETTE>` with the class block from §3
and `<SUBJECT>` with the spell's line from §4. Everything above those two lines
stays byte-identical across all 90 icons — that consistency is what makes them
read as one set.

```
Pixel-art fantasy RPG skill icon. Square 1:1, 1024x1024.

STYLE: drawn as a 48x48 pixel sprite and upscaled with hard nearest-neighbour
edges — large, crisp, visible square pixels. No anti-aliasing, no smooth
gradients, no blur, no airbrushing, no 3D render, no photorealism. Shade with
flat blocks and dithering, not soft ramps.

COMPOSITION: one single object, centred, filling about 90% of the frame, on a
plain flat pure-white #FFFFFF background.

DO NOT INCLUDE: no border, no frame, no badge, no button, no backing plate, no
circle or rounded-square container behind the subject, no background scenery,
no landscape, no ground plane, no horizon, no cast shadow on the background,
no text, no letters, no numbers, no watermark, no UI chrome.

COLOUR: limited palette, 12-18 colours total. Build the object from a bright
near-white CORE, a saturated coloured GLOW around it, a mid-tone body, small
light SPARK highlights, and a dark near-black KEYLINE outlining the whole
silhouette so it never washes out against a dark background.

SILHOUETTE: bold, chunky and instantly readable when shrunk to 64x64. Favour one
strong shape over fine detail. Do not let thin strokes drop below 2 logical
pixels wide.

<CLASS PALETTE>

SUBJECT: <SUBJECT>
```

### Why the "keyline" clause matters

The art lands in a **dark, class-tinted well** (`#39204a`, `#153c3a`, `#45161d`).
An icon painted in the same hue as its own well disappears. The bright-core /
dark-keyline recipe is the same one `src/data/vfxPalette.js` uses for combat
effects, for exactly this reason — so the shape "never washes out".

---

## 3. Class palette blocks

Hexes are the real ones from `tools/skill-icons/colors.mjs` (tile) and
`src/data/vfxPalette.js` (effects). Note the **contrast warning** on each —
it's the most common way these fail.

### Fortune-Seeker (`f`) — violet & gold, luck and ranged wagers

> *"A ranged chancer — skills ride on Luck, and every shot is a wager."*
> Reads the odds in everything and bets anyway. Bow and dagger, light armour.

```
CLASS PALETTE: violet and gold. Primary violet #c08ce8, deep violet shadow
#39204a, bright arcane glow #c77dff, pale violet highlight #e3c6ff. Gold accents
throughout: rich gold #ffd24b, pale gold #ffe9a0, dark gold keyline #5c3f08.
Feels like luck, gambling, coins and fortune — glinting metal, spinning chance,
a violet spark on everything.
```

- **Motifs:** coins, dice, playing cards, arrows and bowstrings, spinning things
  caught mid-air, payouts, crosshairs, gold spray.
- **Contrast warning:** the well is deep violet — do **not** make the subject
  mostly mid-violet. Lead with **gold** and pale near-white, and use the violet
  as glow and rim light only.

### Windblade (`z`) — teal, wind and runes

> *"A hybrid blade-caster — Agility and Spirit both sharpen the same edge."*
> Learned that a sword and a spell are one motion, and has not stood still since.

```
CLASS PALETTE: teal and pale cyan. Primary teal #5fd6c8, deep teal shadow
#153c3a, bright cyan glow #9fdcff, near-white core #eaffff, cold steel
#c3d4ec / #8fa2ba, dark teal keyline #215a86. Feels like fast air, driven mist
and glowing carved runes — sharp steel edges wrapped in streaming teal wind and
small floating glyph marks.
```

- **Motifs:** sword blades, crescent slash arcs, spiral gusts, streaming wind
  ribbons, carved glowing runes and sigils, after-images and motion doubles,
  storm cloud, mist bands.
- **Contrast warning:** teal-on-teal vanishes. Keep the **steel** near-white and
  bright, and use teal for the wind and the glow around it.

### Bloodletter (`l`) — crimson, blood and bone

> *"A hybrid bruiser with NO mana — every skill is paid for in health."*
> Keeps no reserve of magic, only blood, and spends it the moment a fight starts.

```
CLASS PALETTE: crimson and bone. Bright blood core #ffd6dd, blood glow #e0556b,
deep arterial red #a52338, crimson #d03a4b, near-black blood keyline #3c0a13,
pale bone #e8dcc0 and dark iron #4a4a52 for weapons. Feels visceral and heavy —
wet crimson, splatter, clotted dark red, jagged bone spurs and blunt iron.
```

- **Motifs:** blood drops and splatter, open wounds, bone spikes and thorns,
  hearts, heavy axes / cleavers / scythes, clotted shields and walls, sacrificial
  marks, hooks.
- **Contrast warning:** the well is dark maroon — do **not** paint a dark red
  icon. Lead with **bone white**, **iron grey** and the bright pink-white blood
  core, and keep the deep arterial red for shadow.

---

## 4. The spells

30 active skills per class. `Icon key` is the bespoke key to create; `Currently`
is the borrowed art it replaces. Filename = `<icon key>.png`.

Descriptions are the in-game text with the `{dmg}` damage placeholder trimmed for
readability — the full strings live on the nodes in `SKILL_TREES`.

### Fortune-Seeker — 30 actives

| # | Spell | In-game description | Icon key | Currently | SUBJECT line |
|---|---|---|---|---|---|
| f_a00 | Chance Shot | A quick shot at a distant foe. | `sk_fa_chanceshot` | `sk_ra_throwknife` | a single arrow in flight, tip forward, trailing a short violet spark trail |
| f_a01 | Coin Toss | Flick a coin that deals damage and staggers the target. | `sk_fa_cointoss` | `sk_ra_pin` | a gold coin spinning edge-on in mid-air with a small impact starburst behind it |
| f_a02 | Long Shot | A piercing shot down a line. | `sk_fa_longshot` | `sk_ra_volley` | one long arrow seen down its shaft receding to a point, sharp violet speed lines |
| f_a03 | Quickdraw | A snap shot that always crits. | `sk_fa_quickdraw` | `sk_ra_killshot` | an arrow leaving a snapping bowstring, bright white flash at the nock |
| f_a04 | Sidestep | Read the room and slip aside — a burst of dodge. | `sk_fa_sidestep` | `sk_ra_dash` | a curved violet motion-blur streak with a fading after-image silhouette of a boot |
| f_a10 | Double or Nothing | Stake the shot on one roll: a guaranteed crit. | `sk_fa_doubleornothing` | `sk_ra_gut` | two gold dice mid-tumble both showing six, violet glow between them |
| f_a11 | Scattergold | Fling a spray of coin and shot all around you. | `sk_fa_scattergold` | `sk_ra_fanknives` | a burst of gold coins radiating outward from a centre point in all directions |
| f_a12 | Pinning Shot | Nail a foe in place. | `sk_fa_pinningshot` | `sk_ra_pin` | an arrow driven straight down through a gold shackle, pinning it |
| f_a13 | Fan the Hammer | Three shots in the time of one. | `sk_fa_fanthehammer` | `sk_ra_bladeflurry` | three arrows in a fanned spread flying from one origin point |
| f_a14 | Smoke Coin | Drop a smoking coin — dodge and a guard. | `sk_fa_smokecoin` | `sk_ra_smoke` | a gold coin dropping into a billowing puff of violet smoke |
| f_a20 | Wild Card | Three shots find three foes anywhere on the floor. | `sk_fa_wildcard` | `sk_ra_deathmark` | a single playing card flying edge-on, violet energy burning along its rim |
| f_a21 | Lucky Coin | Call it in the air — mend yourself and sharpen your eye. | `sk_fa_luckycoin` | `sk_ra_focusbuff` | a gold coin spinning upward with a soft green healing wisp curling around it |
| f_a22 | Piercing Volley | A crit-certain volley skewering everything in a line. | `sk_fa_piercingvolley` | `sk_ra_pierce` | one arrow skewering three stacked gold rings in a straight line |
| f_a23 | Hot Hand | The run is on — crit and damage surge. | `sk_fa_hothand` | `sk_ra_focusbuff` | a fanned hand of playing cards burning with violet-gold flame |
| f_a24 | Backroll | Fold the hand and roll clear to open ground. | `sk_fa_backroll` | `sk_ra_vanish` | a curved violet tumbling arc with scattered cards falling from it |
| f_a30 | Snake Eyes | The worst roll for them, and it finishes the nearly-dead. | `sk_fa_snakeeyes` | `sk_ra_eviscerate` | two dark dice each showing a single pip, lit from below in ominous violet-red |
| f_a31 | Windfall Volley | A wall of shot down the line. | `sk_fa_windfallvolley` | `sk_ra_volley` | a dense row of parallel arrows flying together as one wall |
| f_a32 | Arrowfall | Arc a fall of arrows onto a distant spot. | `sk_fa_arrowfall` | `sk_ra_deathrain` | arrows arcing downward onto a glowing gold target ring on the ground |
| f_a33 | Chain Luck | A shot that skips between three foes. | `sk_fa_chainluck` | `sk_ma_chainlightning` | a gold coin with violet lightning arcing off it to two smaller coins |
| f_a34 | Caltrops | Scatter barbs that poison everything near. | `sk_fa_caltrops` | `sk_ra_caltrops` | a cluster of four-pointed gold caltrop spikes with green venom dripping off the tips |
| f_a40 | All-In Shot | Everything on one shot: a colossal guaranteed crit. | `sk_fa_allinshot` | `sk_ra_executioner` | one oversized arrow drawn back over a shoved-forward stack of gold chips |
| f_a41 | Ricochet | A crit that caroms through four foes. | `sk_fa_ricochet` | `sk_ma_spark` | an arrow mid-bounce with a sharp violet zigzag trail folding back on itself |
| f_a42 | Called Shot | Name the target and take it, executing the wounded. | `sk_fa_calledshot` | `sk_ra_killshot` | a gold crosshair ring with an arrow struck dead centre through the bullseye |
| f_a43 | Jackpot | The payout lands in a burst, leaving survivors exposed. | `sk_fa_jackpot` | `sk_ra53` | an erupting fountain of gold coins bursting upward in a violet flash |
| f_a44 | Vanishing Act | Walk away from the table — blink clear behind a heavy guard. | `sk_fa_vanishingact` | `sk_ra_perfectvanish` | a gold top hat tipped over with violet smoke pouring out and an empty outline above it |
| f_a50 | Roll the Bones | Six certain crits scatter across the floor. | `sk_fa_rollthebones` | `sk_ra54` | six gold dice frozen mid-scatter, tumbling outward, all faces glowing violet |
| f_a51 | Midas Volley | A double storm of gilded shot. | `sk_fa_midasvolley` | `sk_ra_thousandcuts` | a swirling ring of golden arrows circling a centre, molten gold dripping from them |
| f_a52 | Storm of Arrows | A crit-certain deluge that finishes the wounded. | `sk_fa_stormofarrows` | `sk_ra_deathrain` | a dense deluge of arrows falling from a violet storm-lit sky |
| f_a53 | Perfect Run | Two flawless shots — the streak at its peak. | `sk_fa_perfectrun` | `sk_ra_perfectvanish` | two identical arrows struck through the exact same bullseye, gold rings rippling |
| f_a54 | Last Ace | Play the card you kept back. | `sk_fa_lastace` | `sk_ra_shadowclone` | a single ace card held upright, blazing with violet-gold aura and a shield glint |

### Windblade — 30 actives

| # | Spell | In-game description | Icon key | Currently | SUBJECT line |
|---|---|---|---|---|---|
| z_a00 | Gale Dash | Blink to a foe on a gust and open. | `sk_za_galedash` | `sk_ra_dash` | a sword streaking forward inside a spiralling teal gust |
| z_a01 | Runestrike | A rune-lit cut of steel and spell together. | `sk_za_runestrike` | `sk_ta_smite` | a steel blade with a single glowing teal rune burning on its flat |
| z_a02 | Cutting Gust | A wide slash of wind. | `sk_za_cuttinggust` | `sk_wa_cleave` | a wide crescent slash arc made of sharp teal wind |
| z_a03 | Flicker Cut | A blink-fast cut that always crits. | `sk_za_flickercut` | `sk_ra_backstab` | a blade with a doubled teal after-image offset behind it, bright crit spark at the tip |
| z_a04 | Deflect | Turn the air aside — a guard and reduced damage. | `sk_za_deflect` | `sk_ta_shieldself` | a sword held vertical with a teal deflection ripple bending around its edge |
| z_a10 | Slip | Step out of the fight and reappear clear. | `sk_za_slip` | `sk_ra_blink` | a teal wisp curling where a figure just was, faint outline dissolving |
| z_a11 | Etch Rune | Cut a rune into your blade — spells bite harder. | `sk_za_etchrune` | `sk_ma_emberbuff` | a chisel carving a glowing teal rune into a steel blade, sparks flying |
| z_a12 | Windblade Arc | A sweeping arc of wind. | `sk_za_windbladearc` | `sk_wa_reaping` | a broad sweeping arc with teal wind streamers trailing off it |
| z_a13 | Twin Slash | Two cuts land as one. | `sk_za_twinslash` | `sk_ra_bladeflurry` | two crossing slash arcs forming a sharp teal X |
| z_a14 | Mistveil | Wrap yourself in driven mist — dodge and a guard. | `sk_za_mistveil` | `sk_ra_smoke` | a blade half-swallowed by coiling bands of teal mist |
| z_a20 | Wind Rush | Ride the gale into a foe and shove it back. | `sk_za_windrush` | `sk_wa_charge` | a sword point driving forward at the tip of a cone of compressed teal wind |
| z_a21 | Rune Lance | A lance of written light spearing a line. | `sk_za_runelance` | `sk_crlance` | a lance of pale cyan light with glowing runes running down its shaft |
| z_a22 | Cyclone | Spin up a cyclone. | `sk_za_cyclone` | `sk_ma_frostnova` | a tight spiralling funnel of teal wind seen from the side |
| z_a23 | Wind Scar | Leave a crit-certain scar in the air. | `sk_za_windscar` | `sk_ra_pierce` | a jagged tear ripped in the air, glowing cyan along its torn edges |
| z_a24 | Recoil Step | Snap back out of reach behind a guard. | `sk_za_recoilstep` | `sk_ra_phantomdash` | a reversed teal arrow with a snapping recoil trail curling behind it |
| z_a30 | Tailwind | The wind at your back — damage and dodge rise. | `sk_za_tailwind` | `sk_ra_focusbuff` | a blade driven forward by stacked teal chevrons pushing from behind |
| z_a31 | Glyph Burst | Detonate the runes around you. | `sk_za_glyphburst` | `sk_ma_arcaneorb` | a ring of teal runes detonating outward from a bright white centre |
| z_a32 | Gale Line | A blade of wind down the line. | `sk_za_galeline` | `sk_ma_flamewave` | a straight horizontal beam shaped like a blade edge, made of streaming wind |
| z_a33 | Thousand Winds | Three cuts in a heartbeat. | `sk_za_thousandwinds` | `sk_ra_thousandcuts` | a dense fan of many thin parallel teal slash lines |
| z_a34 | Windward Guard | Set your guard into the wind — halved damage and thorns. | `sk_za_windwardguard` | `sk_ta_aegisfield` | a circular teal barrier ring bristling with outward wind-blade spikes |
| z_a40 | Cyclone Step | Arrive in a whirl, leaving the foe reeling. | `sk_za_cyclonestep` | `sk_ra_phantomdash` | a footprint at the eye of a tight teal whirl, small stun stars circling above |
| z_a41 | Runic Edge | Steel and sigil land together. | `sk_za_runicedge` | `sk_ta_holyfire` | a sword whose whole cutting edge is lined with burning teal sigils |
| z_a42 | Maelstrom | A roaring maelstrom. | `sk_za_maelstrom` | `sk_ma_blizzard` | a massive swirling vortex with steel blade shards caught spinning inside it |
| z_a43 | Sever | One decisive cut that finishes the wounded. | `sk_za_sever` | `sk_ra_eviscerate` | one clean straight cut line with a dark gap opening along it, cyan light bleeding out |
| z_a44 | Storm Shroud | Draw the storm around you — guard, dodge and spell power. | `sk_za_stormshroud` | `sk_ma_barrier` | a dark storm cloud wrapped around a vertical blade, teal shield ring beneath |
| z_a50 | Tempest Dance | Blink through a foe twice, each pass a certain crit. | `sk_za_tempestdance` | `sk_ra_twinclone` | two blades crossing through a tall spiral, each with a teal after-image trailing |
| z_a51 | Weavebreaker | Tear the weave open — and detonate any foe left exposed. | `sk_za_weavebreaker` | `sk_ma_disintegrate` | a lattice of cyan light being torn apart, cracks spreading from a bright breach |
| z_a52 | Stormcaller | Call the whole storm down across the room. | `sk_za_stormcaller` | `sk_ma_thunderstorm` | a sword raised point-up with cyan lightning and wind converging on its tip |
| z_a53 | Perfect Edge | Two flawless cuts — the form completed. | `sk_za_perfectedge` | `sk_ra_perfectvanish` | a single flawless mirror-bright blade held vertical, one clean teal glint on the edge |
| z_a54 | Unbroken Wind | Become the wind itself. | `sk_za_unbrokenwind` | `sk_ma_iceprison` | a humanoid outline dissolving upward into streaming teal wind ribbons |

### Bloodletter — 30 actives

| # | Spell | In-game description | Icon key | Currently | SUBJECT line |
|---|---|---|---|---|---|
| l_a00 | Blood Guard | Set your guard in your own blood — a shield and reduced damage. | `sk_la_bloodguard` | `sk_wa_brace` | a round shield formed out of thick clotted dark-red blood, bone rim |
| l_a01 | Bloodletting | Open a vein — theirs — drinking deep. | `sk_la_bloodletting` | `sk_wa_rend` | a curved blade drawing one clean red line, fat blood droplets falling from it |
| l_a02 | Cleave | A wide butcher stroke. | `sk_la_cleave` | `sk_wa_cleave` | a heavy iron cleaver mid-swing with a wide crimson crescent arc behind it |
| l_a03 | Blood Offering | Spill your own to sharpen the next. | `sk_la_bloodoffering` | `sk_b_frenzy` | a cupped hand spilling blood downward with a bright red glow rising back up |
| l_a04 | Thornskin | Harden into barbs. | `sk_la_thornskin` | `sk_wa_fortify` | a patch of hide bristling outward with sharp pale bone thorns |
| l_a10 | Harden | Clot and brace — damage falls, wounds close. | `sk_la_harden` | `sk_wa_roar` | overlapping plates of hardened dark clotted blood forming armour scales |
| l_a11 | Drain | A draining blow that pays you back in blood. | `sk_la_drain` | `sk_wa11` | a stream of bright blood arcing from an open wound into an outstretched hand |
| l_a12 | Butcher's Swing | A cleaving swing that leaves the cut exposed. | `sk_la_butchersswing` | `sk_wa12` | a butcher's cleaver arc with a jagged red crack splitting open along the cut |
| l_a13 | Pain Surge | Turn the hurt outward. | `sk_la_painsurge` | `sk_wa_warcry` | a clenched anatomical heart pulsing with a hard red shockwave ring around it |
| l_a14 | Reprisal | Brace to punish — thorns and a hardened guard. | `sk_la_reprisal` | `sk_wa04` | a raised guard plate studded with outward-facing bone spikes |
| l_a20 | Bulwark | Throw up a wall of clotted blood. | `sk_la_bulwark` | `sk_wa_laststand` | a solid standing wall of dark congealed blood, glossy and thick |
| l_a21 | Sanguine Nova | Burst outward, drinking from everything near. | `sk_la_sanguinenova` | `sk_b_bloodbath` | an expanding ring of blood bursting outward from a bright centre |
| l_a22 | Rend | A ragged tear that will not stop bleeding. | `sk_la_rend` | `sk_wa_rend` | three ragged parallel claw tears with blood running from each |
| l_a23 | Reckless Charge | Throw yourself at a foe, staggering it. | `sk_la_recklesscharge` | `sk_wa_charge` | a shoulder-first silhouette hurling forward inside a hard crimson speed streak |
| l_a24 | Blood Spikes | Erupt spines of bone, leaving foes exposed. | `sk_la_bloodspikes` | `sk_wa_warstomp` | jagged pale bone spines erupting upward through a splash of blood |
| l_a30 | Iron Oath | Swear the oath — damage halves and every blow answers back. | `sk_la_ironoath` | `sk_wa_rally` | a heavy iron band ring sealed over a blood mark, wreathed in bone thorns |
| l_a31 | Exsanguinate | Bleed a foe dry and take it all in. | `sk_la_exsanguinate` | `sk_wa_reaping` | a draining silhouette going bone-pale as a heavy red flow pours out of it |
| l_a32 | Meat Grinder | Two full turns of the blade to everything near. | `sk_la_meatgrinder` | `sk_wa_whirl` | a spinning wheel of iron blades throwing a red spray outward |
| l_a33 | Bloodlust | Give in to it — damage and lifesteal both climb. | `sk_la_bloodlust` | `sk_b_frenzy` | bared jagged teeth under two burning red eyes, blood running down |
| l_a34 | Crimson Pact | Seal the pact — heavy thorns and steady mending. | `sk_la_crimsonpact` | `sk_wa_banner` | a sigil painted in wet blood, ringed by a wreath of bone thorns |
| l_a40 | Last Blood | Down to the last of it — a heavy guard and a surge of force. | `sk_la_lastblood` | `sk_wa40` | one final fat blood drop falling in front of a heavy dark shield |
| l_a41 | Blood Feast | Open every wound around you and feast. | `sk_la_bloodfeast` | `sk_b_bloodbath` | a wide stone basin brimming and overflowing with bright blood |
| l_a42 | Execution | A headsman blow that ends the wounded outright. | `sk_la_execution` | `sk_wa_impale` | a heavy headsman's axe descending onto a blood-stained block |
| l_a43 | Martyr's Blow | Pay dearly and swing accordingly. | `sk_la_martyrsblow` | `sk_wa_titanleap` | a sword blade gripped by its own bleeding blade, driven point-down |
| l_a44 | Backlash Wave | A wave of red force that hurls foes back. | `sk_la_backlashwave` | `sk_wa_slam` | a hard crimson shockwave ring blasting outward, debris flung off its edge |
| l_a50 | Crimson Bastion | Raise a fortress of your own making. | `sk_la_crimsonbastion` | `sk_wa_colossus` | a squat fortress tower built of bone and clotted blood, battlements of ribs |
| l_a51 | Crimson Tide | A tide of blood, drowning the wounded and healing you. | `sk_la_crimsontide` | `sk_b_warbringer` | a cresting breaking wave made entirely of blood, white-red foam at the crest |
| l_a52 | Slaughterhouse | Turn the room into a killing floor. | `sk_la_slaughterhouse` | `sk_wa_apocalypse` | iron meat hooks hanging on chains above a blood-slicked floor |
| l_a53 | Blood Apotheosis | Everything you are, spent at once. | `sk_la_bloodapotheosis` | `sk_wa_avatar` | a figure with arms spread rising inside a column of blood, radiant crimson halo |
| l_a54 | Blood Cathedral | Raise a vault of red — and detonate every exposed foe inside it. | `sk_la_bloodcathedral` | `sk_wa_cataclysm` | a tall gothic cathedral arch built of bone with glowing red stained glass |

---

## 5. Passives and keystones

Each class also has **30 passives** (`f_p*`, `z_p*`, `l_p*`), 5 of which are
**keystones**. They also borrow art today:

| Class | Keystones (borrowed art) |
|---|---|
| Fortune-Seeker | House Edge · Golden Touch · Dead Reckoning · Lucky Seven · Fortune's Favour |
| Windblade | Ghost Step · Sever the Weave · Eye of the Storm · Perfect Form · Windwalker |
| Bloodletter | Vital Surge · Blood Price · Hemorrhage · Undying · Second Heart |

Keystones need **no separate art** — `generate.mjs` composites the octagon
`<key>@ks` variant from the same source PNG, matching the octagonal node frame
in the SKILLS menu. Generate one image per icon key; the shapes are automatic.

The passive prompts follow the identical template — pass the passive's name and
effect as the `SUBJECT` line. Doing the 90 actives first is the higher-value
half: they're what the player sees on the hotbar every fight.

---

## 6. Dropping the results into the repo

`generate.mjs` caches transparent art on disk and **skips the paid API call when
a file already exists**, so hand-made Gemini art slots straight in:

1. Name each transparent PNG `<icon key>.png` (e.g. `sk_fa_chanceshot.png`).
2. Drop them in `tools/skill-icons/.work/transparent/`.
3. Point the skill nodes at the new keys — the `icon` field on each `f_*`/`z_*`/
   `l_*` node in `SKILL_TREES` (`src/legacy/game.js`) still names the borrowed
   key. `parseSkillIcons()` reads the trees, so an icon key that no node
   references never gets built.
4. `node tools/skill-icons/generate.mjs --all` → composites badges (cached art
   is reused, no API spend).
5. `node tools/skill-icons/pack.mjs` → regenerates `src/assets/skillIconsAtlas.js`.
6. `npm test && npm run build && npm run smoke`.

Class routing is automatic: `classForIcon()` reads the letter after `sk_`, so
`sk_fa_*` → fortune (violet), `sk_za_*` → windblade (teal), `sk_la_*` →
bloodletter (crimson) frames, straight out of `CLASS_TILE`.

Sizing note: the sheet currently holds 321 cells. The 90 actives here add 90;
going on to do all 180 nodes plus the 15 keystone octagon variants would add
~195, roughly doubling it. The atlas is a base64 blob in a JS module, so watch
the bundle size when it lands.
