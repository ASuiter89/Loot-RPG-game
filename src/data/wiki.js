// ── HOW TO PLAY WIKI ─────────────────────────────────────────────────────────
// The player-facing knowledge base behind Settings ▸ About ▸ HOW TO PLAY. This is
// a categorised, searchable reference: a flat list of CATEGORIES, each holding a
// few ARTICLES, each article a list of prose BLOCKS.
//
// This is PURE DATA — plain player-facing copy, no game logic. It is the sibling
// of the agent-facing gameGuide() reference in src/legacy/game.js: gameGuide()
// speaks to a program driving the game through the console (it cites gameState()
// fields and the JS API), whereas this wiki speaks to a HUMAN reading menus, in
// plain words that stand on their own. Keep the two in agreement on the RULES;
// they differ only in voice and audience.
//
// Copy rules (a data-validity test enforces the important ones):
//   • Never reference another game (no "Diablo-like", "roguelike", …) — describe
//     what the thing does in plain terms.
//   • Every category needs { id, title, icon, blurb, articles[] }; every article
//     needs { id, title, keywords[], body[] } with a globally-unique id.
//   • A body BLOCK is one of:
//       { h: 'Sub-heading' }            a bold section heading inside an article
//       { p: 'A paragraph…' }           prose; may carry <b>/<i> and inline
//                                       <span data-spr=key></span> sprite icons
//       { ul: ['point', 'point'] }      a bullet list (inline HTML allowed)
//       { tiers: 1 }                    the loot-rarity colour chip row
//       { note: 'Aside…' }              a callout / tip aside
//   • `icon` values are real pixel-atlas sprite keys (see the [data-spr] painter),
//     never emoji.
//
// Search indexes an article's title + keywords + all block text, so add
// keywords for the words a player would actually type (synonyms, alternate
// spellings) even when they don't appear in the prose.

export const WIKI = [
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: 'basics',
    title: 'Getting Started',
    icon: 'scroll',
    blurb: 'What the game is, and how a single run flows.',
    articles: [
      {
        id: 'what-is',
        title: 'What Is Dungeon Loot?',
        keywords: ['overview', 'goal', 'win', 'objective', 'intro', 'start', 'about', 'point', 'depth', 'tier', 'endless'],
        body: [
          { p: 'Dungeon Loot is a real-time, loot-driven pixel dungeon crawler. You delve floor by floor, cut down whatever roams each floor, grab ever-better gear, and try to survive as deep as you can.' },
          { h: 'How deep does it go?' },
          { p: 'Depth is one continuous counter running through four difficulty tiers of 25 floors each: <b>Normal</b> (floors 1–25), <b>Hardened</b> (26–50), <b>Brutal</b> (51–75), and <b>Endless</b> (76 and beyond, with no cap). Each tier hits harder than the last.' },
          { h: 'Is there a way to "win"?' },
          { p: 'There is no single ending — the goal is to push as deep as you can and build a hero strong enough to go further. On any ordinary floor the best plan is simple: clear the foes, grab the loot, take the stairs down.' },
        ],
      },
      {
        id: 'core-loop',
        title: 'The Core Loop',
        keywords: ['loop', 'floor', 'stairs', 'clear', 'descend', 'down', 'boss', 'progress'],
        body: [
          { p: 'Every floor follows the same rhythm:' },
          { ul: [
            'Clear every hostile foe on the floor. That <b>unseals the down-stairs</b> (treasure goblins don\'t count — they never block the exit).',
            'Sweep up chests, coins, food and dropped gear.',
            'Walk onto the glowing <span data-spr=ic_down></span> down-stairs to descend to the next floor.',
          ] },
          { p: 'Every <b>5th floor is a boss floor</b> — a sealed arena with a single guardian instead of a crowd. Beat it to move on.' },
          { note: 'The up-stairs only backtrack to the floor above; the glowing down-stairs are always your way forward.' },
        ],
      },
      {
        id: 'making-a-hero',
        title: 'Creating a Hero',
        keywords: ['create', 'character', 'class', 'name', 'body', 'sex', 'gender', 'male', 'female', 'hardcore', 'permadeath', 'ssf', 'self-found', 'solo'],
        body: [
          { p: 'From the title screen\'s <b>Enter the Dungeon</b> button you build a hero in two steps: first pick a <b>class</b> (Warrior, Rogue, Mage or Templar), then choose a <b>name</b> and a <b>body type</b> (Female or Male).' },
          { p: 'Body type is purely cosmetic — it only sets which hero sprite is drawn. Every class has its own female and male art.' },
          { h: 'Optional challenge modes' },
          { p: '<b>Hardcore</b> is one life only — a single death is permanent, and the hero is laid to rest for good. <b>Solo Self-Found</b> (SSF) seals this hero off from the shared town Vault and shared materials, so only what this hero finds on its own can be used. Arm either, both, or neither on the name screen.' },
          { note: 'Class can be retrained later at the town Trainer, but name, body type, Hardcore and Self-Found lock in the moment you begin.' },
        ],
      },
      {
        id: 'death',
        title: 'Death & Recovery',
        keywords: ['death', 'die', 'dead', 'grave', 'revive', 'penalty', 'checkpoint', 'lose'],
        body: [
          { p: 'Death is <b>not</b> game over (unless you\'re playing Hardcore). When you fall, you wake up back in <b>Town</b>, revived at full Health, Mana and Stamina.' },
          { h: 'What death costs' },
          { ul: [
            'You lose a fraction of your carried gold and some XP.',
            'Your whole bag drops as a <b>reclaimable grave</b> on the floor where you fell — go back and pick it up to recover your gear.',
            'You do <b>not</b> lose floor progress. The Dungeon Gate drops you at a five-floor checkpoint at or just below where you died, and you walk the last stretch back down.',
          ] },
          { note: 'Bank gold and prized gear in the town Vault before a risky push, so a death can\'t take them.' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    id: 'controls',
    title: 'Controls',
    icon: 'ui_agility',
    blurb: 'Keyboard, mouse, touch and controller — every input, side by side.',
    articles: [
      {
        id: 'keyboard-mouse',
        title: 'Keyboard & Mouse',
        keywords: ['keyboard', 'mouse', 'wasd', 'arrows', 'click', 'move', 'sprint', 'dash', 'interact', 'potion', 'desktop', 'esc'],
        body: [
          { p: 'Keyboard and mouse is the primary way to play. Movement is <b>real-time and held</b> — hold a direction to walk, release to stop. A quick tap barely nudges you.' },
          { ul: [
            '<b>Move</b> — W/A/S/D or the arrow keys (always these; not rebindable). Two perpendicular keys move on a diagonal.',
            '<b>Click-to-move</b> — left-click the map to walk there; the hero routes around walls. Click a foe to chase it into range; click an NPC or the Dungeon Gate in town to walk over and open it.',
            '<b>Sprint</b> — hold <b>Shift</b> for a burst of speed (drains Stamina).',
            '<b>Dash</b> — <b>Space</b>: a short fast burst that costs Stamina.',
            '<b>Interact / pick up / talk</b> — <b>E</b>: open a chest, talk to an NPC, use a town keeper.',
            '<b>Potions</b> — Health and Mana potions on their own keys, always available.',
            '<b>Skills</b> — number keys fire your hotbar slots (or click a slot).',
            '<b>Bag</b>, <b>swap weapon set</b>, <b>town portal</b> — each on its own key.',
            '<b>Esc</b> — close the top menu, or open Settings.',
          ] },
          { note: 'Every non-movement key can be remapped in Settings ▸ Play ▸ KEYS. The keys above are the defaults.' },
        ],
      },
      {
        id: 'touch',
        title: 'Touch (Phone & Tablet)',
        keywords: ['touch', 'mobile', 'phone', 'tablet', 'joystick', 'tap', 'flick', 'fullscreen', 'portrait'],
        body: [
          { p: 'The first time you touch the screen, the interface switches to a mobile layout. Everything is still driveable from a keyboard too — nothing is locked away.' },
          { ul: [
            '<b>Drag</b> anywhere on the map to raise a floating <b>joystick</b> and steer. Push it to the rim to sprint.',
            '<b>Tap</b> a tile to walk there and use whatever\'s on arrival (open a chest, talk to an NPC). Tap a foe to chase and attack it.',
            '<b>Flick</b> the joystick (push and release fast) to <b>dash</b> in that direction.',
            'The <b>footer bar</b> holds a run toggle, town portal, potions, your auto-cast slot and skill slots — tap to fire, hold about half a second to read a tooltip.',
            'The <b>header</b> holds the minimap, vitals and the settings + bag buttons.',
          ] },
          { p: 'On touch the game runs fullscreen and is portrait-only (landscape shows a rotate prompt). Any tap re-enters fullscreen if you\'ve left it.' },
        ],
      },
      {
        id: 'controller',
        title: 'Controller / Gamepad',
        keywords: ['controller', 'gamepad', 'pad', 'joystick', 'xbox', 'playstation', 'steam deck', 'dualsense', 'buttons'],
        body: [
          { p: 'A gamepad is a fully supported input layer — plug in a PlayStation, Xbox or Steam Deck / generic pad and it\'s revealed on the first input. Everything in the game is doable on the pad, and the keyboard stays live alongside it.' },
          { h: 'In the dungeon' },
          { ul: [
            '<b>Left stick</b> moves; <b>R2</b> sprints; <b>R1</b> dashes.',
            'The bottom face button interacts / uses / opens chests; other face buttons open the Bag, toggle the log, and open a town portal.',
            'Hold <b>L1</b> and press a face button to cast a skill slot.',
            'The <b>D-pad</b> handles potions, weapon swap and auto-attack focus.',
            'The <b>right stick</b> aims a soft inspect reticle over foes.',
          ] },
          { h: 'In menus' },
          { p: 'The D-pad or left stick move the selection, the bottom face button selects, and the right face button backs out. Bumpers switch tabs. Clicking the right stick toggles a virtual cursor that works over anything as a universal fallback.' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    id: 'combat',
    title: 'Combat',
    icon: 'w_sword',
    blurb: 'How hits land, what scales your damage, and what shrugs it off.',
    articles: [
      {
        id: 'auto-attack',
        title: 'Auto-Attack & Positioning',
        keywords: ['auto-attack', 'attack', 'automatic', 'crosshair', 'target', 'focus', 'positioning'],
        body: [
          { p: 'Your <b>auto-attack is automatic</b> — there\'s no attack key. Whenever your swing is off cooldown, the hero strikes the nearest enemy within weapon range. Your job is <b>positioning</b>: get in range of melee foes, and keep line of sight for ranged ones.' },
          { p: 'A red crosshair marks the foe you\'re currently locked onto. You can toggle the crosshair in Settings ▸ Visuals, and choose which foe wins your focus in Settings ▸ Play.' },
          { note: 'Let auto-attack and auto-cast do the fighting — spend your control on moving well: hug melee targets, kite ranged ones, and dodge bolts and traps.' },
        ],
      },
      {
        id: 'weapons-reach',
        title: 'Weapons, Reach & Speed',
        keywords: ['weapon', 'reach', 'range', 'melee', 'ranged', 'bow', 'staff', 'spear', 'attack speed', 'slow', 'fast'],
        body: [
          { p: 'A weapon\'s <b>reach</b> is set by its sub-type. Broadly: staves and bows reach farthest, spears sit in the middle, and most blades and maces are melee (adjacent only). Some named sub-types reach further than their category — a Rapier out-reaches a plain sword, a Longbow out-reaches a shortbow.' },
          { h: 'Attack speed' },
          { p: 'Your <b>base swing speed</b> comes from the weapon\'s style before any bonuses: light flurry weapons (daggers, hatchets) are fastest, one-handers are normal, and heavy two-handers and casters are slowest. Weapon tooltips print a base "attacks/sec · Slow/Normal/Fast" so you can compare before equipping.' },
          { note: 'Ranged auto-attacks fire a flying bolt — the damage lands when the bolt reaches the foe, not the instant you shoot. A target reading full HP for a beat after you fire is normal.' },
        ],
      },
      {
        id: 'damage-sources',
        title: 'The Three Damage Sources',
        keywords: ['damage', 'scaling', 'attack', 'skill power', 'spell power', 'increased damage', 'hybrid', 'lane', 'build'],
        body: [
          { p: 'Damage comes from three distinct sources, each with its own scaling. Build into <b>one</b> and you don\'t accidentally waste stats on the others.' },
          { ul: [
            '<b>Auto-attack</b> — your automatic swing. Scales with weapon damage, Attack (ATK), and your class\'s damage attribute. Amplified by <b>Increased Damage %</b>; sped up by <b>Attack Speed %</b>.',
            '<b>Skills</b> (martial actives) — scale off the same weapon + ATK base, amplified by <b>Skill Power %</b>. Recharge shortened by <b>Cooldown Reduction</b>.',
            '<b>Spells</b> (magic actives) — scale off <b>Spirit</b> (not weapon or ATK at all), amplified by <b>Spell Power %</b>. Recharge shortened by Cooldown Reduction <b>and</b> Cast Speed %.',
          ] },
          { p: 'A <b>Hybrid</b> ability lands both a physical part (scales like a skill, can leech) and a magic part (scales like a spell) in one cast, so it\'s never fully walled by one defence.' },
          { note: 'Attack does NOT feed everything: ATK + weapon power drive auto-attacks and martial skills only. Spells ignore them and live on Spirit + Spell Power.' },
        ],
      },
      {
        id: 'crits',
        title: 'Critical Hits',
        keywords: ['crit', 'critical', 'crit damage', 'luck', 'dagger', 'cleave', 'stun'],
        body: [
          { p: 'A critical hit deals <b>2× base damage</b> (more with Crit Damage gear), and <b>every</b> damage source can crit — auto-attacks, martial skills and spells all roll criticals and trigger your on-crit passives.' },
          { p: 'There\'s no per-hit damage cap, so big swings and crits land their full number — burst is fully rewarded. Crit chance comes mainly from the <b>Luck</b> attribute and gear.' },
          { h: 'Weapon quirks' },
          { p: 'Different weapon styles carry their own tricks: daggers double-hit, axes and scythes cleave adjacent foes, maces can stun, and scythes lifesteal.' },
        ],
      },
      {
        id: 'defense-los',
        title: 'Armor, Resist & Line of Sight',
        keywords: ['armor', 'armour', 'magic resist', 'resistance', 'mitigation', 'penetration', 'pen', 'line of sight', 'los', 'wall', 'cover'],
        body: [
          { p: 'Every foe shrugs off a slice of each blow, and how big depends on the <b>school</b> of the hit. <b>Physical armor</b> blunts auto-attacks and martial skills; <b>magic resistance</b> blunts spells. Armor Penetration pierces armor; Magic Penetration pierces resistance.' },
          { p: 'Foes differ by nature — a stone or armored foe carries high armor but is soft to magic, while a ghost or elemental resists magic but not steel. <b>Hit each foe with the school it\'s soft to.</b> The bestiary card shows both values once you\'ve slain enough of a species.' },
          { h: 'Line of sight' },
          { p: 'Ranged auto-attacks, ranged skills and spells need a clear line: a solid wall, door, barrier or piece of furniture between you and a foe blocks them. Open ground and water give no cover, so you can shoot over them. It works both ways — foes can\'t shoot through walls either. Melee is unaffected.' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    id: 'survival',
    title: 'Staying Alive',
    icon: 'ic_heart',
    blurb: 'Healing, potions, your Spirit shield, and the two resource bars.',
    articles: [
      {
        id: 'healing',
        title: 'Healing Is Over Time',
        keywords: ['heal', 'healing', 'recovery', 'regen', 'pending', 'leech', 'lifesteal', 'over time', 'hp', 'health'],
        body: [
          { p: 'Most recovery is <b>over time</b>, not instant. Instead of snapping your Health up, it fills a <b>pending pool</b> that pays into your HP at a capped rate, so the bar climbs on a visible slope (shown as a translucent zone ahead of the solid fill).' },
          { p: 'Over-time sources <b>stack</b> — a potion sip pays out on top of any life leech, and incidental on-kill heals add in too.' },
          { h: 'What\'s still instant' },
          { p: 'Deliberate <b>heal skills</b> you cast, and emergency low-Health triggers, still land immediately. A cast heal\'s size scales off Spirit and Spell Power, so a high-Spirit healer mends far more per cast.' },
          { note: 'Because you can no longer burst back to full, don\'t wait until you\'re low. Sip early, keep moving, and let the pending pool refill while you avoid the next hit.' },
        ],
      },
      {
        id: 'potions',
        title: 'Health & Mana Potions',
        keywords: ['potion', 'potions', 'health potion', 'mana potion', 'cooldown', 'quaff', 'drink', 'sip', 'spilled'],
        body: [
          { p: 'Potions are always available — not a hoarded consumable. The <b>Health Potion</b> mends a chunk of your max HP over a few seconds; the <b>Mana Potion</b> restores mana the same way. They <b>share one cooldown</b>, so quaffing mana means forgoing a heal — a real triage choice.' },
          { p: 'The Health Potion sip is <b>interruptible</b>: one solid direct hit spills half the remaining sip. Damage-over-time (lava, poison, burn) never interrupts it, and earned leech is never interrupted — only the potion sip is fragile.' },
          { note: 'Potions work in town too, on the same cooldown, so you can top up instantly before a dive.' },
        ],
      },
      {
        id: 'spirit-veil',
        title: 'The Spirit Veil (Shield)',
        keywords: ['veil', 'spirit veil', 'shield', 'overshield', 'ward', 'spirit', 'recharge', 'defense', 'ehp'],
        body: [
          { p: 'The <b>Spirit Veil</b> is a persistent blue shield that sits <b>on top of your HP</b>: every hit, damage-over-time and hazard is soaked by the Veil first, and only the overflow bites your health. It shows as a shimmering blue mask over the HP bar.' },
          { p: 'The pool is fuelled by the <b>Spirit</b> attribute — more Spirit means a bigger Veil and slightly faster recharge. It scales separately from HP and is uncapped, so a Spirit-stacking caster can end up with a Veil larger than their health, while a Warrior who never invests Spirit barely has one.' },
          { h: 'How it refills' },
          { p: 'Recharge is automatic and the <b>only</b> way to refill it — no potion, skill or leech touches the Veil. After a few seconds without taking <b>any</b> damage it refills toward full. Taking a single hit — even a poison tick — resets that timer, so you top it up by disengaging for a moment, not by out-healing.' },
        ],
      },
      {
        id: 'stamina',
        title: 'Stamina',
        keywords: ['stamina', 'sprint', 'dash', 'run', 'vitality', 'exhaust', 'recharge'],
        body: [
          { p: '<b>Stamina</b> fuels sprinting and dashing. After you exert, it pauses briefly then refills — including while you rest in town. Sprint raises your top speed but burns Stamina steadily; a dash costs a fixed chunk and has a short cooldown.' },
          { p: 'The <b>Vitality</b> attribute deepens the pool and speeds its recharge, and gear can add Max Stamina and Stamina Regen — so even a class that never invests in Vitality can sprint on gear alone.' },
          { note: 'In town, sprinting is FREE — the safe camp never drains Stamina, so you can run everywhere at full speed.' },
        ],
      },
      {
        id: 'mana',
        title: 'Mana',
        keywords: ['mana', 'mp', 'spirit', 'regen', 'in combat', 'mana shield', 'cast'],
        body: [
          { p: '<b>Mana</b> pays for your active skills. It\'s a rationed resource: a modest pool, real skill costs, and regen that is <b>halved while you\'re in combat</b> (for a few seconds after dealing or taking damage). Sustained casting genuinely drains you.' },
          { p: 'The <b>Spirit</b> attribute grows your mana pool and regen. If you lean on spells, carry Mana Potions and consider Mana Cost Reduction gear.' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    id: 'skills',
    title: 'Skills & Abilities',
    icon: 'ic_orb',
    blurb: 'The skill bar, schools, ranking up, passives and auto-cast.',
    articles: [
      {
        id: 'skill-basics',
        title: 'The Skill Bar',
        keywords: ['skill', 'skills', 'bar', 'hotbar', 'slot', 'cooldown', 'mana', 'cast', 'learn'],
        body: [
          { p: 'Active skills cost <b>Mana</b> and each has its own cooldown in <b>seconds</b>. Their bar buttons glow when ready and grey out while recharging or when you can\'t afford the cost.' },
          { p: 'The bar has several <b>manual slots</b> (fired by number keys) plus one dedicated <b>auto-cast slot</b>. You decide what goes where — drag a learned active onto a slot, or use the SKILLS-tab buttons.' },
          { p: 'Cooldowns are real seconds. <b>Cooldown Reduction</b> speeds every active; <b>Cast Speed</b> speeds spells specifically. Both are rating stats that climb toward — but never fully reach — a 100% cut.' },
        ],
      },
      {
        id: 'schools',
        title: 'Skill, Spell & Hybrid',
        keywords: ['school', 'skill', 'spell', 'hybrid', 'martial', 'magic', 'badge', 'class'],
        body: [
          { p: 'Every active has a <b>school</b>, shown as a badge on its tree node:' },
          { ul: [
            '<b>Skill</b> — martial. Weapon-based, scales with weapon damage + Skill Power, can leech life, meets a foe\'s physical armor.',
            '<b>Spell</b> — magic. Scales with Spirit + Spell Power, never leeches, meets a foe\'s magic resistance.',
            '<b>Hybrid</b> — lands both a physical part and a magic part at once, and its tooltip spells out the split.',
          ] },
          { p: 'Classes lean differently: Warrior is all Skill, Mage all Spell, Rogue mostly skills with shadow/toxic hybrids, Templar mostly holy spells with holy-strike hybrids. Gear the stats that match the actives you lean on.' },
        ],
      },
      {
        id: 'ranking',
        title: 'Ranking Up & Milestones',
        keywords: ['rank', 'ranks', 'milestone', 'empowered', 'honed', 'mastered', 'surge', 'signature', 'passive'],
        body: [
          { p: 'Higher skill ranks cost more Mana but spike in power at ranks <b>3, 7 and 10</b> — so deepening one key skill outpaces its rising cost. On top of the flat power boost, each milestone grants a <b>signature perk</b> unique to that skill\'s archetype: a chain arcs to more foes, a summon raises an extra minion, a bolt gains a double-strike, and so on.' },
          { p: '<b>Passives</b> surge at those same ranks, and at rank 10 a passive unlocks one brand-new stat it never gave before. So maxing one passive beats spreading points thin.' },
          { note: 'Every skill\'s detail card shows a "Rank bonuses" ladder — each rung lights up once your rank has earned it.' },
        ],
      },
      {
        id: 'auto-cast',
        title: 'Auto-Cast',
        keywords: ['auto-cast', 'autocast', 'auto cast', 'automatic', 'slot', 'hands-free'],
        body: [
          { p: 'Exactly <b>one</b> skill can auto-cast — whatever you drop into the dedicated auto-cast slot in the middle of the bar. It fires itself the instant it\'s available (off cooldown and affordable), with no key press.' },
          { p: 'It\'s smart about waste: a damage skill only fires when a target is in range, and a pure heal waits until your Health dips. Arming a damage or buff skill lets you focus purely on movement.' },
          { note: 'Buffs are worth remembering: a self-buff\'s cooldown runs longer than the buff it grants, so even an auto-cast buff spends much of its time down. Cooldown Reduction raises that uptime.' },
        ],
      },
      {
        id: 'summons',
        title: 'Summons & Minions',
        keywords: ['summon', 'minion', 'minions', 'ally', 'allies', 'pet', 'ttl', 'expire'],
        body: [
          { p: 'Some actives <b>summon allies</b> that fight for you and soak hits, then expire after a number of turns — recast them as they run out. They deal capped damage, so don\'t expect a summon to solo a boss.' },
          { p: 'Ranged minions need line of sight to their target, just like you do — they\'ll close in until they can see it.' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    id: 'progression',
    title: 'Character & Progression',
    icon: 'ui_power',
    blurb: 'Classes, attributes, levelling, ascension and respec.',
    articles: [
      {
        id: 'classes',
        title: 'The Four Classes',
        keywords: ['class', 'classes', 'warrior', 'rogue', 'mage', 'templar', 'attribute', 'damage'],
        body: [
          { p: 'There are four classes, and each has <b>one damage attribute</b> that its damage scales from:' },
          { ul: [
            '<b>Warrior</b> — tanky melee; damage from <b>Might</b>.',
            '<b>Rogue</b> — crit and dodge; damage from <b>Agility</b>.',
            '<b>Mage</b> — spells and a deep mana pool; damage from <b>Spirit</b>.',
            '<b>Templar</b> — durable hybrid; damage from <b>Vitality</b>.',
          ] },
          { p: 'Your class also gates which weapons you can equip. Pump your class\'s single damage attribute for offence — but note every attribute also pays a defensive or utility role.' },
        ],
      },
      {
        id: 'attributes',
        title: 'The Five Attributes',
        keywords: ['attribute', 'attributes', 'might', 'vitality', 'agility', 'spirit', 'luck', 'points', 'stats'],
        body: [
          { p: 'Five attributes shape your hero. How much each point gives is <b>class-scaled</b> — the same point in Spirit gives a Mage more than it gives a Warrior.' },
          { ul: [
            '<b>Might</b> — Defense (and the Warrior\'s damage).',
            '<b>Vitality</b> — max HP, HP regen, Stamina (and the Templar\'s damage).',
            '<b>Agility</b> — evasion, accuracy, move & attack speed (and the Rogue\'s damage).',
            '<b>Spirit</b> — max MP, MP regen, spell power, healing, Spirit Veil (and the Mage\'s damage).',
            '<b>Luck</b> — crit chance and loot quality.',
          ] },
        ],
      },
      {
        id: 'leveling',
        title: 'Levelling & Skill Points',
        keywords: ['level', 'leveling', 'levelling', 'xp', 'experience', 'skill point', 'attribute point', 'tree'],
        body: [
          { p: 'Each level grants <b>5 attribute points</b> and <b>1 skill point</b>. Spend attributes on the HERO tab (shift-click to add 5 at once); spend skill points on the SKILLS tab\'s Passive and Active trees.' },
          { p: 'You can\'t out-level the dungeon — depth outpaces raw levels, so gear and a focused skill build matter more the deeper you go. Spend your first skill point on a root active (the only nodes with no prerequisites).' },
        ],
      },
      {
        id: 'ascension',
        title: 'Ascension (Advanced Paths)',
        keywords: ['ascension', 'ascend', 'path', 'ascendancy', 'level 20', 'trainer', 'advanced'],
        body: [
          { p: 'At <b>level 20</b> the town Trainer unlocks <b>Ascension</b> — an advanced path with signature passives and powerful, often summon-based, actives. Your first ascension is <b>free</b>, earned simply by reaching the level.' },
          { p: 'From level 20 you also earn a separate <b>ascendancy point every 5 levels</b>, spent only on the path tree. Normal skill points can\'t buy path skills, and ascendancy points can\'t buy ordinary skills. Path skills carry no level requirement — they\'re gated only by earlier skills in the path.' },
        ],
      },
      {
        id: 'respec',
        title: 'Respec & Retraining',
        keywords: ['respec', 'retrain', 'refund', 'reset', 'change class', 're-ascend', 'trainer'],
        body: [
          { p: 'The town <b>Trainer</b> can respec your attributes and skills, or change your class, for gold that scales with your level. You can also refund a single skill rank from its SKILLS-tab popover with the ↩️ Refund button.' },
          { p: 'Your <b>first</b> ascension stays free, but switching to your class\'s other ascension afterwards is a deliberate, costly choice.' },
          { note: 'After a respec, check that worn gear still meets its attribute requirements — under-requirement pieces turn red and are ignored until you grow into them.' },
        ],
      },
      {
        id: 'boss-points',
        title: 'Boss Points',
        keywords: ['boss point', 'boss points', 'first clear', 'weave', 'ascendant weave', 'endgame currency'],
        body: [
          { p: '<b>Boss Points</b> are a separate progression track that rewards new depth. Every boss floor you clear <b>for the first time</b> grants one point — farming a floor you\'ve already cleared grants none.' },
          { p: 'Spend them at the <b>Ascendant Weave</b>, a town service that opens once you\'ve cleared your first boss floor. It\'s a constellation board of stat nodes and keystones where every point is a real, opportunity-cost choice.' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    id: 'loot',
    title: 'Loot & Gear',
    icon: 'mat_glimmer',
    blurb: 'Rarity, item power, uniques, sets, curses and auto-loot.',
    articles: [
      {
        id: 'rarity',
        title: 'Rarity Tiers',
        keywords: ['rarity', 'tier', 'color', 'colour', 'grey', 'white', 'green', 'blue', 'purple', 'orange', 'red', 'quality', 'affix'],
        body: [
          { p: 'Rarity is shown by <b>colour only</b> — there are no text labels. From lowest to highest:' },
          { tiers: 1 },
          { p: 'Grey → white → green → blue → purple → orange → <b>red</b>. Higher tiers allow more bonus affixes, so a rarer piece generally carries more (and stronger) stats.' },
        ],
      },
      {
        id: 'item-power',
        title: 'Item Power (Build-Aware)',
        keywords: ['power', 'item power', 'gear power', 'upgrade', 'build', 'rating', 'strength', 'compare', 'sort'],
        body: [
          { p: '<b>Power</b> is a single number rating how strong a hero — or one gear piece — is. Crucially, it is <b>build-aware</b>: an item\'s Power is what its stats are actually worth to <b>your</b> hero\'s current build.' },
          { p: 'So a stat your build can\'t use is worth almost nothing to you — Crit Damage with no crit chance, or Spell Power on a pure martial build, barely moves your Power. The same item can be worth very different Power to two different heroes.' },
          { note: 'Sort your bag by Power and trust the "upgrade" swing over raw rarity — a higher-tier piece can still be a downgrade if its stats don\'t suit you.' },
        ],
      },
      {
        id: 'uniques',
        title: 'Uniques',
        keywords: ['unique', 'uniques', 'red', 'named', 'artifact', 'legendary', 'signature', 'fixed'],
        body: [
          { p: 'A <b>unique</b> (red) is a hand-crafted, named artifact — the one-of-a-kind version of a specific gear type. Unlike the random rarities, it\'s not randomly rolled: each unique always carries the same signature stat, the same modifiers, and a fixed set of signature powers that compound together.' },
          { p: 'Only the <b>values</b> vary, scaled to the depth it drops on, and they lock the moment it drops. A unique can\'t be augmented, rerolled or transmuted afterward.' },
          { note: 'Every legendary or unique drop pops a centre-screen banner the instant you gain it — from a kill, a chest, the gambler, a bounty or a fuse.' },
        ],
      },
      {
        id: 'sets',
        title: 'Set Pieces',
        keywords: ['set', 'sets', 'set piece', 'teal', 'completion', 'bonus', 'collection'],
        body: [
          { p: '<b>Set pieces</b> are the other top-rarity artifact, shown in <b>teal</b> rather than unique-red. Each is a pre-defined, named, fixed-stat piece — but it also belongs to a <b>set</b> (a family of named pieces).' },
          { p: 'Wearing more matched pieces of a set lights escalating bonuses. Wearing <b>every</b> piece completes the set: its top bonus tier and a set-wide <b>completion power</b> turn on, and the hero gains a golden aura. Sets vary in size (2 to 6 pieces), so small sets complete fast and large ones are a long chase.' },
        ],
      },
      {
        id: 'cursed',
        title: 'Cursed Items',
        keywords: ['cursed', 'curse', 'skull', 'drawback', 'penalty', 'trade-off'],
        body: [
          { p: 'Any green-or-better drop can roll a <b>curse</b> (about a 1-in-8 chance). A cursed item pairs a strong <b>boost</b> on one property with an equally strong <b>drawback</b> on another — both real, both flowing into your totals.' },
          { p: 'The drawback always lands on something you\'ll feel (a core stat or a damage amp), and the swing grows with rarity — a legendary curse hits far harder in both directions than an uncommon one. Like a unique, a cursed item is bound on drop and can\'t be reforged, so the trade is permanent.' },
          { note: 'A small skull marks a cursed item\'s name.' },
        ],
      },
      {
        id: 'bases',
        title: 'Bases & Class Lean',
        keywords: ['base', 'bases', 'slot', 'requirement', 'attribute gate', 'class lean', 'favoured'],
        body: [
          { p: 'Within a slot, the <b>base</b> (Helm vs Hood, Chestplate vs Robe) sets its defence and a protected signature stat that never rerolls. Heavier bases bank a defensive stat; lighter bases grant evasion, crit, mana, cooldown or find. Same slot, different roles — no base is strictly best.' },
          { p: 'Loot <b>leans to your class</b>: drops, the merchant and the gambler favour build-relevant bases. Each armour base also gates on the attribute that fits its identity, and that requirement climbs steeply with item level — so deep gear demands a real stake in its attribute, rewarding a committed build.' },
        ],
      },
      {
        id: 'auto-loot',
        title: 'Auto-Loot & Materials',
        keywords: ['auto-loot', 'autoloot', 'scrap', 'sell', 'keep', 'salvage', 'material', 'materials', 'glimmer', 'core', 'chaos'],
        body: [
          { p: '<b>Auto-Loot</b> applies a per-rarity rule the instant gear drops: <b>Keep</b> (default), <b>Scrap</b> into materials, or <b>Sell</b> for gold. Set it on the LOOT tab. It only touches organically-found drops and never locked items.' },
          { p: '<b>Scrapping</b> melts gear into crafting materials tied to its rarity: any piece gives Scrap, better pieces can shed Glimmer, a Core, and (at the top) a lucky Chaos Orb. Those materials feed the town Forge, Enchanter and Mirrorforge.' },
          { note: 'From the LOOT tab you can also Sort and Filter your bag, and Lock prized items so they\'re safe from sell, scrap and auto-loot.' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    id: 'dungeon',
    title: 'The Dungeon',
    icon: 'ic_fire',
    blurb: 'Floors, hazards, shrines, vaults, teleporters and boss arenas.',
    articles: [
      {
        id: 'hazards',
        title: 'Terrain & Hazards',
        keywords: ['hazard', 'hazards', 'lava', 'spikes', 'water', 'trap', 'traps', 'arrow', 'fire vent', 'furniture'],
        body: [
          { p: 'The floor holds terrain that helps and hurts. <b>Deep water</b> blocks walking but you can see and shoot over it. <b>Lava</b> and <b>spikes</b> are walkable but hurt — they never kill you outright (your HP clamps to 1), and the generator never forces you across one, so route around them.' },
          { h: 'Traps' },
          { ul: [
            '<b>Arrow traps</b> loose a bolt down a fixed lane every couple of seconds — step out of its line.',
            '<b>Fire vents</b> only burn while flaring <b>and</b> you\'re standing on them — cross while idle.',
            'Some floors are trap-themed, packing one trap kind in far denser (with richer loot to reward threading them). A walkable route through is always guaranteed.',
          ] },
          { p: '<b>Solid furniture</b> blocks movement for you and foes alike, so it doubles as cover and a chokepoint to break a chase.' },
        ],
      },
      {
        id: 'shrines',
        title: 'Shrines & Fountains',
        keywords: ['shrine', 'shrines', 'fountain', 'power', 'guard', 'fortune', 'wisdom', 'blood', 'boon'],
        body: [
          { p: '<b>Shrines</b> grant boons, but check the kind before you step on: <b>power</b>, <b>guard</b> and <b>fortune</b> are good multi-floor buffs, <b>wisdom</b> restores health and mana — but <b>blood</b> costs a chunk of your current HP.' },
          { p: '<b>Fountains</b> full-heal you once. Take these deliberately, not while fleeing.' },
        ],
      },
      {
        id: 'vaults',
        title: 'Vaults, Keys & Cracked Walls',
        keywords: ['vault', 'locked door', 'key', 'cracked wall', 'shortcut', 'smash', 'hoard', 'express stair'],
        body: [
          { p: '<b>Locked vault doors</b> need the vault key (it glows and bobs on the floor). Carry the key over and shove into the door to open it. What\'s behind varies wildly — a rich hoard, an armory, a healing fountain, a room of elite guards, or even an express staircase that plunges you two floors deeper.' },
          { p: 'Vault foes are <b>optional</b> — they never seal the stairs, so opening a combat vault is always your choice.' },
          { h: 'Cracked walls' },
          { p: '<b>Cracked walls</b> are shortcuts you smash open: shove into one from any direction (walk or dash) and it chips away over a few hits, growing visibly more cracked each time, until it collapses.' },
        ],
      },
      {
        id: 'teleporters',
        title: 'Teleporters',
        keywords: ['teleporter', 'teleport', 'portal pad', 'warp', 'destination'],
        body: [
          { p: '<b>Teleporter pads</b> come in linked pairs. Stepping on one plays a short walk-through-portal animation — the camera pans across to the partner pad and you step out there, briefly frozen and unhittable.' },
          { note: 'Use a teleporter deliberately, when you want its destination — not as a panic escape.' },
        ],
      },
      {
        id: 'boss-floors',
        title: 'Boss Floors',
        keywords: ['boss', 'boss floor', 'guardian', 'arena', 'telegraph', 'gate', 'sealed', 'every 5th'],
        body: [
          { p: 'Every 5th floor is a <b>boss floor</b>: a fixed circular arena with a single guardian holding the centre and four pillars for cover. Stepping in raises a world-pausing gate — you can commit or back out.' },
          { p: 'Once inside, both staircases and the town portal are <b>sealed</b> until the guardian dies — no retreat. There\'s no trash to fight; it\'s a duel of <b>telegraphed attacks</b>. Each wind-up shows its shape (a disc, a ring with a safe hole, a lane, a cone) and a timer — always dodgeable by moving out of the zone before it lands.' },
          { note: 'Bosses enter offensive phases: they enrage below 40% HP, and briefly go berserk. Kite until a berserk lapses, then burst.' },
        ],
      },
      {
        id: 'special-floors',
        title: 'Special Floors',
        keywords: ['island', 'sea', 'cavern', 'big floor', 'greed', 'cursed floor', 'quest', 'modifier'],
        body: [
          { h: 'Island floors' },
          { p: 'Now and then an outdoor floor is an <b>island</b>, ringed by open sea instead of a rock wall. You can see and shoot across the water but never walk off — the shore is the boundary.' },
          { h: 'Big caverns' },
          { p: 'Some non-boss floors open into a large, airy cavern of sprawling rooms. Foe and hazard density scales with area, so a big floor isn\'t emptier — just roomier.' },
          { h: 'The cursed (greed) floor' },
          { p: 'Rarely, on descending, a prompt offers to brave the floor for <b>doubled loot and gold</b> at the cost of tougher foes. Movement freezes until you choose to accept or decline.' },
        ],
      },
      {
        id: 'quests',
        title: 'Floor Quests',
        keywords: ['quest', 'quests', 'mini-quest', 'escort', 'rescue', 'fetch', 'hunt', 'cleanse', 'bonus'],
        body: [
          { p: 'About a third of non-boss floors spawn one <b>optional quest</b> for a bonus reward (gold, XP and a gear chest). Kinds include rescuing or escorting an NPC, hunting a named foe, clearing every foe, fetching a relic, paying a tribute, or visiting a set of markers.' },
          { p: 'Quests <b>never seal the stairs</b> and are safe to skip — but the reward scales with depth, so grab the cheap ones on your way to the exit.' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    id: 'enemies',
    title: 'Enemies',
    icon: 'ui_foes',
    blurb: 'Behaviors, elite affixes, bosses, goblins and the bestiary.',
    articles: [
      {
        id: 'behaviors',
        title: 'Enemy Behaviors',
        keywords: ['enemy', 'enemies', 'behavior', 'chaser', 'swift', 'pack', 'erratic', 'brute', 'lurker', 'caster', 'ranged'],
        body: [
          { p: 'Foes only wake and act when you\'re close and in sight, so you can scout and path around dormant ones by keeping your distance and breaking line of sight. Each type moves and fights differently:' },
          { ul: [
            '<b>Chaser</b> — steady pursuit.',
            '<b>Swift</b> — fast but frail vermin.',
            '<b>Pack</b> — individually weak, but rush faster when you\'re low; they swarm.',
            '<b>Erratic</b> — darts unpredictably.',
            '<b>Brute</b> — slow and tanky, hits hard — kiting works.',
            '<b>Lurker</b> — ambushes for a heavier blow.',
            '<b>Caster</b> — squishy, but looses dodgeable bolts from range.',
          ] },
          { note: 'Ranged foes fire bolts that only hurt you if they actually reach you. Keep moving across a shooter\'s line, or break it behind a wall.' },
        ],
      },
      {
        id: 'affixes',
        title: 'Elite Affixes',
        keywords: ['affix', 'affixes', 'elite', 'tough', 'fierce', 'venomous', 'accurate', 'evasive', 'chill', 'aura'],
        body: [
          { p: 'Roughly a fifth of ordinary foes carry <b>one</b> elite modifier, shown by a coloured aura and a name prefix. Read the affix, not just the sprite:' },
          { ul: [
            '<b>Tough</b> — extra HP.',
            '<b>Fierce</b> — extra damage.',
            '<b>Venomous</b> — poison on hit.',
            '<b>Accurate</b> — cuts through your dodge.',
            '<b>Evasive</b> — your hits often whiff (bring Accuracy).',
            '<b>Chill</b> — snares you on hit.',
          ] },
        ],
      },
      {
        id: 'bosses',
        title: 'Bosses & Conquest',
        keywords: ['boss', 'guardian', 'warded', 'enrage', 'berserk', 'first kill', 'jackpot', 'conquest', 'scar', 'rainbow gate'],
        body: [
          { p: 'Boss guardians reward patience. Respect <b>warded</b> (your damage is halved while the ward is up — wait it out, then burst) and stay out of boss flame and barriers.' },
          { h: 'First-kill jackpot' },
          { p: 'The <b>first</b> time you clear a given boss floor, its guardian spills roughly double the loot at noticeably better quality — a one-time windfall. Because bosses recur in Endless, each new or deeper boss floor pays its own windfall, so descending to a fresh boss floor is always the richer prize.' },
          { h: 'Conquering a tier' },
          { p: 'Floor 25 of a finite tier is the final guardian — clearing it conquers the tier and brands a permanent "conquest scar" (a small, stacking cut to max HP and damage). A rainbow gate then opens; step onto it to dive straight into the next tier, or pick it later at the town Dungeon Gate.' },
        ],
      },
      {
        id: 'goblins',
        title: 'Treasure Goblins',
        keywords: ['goblin', 'goblins', 'treasure', 'flee', 'jackpot', 'chase'],
        body: [
          { p: '<b>Treasure Goblins</b> flee, never attack, and do <b>not</b> block the exit. Chase one down fast for jackpot loot — but it vanishes a few seconds after the first hit, so commit or ignore it.' },
        ],
      },
      {
        id: 'bestiary',
        title: 'The Bestiary',
        keywords: ['bestiary', 'codex', 'monster', 'species', 'inspect', 'discovered', 'kills', 'card'],
        body: [
          { p: 'Every foe you meet is recorded in the <b>Bestiary</b>, a codex opened from the pause menu. Hovering a foe in the dungeon already pops an inspect card; the Bestiary collects one card per species so you can browse the whole roster.' },
          { p: 'A species\' stats stay hidden until you\'ve slain enough of it — each field reveals at its own kill threshold. The Bestiary is <b>account-wide</b>: kills accumulate across every hero and survive death or a reset.' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    id: 'town',
    title: 'Town',
    icon: 'ic_money',
    blurb: 'The safe camp and every keeper: shops, crafting, the Vault and more.',
    articles: [
      {
        id: 'town-overview',
        title: 'Town Overview',
        keywords: ['town', 'camp', 'keeper', 'gate', 'portal', 'checkpoint', 'rest', 'walkable'],
        body: [
          { p: 'Town is a walkable base <b>camp</b>, not a menu. You arrive in a forest clearing; walk up to a keeper and interact to use their service. Time keeps flowing here — HP, MP and Stamina regen while you roam — so resting a moment restores you for free.' },
          { p: 'Two objects are your exits: the <b>Dungeon Gate</b> opens a tier + floor picker (you can warp in on any five-floor checkpoint up to your deepest floor), and the <b>Town Portal</b> — present only when you left a floor by portal — drops you right back where you left.' },
          { note: 'A keeper stays greyed with a padlock until you meet its unlock requirement, and tells you the requirement when you interact.' },
        ],
      },
      {
        id: 'shops',
        title: 'Merchant, Forge & Enchanter',
        keywords: ['merchant', 'shop', 'buy', 'restock', 'forge', 'craftsman', 'craft', 'enchanter', 'enchant', 'augment', 'reroll', 'empower'],
        body: [
          { ul: [
            '<b>Merchant</b> — buy gear (uncommon and up), and pay to restock the wares (each restock this visit makes the next one dearer).',
            '<b>Craftsman / Forge</b> — forge a blank item from materials and gold; its rarity sets how many affix slots it gets.',
            '<b>Enchanter</b> — add or reroll affixes on a piece, and <b>Empower</b> it to raise its item level (scaling every stat up as if it dropped deeper). Each piece asks for its own randomized mix of crafting materials, and every reroll permanently raises that piece\'s future enchant costs — so chasing a perfect roll gets steadily dearer.',
            '<b>Healer</b> — a full heal and cure for gold.',
          ] },
          { note: 'A spend menu warns "Can\'t equip yet — needs N ATTR" when your attributes can\'t wield a piece. It\'s a heads-up, not a block: you can still buy it and grow into it.' },
        ],
      },
      {
        id: 'vault',
        title: 'Vault & Collection',
        keywords: ['vault', 'stash', 'bank', 'storage', 'collection', 'shared', 'gold', 'gambler', 'transmuter'],
        body: [
          { p: 'The <b>Vault</b> banks gold and gear safe from death — and banked gold is still spendable, since any shop auto-draws a shortfall from it. The Vault and your crafting materials are <b>shared across all your heroes</b> (Standard and Hardcore keep separate pools; a Self-Found hero is walled off from both).' },
          { p: 'Its <b>Collection</b> tab has one slot for every unique and set piece in the game — store one and its slot lights up, so it doubles as a showcase of what you\'ve found.' },
          { h: 'Other keepers' },
          { p: 'The <b>Gambler</b> wagers gold for random gear (pick a slot to guarantee the type), and the <b>Transmuter</b> fuses several same-rarity pieces into one of the next rarity up.' },
        ],
      },
      {
        id: 'buffs-hires',
        title: 'Ramen House, Mystic & Sellsword',
        keywords: ['ramen', 'cook', 'food', 'meal', 'mystic', 'pact', 'sellsword', 'mercenary', 'hire', 'buff'],
        body: [
          { ul: [
            '<b>Ramen House</b> — cook toppings into a multi-floor food buff (only one active at a time). Secret recipes can grant lifesteal, thorns, bonus XP, or a one-time revive. Assign cooked bowls to meal slots to eat them mid-run.',
            '<b>Mystic</b> — buy a multi-floor <b>pact</b> that warps the next 1, 5 or 10 floors (more damage, loot or gold, or an easier stretch). Each mystic offers two of the twelve pacts at random, so the pick changes every time; sealing more floors costs more per floor.',
            '<b>Sellsword</b> (Brutal and up) — hire a combat companion for a stretch of floors; it fights beside you like a strong summon and revives between floors.',
          ] },
        ],
      },
      {
        id: 'bounties',
        title: 'The Bounty Board',
        keywords: ['bounty', 'bounties', 'contract', 'board', 'reward', 'slay', 'clear', 'reach'],
        body: [
          { p: 'The <b>Bounty Board</b> offers one contract at a time from a rotating list — slay foes, clear floors, reach a depth, slay bosses, or plunder gold. Progress tracks live from your running totals, so you complete it just by playing.' },
          { p: 'The instant a contract\'s goal is met, a "Bounty complete!" banner announces it and the tracker flips to a green "ready to claim" state — head back to town to turn it in. Each contract pays a different mix of gold, materials, XP or a gear piece, and one paying fewer things pays more of each.' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    id: 'endgame',
    title: 'Endgame Systems',
    icon: 'mat_core',
    blurb: 'The deep-progression systems that open as you conquer tiers.',
    articles: [
      {
        id: 'weave',
        title: 'The Ascendant Weave',
        keywords: ['weave', 'ascendant weave', 'constellation', 'keystone', 'boss point', 'board'],
        body: [
          { p: 'The <b>Ascendant Weave</b> is a constellation choice board fed by <b>boss points</b>, opened once you clear your first boss floor. It has five arms — one per attribute — each four rings deep. Light an arm\'s entry node first, then branch outward toward its deep apex.' },
          { p: '<b>Keystones</b> are build-definers that ignite once you\'ve entered their arm and crossed its gate. Gates ladder up: a cheap keystone lights early, while an apex keystone can demand a high attribute total, most of an arm lit, and a large total board investment all at once — so the strongest bonuses reward a dedicated build.' },
          { note: 'Every node refunds for free, so you can freely re-plan a build.' },
        ],
      },
      {
        id: 'covenants',
        title: 'Dread Covenants',
        keywords: ['covenant', 'covenants', 'dread', 'oath', 'curse', 'malaise', 'risk', 'reward', 'mark'],
        body: [
          { p: '<b>Dread Covenants</b> are opt-in curses you swear at the Covenant Altar <b>before</b> a descent. Each is worth some Dread, and your total Dread is the number the whole system pivots on.' },
          { p: 'A covenant only ever makes enemies tougher, denser or deadlier — never a hard lockout, always pressure you can out-play. In return, higher Dread multiplies loot, rarity, boss points and materials. Beating bosses under Dread earns marks that unlock deeper covenants.' },
        ],
      },
      {
        id: 'mirrorforge',
        title: 'The Mirrorforge',
        keywords: ['mirrorforge', 'mirror', 'forge', 'perfect', 'forging potential', 'attune', 'exalt', 'divine', 'corrupt', 'radiant', 'aether'],
        body: [
          { p: 'The <b>Mirrorforge</b> is a deep-crafting bench that turns your late-game material glut into a planned climb toward perfect gear. Each item has a finite <b>Forging Potential</b> budget, so perfection must be planned, not brute-forced.' },
          { p: 'Its tools sculpt an item\'s affixes step by step — guaranteeing better rolls, shoving one affix toward its ceiling, or gambling on a one-shot corruption. At the end you can <b>Mirror</b> a flawless copy into a permanent "Perfected" collection.' },
        ],
      },
      {
        id: 'pantheon',
        title: 'Pantheon of the Deep',
        keywords: ['pantheon', 'god', 'gods', 'effigy', 'shard', 'mythic', 'uber', 'summon', 'capstone'],
        body: [
          { p: 'The <b>Pantheon of the Deep</b> is a roster of summon-on-demand capstone bosses that drop exclusive <b>Mythic</b> gear found nowhere else. Deep and Endless bosses sometimes drop <b>Effigy shards</b>; bank them, then spend a set of one type at the Altar to forge an Effigy and summon that god.' },
          { p: 'Each summon drops you into a bespoke multi-phase arena fight. Every god has bad-luck protection on its Mythic pool, and a staircase of Base gods leads to deadlier Uber versions that unlock as you go deeper.' },
        ],
      },
      {
        id: 'cycles',
        title: 'Cycles (Seasons)',
        keywords: ['cycle', 'cycles', 'season', 'seasonal', 'ladder', 'journey', 'legacy'],
        body: [
          { p: '<b>Cycles</b> are opt-in seasonal ladders. An enrolled hero races the live season under a rotating headline rule that changes how the run plays, with a fixed milestone Journey to complete along the way.' },
          { p: 'The leaderboard is captured and reset at season end — and when the season closes, your seasonal hero forks into a permanent Legacy hero, so nothing is lost.' },
        ],
      },
      {
        id: 'deeds',
        title: 'The Hall of Deeds',
        keywords: ['deed', 'deeds', 'renown', 'hall', 'title', 'frame', 'badge', 'trophy', 'wardrobe', 'cosmetic'],
        body: [
          { p: 'The <b>Hall of Deeds</b> is an account-wide honour roll shared by every hero. Renown is a <b>power-free</b> status ladder — completing deeds never grants a stat.' },
          { p: 'Deeds are permanent milestones across tracks like Collection, Bestiary, Conquest, Depth, Bounties and more. Crossing a renown rank unlocks cosmetic or quality-of-life rewards — extra stash tabs, wearable titles, portrait frames and badges — which you equip from the Wardrobe.' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    id: 'meta',
    title: 'Tips & Saves',
    icon: 'town_vault',
    blurb: 'Strategy pointers and how your saves work across devices.',
    articles: [
      {
        id: 'tips',
        title: 'Strategy Tips',
        keywords: ['tips', 'strategy', 'advice', 'help', 'beginner', 'survive'],
        body: [
          { p: 'A few habits that keep you alive and moving:' },
          { ul: [
            'Let auto-attack and auto-cast fight — spend your control on <b>positioning</b>. Hug melee targets, kite casters, dodge bolts and flaring vents.',
            'Watch your Stamina before sprinting or dashing, so you\'re never caught empty.',
            'Sip a heal <b>early</b>, not at zero — recovery is over time and can be interrupted.',
            'On boss floors, wait out a <b>ward</b> and stay clear of flame and barriers.',
            'Check a shrine\'s kind before stepping on (blood costs HP), and only take a teleporter when you want its destination.',
            'Set Auto-Loot to scrap or sell junk rarities so your bag stays clean, and lock your keepers.',
            'Bank gold and gear in the Vault before a risky push — death costs a fraction of carried gold and drops your whole bag as a grave.',
          ] },
        ],
      },
      {
        id: 'cloud',
        title: 'Cloud Saves & Devices',
        keywords: ['cloud', 'save', 'saves', 'sync', 'account', 'sign in', 'login', 'cross-device', 'backup'],
        body: [
          { p: 'Saves live in your browser by default. Sign in (Settings ▸ Account) with an email and password to also mirror every save slot, your shared Vault and your settings to the cloud, so the same heroes follow you across devices. It\'s optional and free; signed out, the game behaves exactly as before.' },
          { p: 'Cross-device saves are conflict-safe: whichever copy of a hero has been played longer wins a merge, and a copy is never overwritten by an older one. A window you leave idle stops writing and re-checks the account when you return, so it\'s safe to leave the game open on one machine and keep playing on another.' },
        ],
      },
    ],
  },
];

// Flatten the wiki to a simple list of { catId, catTitle, catIcon, article }
// entries — handy for search indexing and for "jump to any article" UIs. Pure,
// derived, no state.
export function wikiArticles(wiki = WIKI) {
  const out = [];
  for (const cat of wiki) {
    for (const article of cat.articles) {
      out.push({ catId: cat.id, catTitle: cat.title, catIcon: cat.icon, article });
    }
  }
  return out;
}
