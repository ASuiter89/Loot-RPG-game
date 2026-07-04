// ── EQUIPMENT SETS ─────────────────────────────────────────────────────────
// The top-rarity CHASE. A set is a family of PRE-DEFINED, NAMED, FIXED-stat
// artifact `pieces` — one per gear slot the set covers — PLUS set-level worn-count
// bonus tiers and a completion power. Each piece is built exactly like a unique
// (see src/data/uniques.js + buildSetPiece/buildFixedArtifact in the legacy
// layer): a fixed `native` signature stat, six fixed `mods` (five stats + one
// attribute), its own signature `power` (an ITEM_POWERS key), and flavour — values
// roll by depth once at drop, then lock. On top of that, matching pieces of the
// same set lights escalating `bonus` tiers and, at full completion, the set
// `power` (a set-wide effect) and a golden aura.
//
// Pure data — no game state, DOM or RNG. Consumed by src/systems/itemSets.js
// (piece counts, completion, contribution, drop rolls) and the legacy build/tooltip.
// Design rules this table upholds (guarded by test/data/itemSets.test.js, which
// mirrors the unique conventions in test/data/uniques.test.js):
//
//   • Each set covers a fixed list of slots — one authored piece per slot. Sets
//     deliberately VARY in size (2 → 6 pieces). Between them they cover EVERY slot.
//   • `bonus` thresholds key on matched-piece count; the TOP threshold == the set's
//     size (the completion tier). More than four pieces ⇒ tiers beyond four.
//   • Every piece: valid base for its slot; native is a stat that avoids the slot's
//     auto-headline and never DMG; exactly six mods (5 distinct stats + 1 attr,
//     none equal to native/headline); caster bases never use SKILLPWR/ATKSPD and
//     martial bases never SPELLPWR/CASTSPD; a valid ITEM_POWERS power; a distinct
//     proper name and original flavour.

// A stat modifier.
const s = (key) => ({ kind: 'stat', key });
// An attribute modifier.
const a = (key) => ({ kind: 'attr', key });

// Which slot each base belongs to (mirrors SLOTS in src/legacy/game.js). Used to
// stamp `slot` onto every piece so lookups never re-derive it.
const BASE_SLOT = {
  Shortsword: 'weapon', 'Arming Sword': 'weapon', Rapier: 'weapon', Greatsword: 'weapon', Claymore: 'weapon',
  Hatchet: 'weapon', 'War Axe': 'weapon', Greataxe: 'weapon', Battleaxe: 'weapon', Dagger: 'weapon',
  Stiletto: 'weapon', Kris: 'weapon', Mace: 'weapon', Morningstar: 'weapon', Maul: 'weapon',
  Spear: 'weapon', Halberd: 'weapon', Pike: 'weapon', Staff: 'weapon', Wand: 'weapon',
  Shortbow: 'weapon', Longbow: 'weapon', Scythe: 'weapon', 'War Scythe': 'weapon',
  Buckler: 'offhand', 'Kite Shield': 'offhand', 'Tower Shield': 'offhand', Tome: 'offhand',
  Focus: 'offhand', Quiver: 'offhand', 'Parrying Dagger': 'offhand',
  Helm: 'head', Cap: 'head', Crown: 'head', Hood: 'head', Circlet: 'head',
  Chestplate: 'chest', Robe: 'chest', Cuirass: 'chest', Tunic: 'chest', Mail: 'chest',
  Gauntlets: 'hands', Gloves: 'hands', Bracers: 'hands', Grips: 'hands',
  Greaves: 'legs', Leggings: 'legs', Tassets: 'legs', Trousers: 'legs',
  Ring: 'ring', Band: 'ring', Signet: 'ring', Loop: 'ring',
  Amulet: 'amulet', Pendant: 'amulet', Necklace: 'amulet', Talisman: 'amulet', Charm: 'amulet',
};

// The raw roster (each piece's `slot` is stamped on below, so it never drifts).
const RAW_SETS = {
  warden: {
    name: 'Warden\'s', color: '#7fd0ff', cls: 'templar',
    bonus: { 2: { DEF: 14, HP: 50 }, 3: { BLOCK: 12, DR: 6 }, 5: { DEF: 40, HP: 170, THORNS: 12 } },
    power: { name: 'Aegis Wall', stats: { DR: 10, THORNS: 12, BLOCK: 10 },
      desc: 'Turn aside more blows and reflect a punishing share of every hit back at attackers.' },
    pieces: [
      { id: 'wardenTowerShield', base: 'Tower Shield', name: 'Warden\'s Bastion', native: 'DR',
        mods: [s('THORNS'), s('HP'), s('REGEN'), s('TENAC'), s('STUNPWR'), a('might')], power: 'bulwark',
        flavor: 'raised like a wall no charge has ever broken' },
      { id: 'wardenHelm', base: 'Helm', name: 'The Sealed Vigil', native: 'TENAC',
        mods: [s('HP'), s('DR'), s('BLOCK'), s('REGEN'), s('ACC'), a('spirit')], power: 'tenacious',
        flavor: 'a visor sealed shut so no blow ever finds the face behind it' },
      { id: 'wardenChestplate', base: 'Chestplate', name: 'The Unbroken Aegis', native: 'BLOCK',
        mods: [s('DR'), s('THORNS'), s('HP'), s('REGEN'), s('TENAC'), a('vitality')], power: 'ironhide',
        flavor: 'layered plate that folds the killing blow down into a bruise' },
      { id: 'wardenGauntlets', base: 'Gauntlets', name: 'The Warding Clasp', native: 'THORNS',
        mods: [s('BLOCK'), s('DR'), s('STUNPWR'), s('HPKILL'), s('TENAC'), a('might')], power: 'thornmail',
        flavor: 'steel fingers that close on a blade and refuse to let it go' },
      { id: 'wardenGreaves', base: 'Greaves', name: 'The Anchored Footing', native: 'HP',
        mods: [s('DR'), s('THORNS'), s('REGEN'), s('TENAC'), s('STUNPWR'), a('vitality')], power: 'stalwart',
        flavor: 'planted so deep that no shove or blast can move the one who wears them' },
    ] },
  reaver: {
    name: 'Reaver\'s', color: '#ff7a5c', cls: 'warrior',
    bonus: { 2: { ATK: 12, CRIT: 7 }, 3: { ATK: 30, CRIT: 16, IDMG: 16 } },
    power: { name: 'Bloodfrenzy', stats: { LEECH: 8, CLEAVE: 30, EXEC: 12 },
      desc: 'Hits cleave into nearby foes, leech their life, and execute the wounded.' },
    pieces: [
      { id: 'reaverGreataxe', base: 'Greataxe', name: 'Sundergrin', native: 'PEN',
        mods: [s('CLEAVE'), s('CRIT'), s('CRITDMG'), s('BOSSDMG'), s('STUNPWR'), a('might')], power: 'rending',
        flavor: 'splits plate like rotten bark and never stops grinning' },
      { id: 'reaverCuirass', base: 'Cuirass', name: 'Scarwake', native: 'LEECH',
        mods: [s('HP'), s('HPKILL'), s('THORNS'), s('REGEN'), s('IDMG'), a('vitality')], power: 'bloodthirsty',
        flavor: 'hangs open on purpose, daring the next blade to carve a fresh scar' },
      { id: 'reaverBracers', base: 'Bracers', name: 'Gorewrist', native: 'CRITDMG',
        mods: [s('CRIT'), s('ATKSPD'), s('DBLSTRIKE'), s('EXEC'), s('BLEED'), a('agility')], power: 'frenzied',
        flavor: 'caked in the dried blood of a hundred finished fights' },
    ] },
  arcanist: {
    name: 'Arcanist\'s', color: '#c77bff', cls: 'mage',
    bonus: { 2: { SPELLPWR: 10, MP: 50 }, 3: { CDR: 8, MCR: 12 }, 4: { SPELLPWR: 24, MP: 150, CASTSPD: 14 } },
    power: { name: 'Arcane Overflow', stats: { CDR: 10, MPLEECH: 10, SPELLPWR: 14 },
      desc: 'Skills recharge faster and the damage you deal refunds mana.' },
    pieces: [
      { id: 'arcanistStaff', base: 'Staff', name: 'Surgecaller', native: 'SPELLPWR',
        mods: [s('CASTSPD'), s('CRIT'), s('CRITDMG'), s('PEN'), s('MP'), a('spirit')], power: 'warmage',
        flavor: 'it hums with more spell than one caster can spend, and spends it anyway' },
      { id: 'arcanistTome', base: 'Tome', name: 'The Ceaseless Recitation', native: 'CDR',
        mods: [s('MCR'), s('MPKILL'), s('REGEN'), s('MP'), s('CASTSPD'), a('spirit')], power: 'spellbound',
        flavor: 'it turns its own pages and speaks the next spell before you finish the last' },
      { id: 'arcanistLoop', base: 'Loop', name: 'The Widening Coil', native: 'MP',
        mods: [s('MPLEECH'), s('MPKILL'), s('REGEN'), s('CDR'), s('MCR'), a('spirit')], power: 'attuned',
        flavor: 'it prises the channel wider until mana pours in faster than you can burn it' },
      { id: 'arcanistNecklace', base: 'Necklace', name: 'The Sevenwell', native: 'MCR',
        mods: [s('CDR'), s('CASTSPD'), s('CRIT'), s('PEN'), s('MPLEECH'), a('spirit')], power: 'focused',
        flavor: 'seven wells feed a single chain, and not one of them ever runs dry' },
    ] },
  stalker: {
    name: 'Stalker\'s', color: '#63e6a8', cls: 'rogue',
    bonus: { 2: { SPD: 6, CRIT: 6 }, 3: { DODGE: 8, ACC: 8 }, 4: { ATKSPD: 12, DBLSTRIKE: 10 }, 6: { SPD: 12, CRIT: 14, CRITDMG: 40 } },
    power: { name: 'Ghost Step', stats: { DODGE: 10, DBLSTRIKE: 18, CRITDMG: 30 },
      desc: 'Blur between strikes — slip more blows, and each hit twins into a second.' },
    pieces: [
      { id: 'stalkerDagger', base: 'Dagger', name: 'Vanishfang', native: 'DBLSTRIKE',
        mods: [s('CRIT'), s('CRITDMG'), s('ATKSPD'), s('PEN'), s('SPD'), a('agility')], power: 'flurry',
        flavor: 'home and gone before the wound remembers how it opened' },
      { id: 'stalkerHood', base: 'Hood', name: 'The Fading Cowl', native: 'DODGE',
        mods: [s('SPD'), s('ACC'), s('CRIT'), s('DBLSTRIKE'), s('TENAC'), a('agility')], power: 'evasive',
        flavor: 'draw it up and the eye slides off you like water off glass' },
      { id: 'stalkerTunic', base: 'Tunic', name: 'Hushweave', native: 'CRIT',
        mods: [s('CRITDMG'), s('DODGE'), s('SPD'), s('LEECH'), s('HP'), a('agility')], power: 'keen',
        flavor: 'stitched so close that not even your own footfall hears you pass' },
      { id: 'stalkerGrips', base: 'Grips', name: 'Surehold', native: 'ACC',
        mods: [s('CRIT'), s('CRITDMG'), s('DBLSTRIKE'), s('ATKSPD'), s('PEN'), a('luck')], power: 'duelist',
        flavor: 'the hilt has never once turned in a hand that wore these' },
      { id: 'stalkerTrousers', base: 'Trousers', name: 'Longstalk', native: 'SPD',
        mods: [s('DODGE'), s('ACC'), s('CRIT'), s('HPKILL'), s('REGEN'), a('agility')], power: 'fleet',
        flavor: 'built for the patient mile that ends at a throat' },
      { id: 'stalkerSignet', base: 'Signet', name: 'The Deathmark', native: 'EXEC',
        mods: [s('CRIT'), s('CRITDMG'), s('PEN'), s('BOSSDMG'), s('LEECH'), a('luck')], power: 'executioner',
        flavor: 'it names a victim before the blade agrees, and the blade always agrees' },
    ] },
  ember: {
    name: 'Emberlord\'s', color: '#ff7a2a', cls: 'mage',
    bonus: { 2: { SPELLPWR: 12, BOSSDMG: 10 }, 3: { CASTSPD: 14, CRITDMG: 20 }, 4: { SPELLPWR: 28, BOSSDMG: 24, MP: 120 } },
    power: { name: 'Conflagration', stats: { SPELLPWR: 14, BOSSDMG: 20, CRITDMG: 25 },
      desc: 'Your spells burn hotter — greater damage overall, and far more against the mightiest foes.' },
    pieces: [
      { id: 'emberWand', base: 'Wand', name: 'Cinderbrand', native: 'SPELLPWR',
        mods: [s('CRIT'), s('CRITDMG'), s('BOSSDMG'), s('PEN'), s('CASTSPD'), a('spirit')], power: 'spellbound',
        flavor: 'its ember tip glows a sullen red long after the last word of the spell is spoken' },
      { id: 'emberFocus', base: 'Focus', name: 'Emberheart', native: 'CRITDMG',
        mods: [s('CRIT'), s('MCR'), s('PEN'), s('MPLEECH'), s('MP'), a('luck')], power: 'savage',
        flavor: 'a single live coal caged in silver, banked in patience against the moment it is loosed' },
      { id: 'emberCirclet', base: 'Circlet', name: 'Ashcrown', native: 'CASTSPD',
        mods: [s('SPELLPWR'), s('CDR'), s('MP'), s('REGEN'), s('MPKILL'), a('vitality')], power: 'quickened',
        flavor: 'banked embers smoulder beneath a rime of grey ash, kindling every thought to flame' },
      { id: 'emberRobe', base: 'Robe', name: 'Smokeshroud', native: 'BOSSDMG',
        mods: [s('SPELLPWR'), s('MP'), s('CDR'), s('DODGE'), s('EXEC'), a('agility')], power: 'executioner',
        flavor: 'a mantle woven of smoke and settled ash that wraps the mightiest foe in a slow, devouring burn' },
    ] },
  frost: {
    name: 'Frostwarden\'s', color: '#6fc8e6', cls: 'mage',
    bonus: { 2: { SPELLPWR: 10, STUNPWR: 12 }, 3: { SPELLPWR: 22, CDR: 8, STUNPWR: 20 } },
    power: { name: 'Deep Freeze', stats: { STUNPWR: 25, SPELLPWR: 12, CDR: 8 },
      desc: 'Your magic chills to the bone — harder control and quicker spells.' },
    pieces: [
      { id: 'frostStaff', base: 'Staff', name: 'Fogbinder', native: 'SPELLPWR',
        mods: [s('STUNPWR'), s('PEN'), s('CRIT'), s('CRITDMG'), s('MP'), a('spirit')], power: 'concussive',
        flavor: 'a rime-crusted stave that breathes freezing fog, stealing the breath and the will from any foe who wanders near' },
      { id: 'frostCrown', base: 'Crown', name: 'Everfrost Coronet', native: 'STUNPWR',
        mods: [s('SPELLPWR'), s('CDR'), s('MP'), s('MCR'), s('CASTSPD'), a('vitality')], power: 'focused',
        flavor: 'a diadem hung with frost that never thaws, holding foes locked mid-motion at a single cold thought' },
      { id: 'frostLeggings', base: 'Leggings', name: 'Glacierstride', native: 'CDR',
        mods: [s('STUNPWR'), s('SPELLPWR'), s('SPD'), s('DODGE'), s('MP'), a('agility')], power: 'fleet',
        flavor: 'leggings sheathed in creeping ice that spreads underfoot with every stride, freezing the ground you leave behind' },
    ] },
  void: {
    name: 'Voidcaller\'s', color: '#9a5cff', cls: 'mage',
    bonus: { 2: { SPELLPWR: 12, MP: 60 }, 3: { MPLEECH: 10, CDR: 8 }, 5: { SPELLPWR: 28, MP: 160, CASTSPD: 16 } },
    power: { name: 'Oblivion', stats: { SPELLPWR: 16, MPLEECH: 12, CDR: 12 },
      desc: 'Draw power from the dark — spells recharge faster and feed you mana as they land.' },
    pieces: [
      { id: 'voidWand', base: 'Wand', name: 'Voidtongue', native: 'MPLEECH',
        mods: [s('SPELLPWR'), s('CASTSPD'), s('MP'), s('CDR'), s('PEN'), a('spirit')], power: 'siphoning',
        flavor: 'answers each casting in a voice only you can hear, and drinks a little to speak' },
      { id: 'voidTome', base: 'Tome', name: 'The Nullbound Codex', native: 'MP',
        mods: [s('MPLEECH'), s('CDR'), s('CASTSPD'), s('MCR'), s('CRITDMG'), a('luck')], power: 'spellbound',
        flavor: 'its cover was never any living thing, and the pages read you back' },
      { id: 'voidRobe', base: 'Robe', name: 'Duskdrinker', native: 'LEECH',
        mods: [s('SPELLPWR'), s('MP'), s('MPLEECH'), s('HP'), s('DR'), a('vitality')], power: 'vampiric',
        flavor: 'the glow dims wherever it hangs, and the wearer never feels the cold of it' },
      { id: 'voidLoop', base: 'Loop', name: 'Warmthief', native: 'REGEN',
        mods: [s('MP'), s('MPLEECH'), s('HPKILL'), s('HP'), s('CRIT'), a('vitality')], power: 'mending',
        flavor: 'always warm to the touch, though the warmth was never yours to keep' },
      { id: 'voidNecklace', base: 'Necklace', name: 'The Hollow Chord', native: 'CASTSPD',
        mods: [s('SPELLPWR'), s('MP'), s('MPLEECH'), s('CDR'), s('MCR'), a('spirit')], power: 'attuned',
        flavor: 'a note just past the edge of hearing, and the air around it never quite settles' },
    ] },
  bloodletter: {
    name: 'Bloodletter\'s', color: '#e0455f', cls: 'warrior',
    bonus: { 2: { BLEED: 14, ATK: 10 }, 3: { CRIT: 8, LEECH: 6 }, 4: { BLEED: 30, ATK: 26, CRITDMG: 24 } },
    power: { name: 'Exsanguinate', stats: { BLEED: 22, LEECH: 10, CRITDMG: 20 },
      desc: 'Your wounds bleed deeper and feed you as they open.' },
    pieces: [
      { id: 'bloodletterWarScythe', base: 'War Scythe', name: 'Redharvest', native: 'BLEED',
        mods: [s('CLEAVE'), s('CRIT'), s('CRITDMG'), s('PEN'), s('EXEC'), a('might')], power: 'rending',
        flavor: 'each long pass of the blade lays open a red furrow that will not close' },
      { id: 'bloodletterMail', base: 'Mail', name: 'Rustshroud', native: 'HP',
        mods: [s('DR'), s('THORNS'), s('TENAC'), s('REGEN'), s('HPKILL'), a('vitality')], power: 'bloodthirsty',
        flavor: 'iron gone the deep brown of old wounds, and thirsting for fresh ones' },
      { id: 'bloodletterGrips', base: 'Grips', name: 'Gorehold', native: 'LEECH',
        mods: [s('CRIT'), s('ATKSPD'), s('DBLSTRIKE'), s('PEN'), s('HPKILL'), a('agility')], power: 'vampiric',
        flavor: 'the leather still warm and slick from the last throat it closed on' },
      { id: 'bloodletterTalisman', base: 'Talisman', name: 'Neverscar', native: 'CRIT',
        mods: [s('CRITDMG'), s('BLEED'), s('LEECH'), s('EXEC'), s('BOSSDMG'), a('luck')], power: 'hemorrhage',
        flavor: 'carved from a hurt that has never once stopped weeping' },
    ] },
  venom: {
    name: 'Venomweaver\'s', color: '#9fd83a', cls: 'rogue',
    bonus: { 2: { BLEED: 12, SPD: 6 }, 3: { CRIT: 8, PEN: 10 }, 4: { BLEED: 26, SPD: 12, DBLSTRIKE: 12 } },
    power: { name: 'Serpent\'s Kiss', stats: { BLEED: 20, PEN: 15, DBLSTRIKE: 12 },
      desc: 'Every strike drips venom — bleeding, armor-piercing, and quick to repeat.' },
    pieces: [
      { id: 'venomKris', base: 'Kris', name: 'Coilfang', native: 'BLEED',
        mods: [s('PEN'), s('CRIT'), s('ATKSPD'), s('LEECH'), s('EXEC'), a('agility')], power: 'rending',
        flavor: 'a waved edge grooved so venom rides each cut deeper into the wound' },
      { id: 'venomHood', base: 'Hood', name: 'Hollowbreath', native: 'TENAC',
        mods: [s('DODGE'), s('ACC'), s('SPD'), s('DR'), s('DBLSTRIKE'), a('vitality')], power: 'evasive',
        flavor: 'drawing clean breath through the filter while poison hangs thick around it' },
      { id: 'venomBracers', base: 'Bracers', name: 'Addercuffs', native: 'DBLSTRIKE',
        mods: [s('PEN'), s('CRIT'), s('CRITDMG'), s('ATKSPD'), s('IDMG'), a('agility')], power: 'flurry',
        flavor: 'thin needles wake in the wrist to weep venom into every quick jab' },
      { id: 'venomBand', base: 'Band', name: 'Weepstone Coil', native: 'LEECH',
        mods: [s('PEN'), s('BLEED'), s('CRIT'), s('REGEN'), s('EXEC'), a('luck')], power: 'siphoning',
        flavor: 'a green stone that never stops weeping, its tears eating what they touch' },
    ] },
  sentinel: {
    name: 'Sentinel\'s', color: '#ffe6a0', cls: 'templar',
    bonus: { 2: { DEF: 12, HP: 44 }, 3: { BLOCK: 10, DR: 5 }, 5: { DEF: 34, HP: 150, TENAC: 18 } },
    power: { name: 'Sanctuary', stats: { DR: 8, BLOCK: 8, TENAC: 20 },
      desc: 'A holy ward blunts every blow and lets you shrug off stuns and slows.' },
    pieces: [
      { id: 'sentinelMace', base: 'Mace', name: 'Vesperbell', native: 'STUNPWR',
        mods: [s('ATK'), s('CRIT'), s('ACC'), s('HPKILL'), s('DR'), a('might')], power: 'concussive',
        flavor: 'each blow tolls like a cathedral bell and leaves the struck reeling' },
      { id: 'sentinelKiteShield', base: 'Kite Shield', name: 'Sigilward', native: 'DR',
        mods: [s('THORNS'), s('HP'), s('TENAC'), s('REGEN'), s('DODGE'), a('vitality')], power: 'warded',
        flavor: 'its graven sigil drinks the force of every spell hurled your way' },
      { id: 'sentinelCap', base: 'Cap', name: 'Dawnhallow', native: 'TENAC',
        mods: [s('HP'), s('REGEN'), s('BLOCK'), s('DODGE'), s('ACC'), a('spirit')], power: 'aegis',
        flavor: 'a halo of blessed light that no shadow can settle upon' },
      { id: 'sentinelChestplate', base: 'Chestplate', name: 'The Unbroken Vow', native: 'HP',
        mods: [s('DR'), s('BLOCK'), s('REGEN'), s('THORNS'), s('TENAC'), a('vitality')], power: 'stalwart',
        flavor: 'the oath cut into its steel refuses to let you fall' },
      { id: 'sentinelTassets', base: 'Tassets', name: 'The Held Line', native: 'BLOCK',
        mods: [s('DR'), s('HP'), s('THORNS'), s('TENAC'), s('REGEN'), a('might')], power: 'bulwark',
        flavor: 'planted and immovable, they turn a retreat into a standing wall' },
    ] },
  warlord: {
    name: 'Warlord\'s', color: '#d99a4a', cls: 'warrior',
    bonus: { 2: { BOSSDMG: 14, ATK: 10 }, 3: { IDMG: 12, PEN: 10 }, 4: { BOSSDMG: 30, ATK: 26, CRITDMG: 22 } },
    power: { name: 'Kingslayer', stats: { BOSSDMG: 30, IDMG: 14, PEN: 12 },
      desc: 'You fell the mighty — devastating damage to bosses and straight through armor.' },
    pieces: [
      { id: 'warlordGreatsword', base: 'Greatsword', name: 'Regicide', native: 'BOSSDMG',
        mods: [s('PEN'), s('EXEC'), s('CRITDMG'), s('CRIT'), s('ACC'), a('might')], power: 'giantsbane',
        flavor: 'forged in a usurper\'s fire to cut a king from his throne' },
      { id: 'warlordHelm', base: 'Helm', name: 'Vanquisher\'s Diadem', native: 'STUNPWR',
        mods: [s('BOSSDMG'), s('PEN'), s('ACC'), s('TENAC'), s('HP'), a('vitality')], power: 'concussive',
        flavor: 'a rival warlord\'s crown, dented and claimed as your own' },
      { id: 'warlordCuirass', base: 'Cuirass', name: 'Plate of the Unbeaten', native: 'DR',
        mods: [s('HP'), s('BOSSDMG'), s('THORNS'), s('TENAC'), s('BLOCK'), a('agility')], power: 'stalwart',
        flavor: 'scored by a hundred duels and cracked in none of them' },
      { id: 'warlordAmulet', base: 'Amulet', name: 'Chain of Broken Crowns', native: 'PEN',
        mods: [s('BOSSDMG'), s('EXEC'), s('CRIT'), s('CRITDMG'), s('HPKILL'), a('luck')], power: 'executioner',
        flavor: 'each link a shattered crown, strung to drag your enemies down' },
    ] },
  windrunner: {
    name: 'Windrunner\'s', color: '#5fded0', cls: 'rogue',
    bonus: { 2: { SPD: 8, DODGE: 8 }, 3: { SPD: 16, ACC: 12, ATKSPD: 14 } },
    power: { name: 'Tailwind', stats: { SPD: 12, DODGE: 10, ATKSPD: 14 },
      desc: 'The wind at your back — swifter, harder to pin down, and quick to loose.' },
    pieces: [
      { id: 'windrunnerShortbow', base: 'Shortbow', name: 'Zephyrsong', native: 'ATKSPD',
        mods: [s('CRIT'), s('ACC'), s('DBLSTRIKE'), s('SPD'), s('PEN'), a('agility')], power: 'deadeye',
        flavor: 'looses arrows faster than the string can settle, each one carried true on the wind' },
      { id: 'windrunnerCap', base: 'Cap', name: 'Slipstream Cowl', native: 'DODGE',
        mods: [s('SPD'), s('ACC'), s('TENAC'), s('CRITDMG'), s('ATKSPD'), a('luck')], power: 'evasive',
        flavor: 'the wind pours through it and takes your outline with it, so blows find only empty air' },
      { id: 'windrunnerCharm', base: 'Charm', name: 'Everquill', native: 'SPD',
        mods: [s('DODGE'), s('ATKSPD'), s('CRIT'), s('DBLSTRIKE'), s('ACC'), a('spirit')], power: 'fleet',
        flavor: 'a feather that never once touches down, and neither, quite, do you' },
    ] },
  marksman: {
    name: 'Marksman\'s', color: '#86c25a', cls: 'rogue',
    bonus: { 2: { ACC: 12, CRIT: 8 }, 3: { CRITDMG: 20, PEN: 10 }, 4: { ACC: 24, CRIT: 16, BOSSDMG: 18 } },
    power: { name: 'Dead Aim', stats: { ACC: 16, CRIT: 12, CRITDMG: 30 },
      desc: 'You rarely miss and never softly — every shot precise, critical, punishing.' },
    pieces: [
      { id: 'marksmanLongbow', base: 'Longbow', name: 'Skyreach', native: 'PEN',
        mods: [s('ACC'), s('CRIT'), s('CRITDMG'), s('BOSSDMG'), s('IDMG'), a('agility')], power: 'deadeye',
        flavor: 'drawn to the ear, it looses a shaft that clears the hills and finds whatever thought distance kept it safe' },
      { id: 'marksmanQuiver', base: 'Quiver', name: 'Truefletch', native: 'ACC',
        mods: [s('CRIT'), s('CRITDMG'), s('PEN'), s('DBLSTRIKE'), s('IDMG'), a('agility')], power: 'keen',
        flavor: 'reach in blind and every arrow you draw already knows the throat it means to find' },
      { id: 'marksmanBracers', base: 'Bracers', name: 'Steadyhand', native: 'CRIT',
        mods: [s('ACC'), s('CRITDMG'), s('PEN'), s('SPD'), s('DODGE'), a('might')], power: 'focused',
        flavor: 'laced tight about the wrist, it stills every tremor until the loose comes clean and certain' },
      { id: 'marksmanRing', base: 'Ring', name: 'Windreader', native: 'CRITDMG',
        mods: [s('ACC'), s('CRIT'), s('PEN'), s('SPD'), s('BOSSDMG'), a('luck')], power: 'fortunate',
        flavor: 'it reads the wind before you loose and spends that fortune on the one soft, killing inch' },
    ] },
  duelist: {
    name: 'Duelist\'s', color: '#a9c0e0', cls: 'rogue',
    bonus: { 2: { CRIT: 10, DODGE: 8 }, 3: { CRIT: 20, CRITDMG: 30, ATKSPD: 12 } },
    power: { name: 'Riposte', stats: { CRIT: 14, DODGE: 10, CRITDMG: 25 },
      desc: 'Parry, then punish — more crits, more evasion, and far harder counters.' },
    pieces: [
      { id: 'duelistRapier', base: 'Rapier', name: 'Seamfinder', native: 'PEN',
        mods: [s('CRIT'), s('CRITDMG'), s('ACC'), s('ATKSPD'), s('DBLSTRIKE'), a('agility')], power: 'duelist',
        flavor: 'a slender point that reads a guard and slips through the one gap it leaves' },
      { id: 'duelistParryingDagger', base: 'Parrying Dagger', name: 'The Answering Guard', native: 'DODGE',
        mods: [s('CRIT'), s('CRITDMG'), s('THORNS'), s('ACC'), s('TENAC'), a('agility')], power: 'evasive',
        flavor: 'catches the thrust on its teeth and sends the answer back down the same line' },
      { id: 'duelistBand', base: 'Band', name: 'The Duelist\'s Oath', native: 'CRIT',
        mods: [s('CRITDMG'), s('DODGE'), s('ACC'), s('ATKSPD'), s('PEN'), a('agility')], power: 'keen',
        flavor: 'worn on the sword-hand as a promise that every opening will be paid for' },
    ] },
  colossus: {
    name: 'Colossus\'', color: '#8aa0b8', cls: 'warrior',
    bonus: { 2: { HP: 60, DEF: 12 }, 3: { REGEN: 6, DR: 5 }, 5: { HP: 200, DEF: 36, TENAC: 20 } },
    power: { name: 'Unbreakable', stats: { DR: 10, THORNS: 10, TENAC: 18 },
      desc: 'You will not fall — every blow blunted, attackers wounded, control shrugged off.' },
    pieces: [
      { id: 'colossusMaul', base: 'Maul', name: 'Tremorfall', native: 'STUNPWR',
        mods: [s('ATK'), s('HP'), s('DR'), s('TENAC'), s('THORNS'), a('might')], power: 'concussive',
        flavor: 'one fall splits the flagstones and leaves the whole hall ringing' },
      { id: 'colossusBuckler', base: 'Buckler', name: 'The Unbroken', native: 'THORNS',
        mods: [s('HP'), s('DR'), s('TENAC'), s('REGEN'), s('DODGE'), a('vitality')], power: 'aegis',
        flavor: 'small enough to vanish behind a fist, yet no edge has ever bitten it' },
      { id: 'colossusHelm', base: 'Helm', name: 'Anvilcrown', native: 'TENAC',
        mods: [s('HP'), s('DR'), s('THORNS'), s('STUNPWR'), s('REGEN'), a('vitality')], power: 'ironhide',
        flavor: 'heavy as the anvil it was hammered upon, and just as unwilling to move' },
      { id: 'colossusMail', base: 'Mail', name: 'Everlink', native: 'HP',
        mods: [s('DR'), s('THORNS'), s('TENAC'), s('REGEN'), s('HPKILL'), a('vitality')], power: 'warded',
        flavor: 'its makers are dust and their names long forgotten, yet not one link has parted' },
      { id: 'colossusGreaves', base: 'Greaves', name: 'Mountainroot', native: 'DR',
        mods: [s('HP'), s('THORNS'), s('TENAC'), s('REGEN'), s('BLOCK'), a('vitality')], power: 'stalwart',
        flavor: 'plant your stance and the earth claims you, and nothing short of the mountain will shift you' },
    ] },
  grove: {
    name: 'Grovekeeper\'s', color: '#6fd08a', cls: 'templar',
    bonus: { 2: { HP: 50, REGEN: 5 }, 3: { TENAC: 16, DR: 5 }, 4: { HP: 150, SPELLPWR: 16, TENAC: 24 } },
    power: { name: 'Renewal', stats: { DR: 8, TENAC: 20, THORNS: 8 },
      desc: 'The grove shelters its own — tougher, unshakable, and thorned against those who strike.' },
    pieces: [
      { id: 'groveHalberd', base: 'Halberd', name: 'Thornhaft', native: 'LEECH',
        mods: [s('ATK'), s('CLEAVE'), s('BLEED'), s('PEN'), s('THORNS'), a('might')], power: 'vampiric',
        flavor: 'the haft still buds where you grip it, and each cut it opens feeds the roots that forged it' },
      { id: 'groveCirclet', base: 'Circlet', name: 'Wildwood Coronet', native: 'REGEN',
        mods: [s('MP'), s('HP'), s('TENAC'), s('CDR'), s('MCR'), a('spirit')], power: 'mending',
        flavor: 'a wreath of living green that closes every scrape faster than it can open' },
      { id: 'groveRobe', base: 'Robe', name: 'Rootweave', native: 'SPELLPWR',
        mods: [s('MP'), s('MPLEECH'), s('REGEN'), s('DR'), s('TENAC'), a('vitality')], power: 'attuned',
        flavor: 'its threads sink quiet roots into the ground and draw the living magic up through the weave' },
      { id: 'grovePendant', base: 'Pendant', name: 'Everseed Locket', native: 'HP',
        mods: [s('REGEN'), s('TENAC'), s('HPKILL'), s('MPKILL'), s('BLOCK'), a('luck')], power: 'stalwart',
        flavor: 'a seed that swells with every heartbeat, and its bearer never stops swelling with it' },
    ] },
  prospector: {
    name: 'Prospector\'s', color: '#ffc24b', cls: 'any',
    bonus: { 2: { GOLDFIND: 30, MAGICFIND: 20, XPGAIN: 15 } },
    power: { name: 'Golden Windfall', stats: { GOLDFIND: 40, MAGICFIND: 25, MATFIND: 25 },
      desc: 'Foes spill more gold, drop rarer loot, and yield richer crafting materials.' },
    pieces: [
      { id: 'prospectorLoop', base: 'Loop', name: 'Glimmerfinder', native: 'MAGICFIND',
        mods: [s('GOLDFIND'), s('XPGAIN'), s('MP'), s('CRIT'), s('CDR'), a('luck')], power: 'fortunate',
        flavor: 'the faintest gleam in a lightless vault never slips past its eye' },
      { id: 'prospectorCharm', base: 'Charm', name: 'Luckpenny', native: 'GOLDFIND',
        mods: [s('MAGICFIND'), s('MATFIND'), s('XPGAIN'), s('CRIT'), s('ACC'), a('luck')], power: 'greedy',
        flavor: 'a hundred hauls have worn it smooth, and not once has the hand it guards come home empty' },
    ] },
  nightmare: {
    name: 'Nightmare\'s', color: '#b0304f', cls: 'any',
    bonus: { 2: { LEECH: 8, ATK: 10 }, 3: { HPKILL: 10, CRIT: 8 }, 4: { LEECH: 16, ATK: 26, CRITDMG: 24 } },
    power: { name: 'Bloodthirst', stats: { LEECH: 14, CRITDMG: 20, EXEC: 10 },
      desc: 'You feed on the fallen — heal from every blow you land and finish the weak.' },
    pieces: [
      { id: 'nightmareClaymore', base: 'Claymore', name: 'Sanguine Verdict', native: 'LEECH',
        mods: [s('EXEC'), s('CRITDMG'), s('PEN'), s('BLEED'), s('CRIT'), a('might')], power: 'vampiric',
        flavor: 'it opens a throat and drinks the answer before the wound can close' },
      { id: 'nightmareHelm', base: 'Helm', name: 'The Sleepless Vigil', native: 'CRIT',
        mods: [s('CRITDMG'), s('ACC'), s('LEECH'), s('EXEC'), s('DODGE'), a('luck')], power: 'deadeye',
        flavor: 'the eyes worked into its brow never close, and they hunger for the weak' },
      { id: 'nightmareTunic', base: 'Tunic', name: 'The Fevered Shroud', native: 'REGEN',
        mods: [s('HP'), s('LEECH'), s('HPKILL'), s('DR'), s('TENAC'), a('vitality')], power: 'mending',
        flavor: 'always faintly warm, as if it still remembers the blood it drank' },
      { id: 'nightmarePendant', base: 'Pendant', name: 'Dreadpulse', native: 'HPKILL',
        mods: [s('LEECH'), s('EXEC'), s('CRITDMG'), s('MPKILL'), s('HP'), a('spirit')], power: 'siphoning',
        flavor: 'a slow red heartbeat you feel through the chain, keeping time with every kill' },
    ] },
  thunderer: {
    name: 'Thunderer\'s', color: '#f2d23a', cls: 'templar',
    bonus: { 2: { STUNPWR: 16, ATK: 10 }, 3: { STUNPWR: 30, DR: 6, CRITDMG: 20 } },
    power: { name: 'Thunderclap', stats: { STUNPWR: 28, IDMG: 14, THORNS: 8 },
      desc: 'Your blows crash like thunder — harder-hitting, stunning, and shocking those who strike you.' },
    pieces: [
      { id: 'thundererMorningstar', base: 'Morningstar', name: 'Thunderhead', native: 'STUNPWR',
        mods: [s('CRIT'), s('CRITDMG'), s('IDMG'), s('PEN'), s('ACC'), a('might')], power: 'concussive',
        flavor: 'each swing pulls the sky down and lands it as one crushing bolt' },
      { id: 'thundererTowerShield', base: 'Tower Shield', name: 'Stormwall', native: 'THORNS',
        mods: [s('DR'), s('HP'), s('STUNPWR'), s('TENAC'), s('REGEN'), a('vitality')], power: 'thornmail',
        flavor: 'answers every blow with a rolling crack that staggers the striker' },
      { id: 'thundererTalisman', base: 'Talisman', name: 'Stormsong', native: 'DBLSTRIKE',
        mods: [s('CRIT'), s('CRITDMG'), s('IDMG'), s('STUNPWR'), s('BOSSDMG'), a('spirit')], power: 'arcing',
        flavor: 'a low idol-hum that swells until the first bolt splits the air' },
    ] },
  trickster: {
    name: 'Trickster\'s', color: '#d07ad0', cls: 'rogue',
    bonus: { 2: { CRIT: 10, MAGICFIND: 20, GOLDFIND: 20 } },
    power: { name: 'Wild Fortune', stats: { CRIT: 12, MAGICFIND: 25, GOLDFIND: 25 },
      desc: 'Luck rides at your shoulder — sharper crits and a richer haul from every foe.' },
    pieces: [
      { id: 'tricksterBand', base: 'Band', name: 'The Fickle Facet', native: 'DODGE',
        mods: [s('CRIT'), s('SPD'), s('DBLSTRIKE'), s('GOLDFIND'), s('MAGICFIND'), a('agility')], power: 'evasive',
        flavor: 'the stone never shows the same face twice, and neither do you to whoever tries to land a blow' },
      { id: 'tricksterAmulet', base: 'Amulet', name: 'The Weighted Wager', native: 'CRIT',
        mods: [s('CRITDMG'), s('EXEC'), s('GOLDFIND'), s('MAGICFIND'), s('LEECH'), a('luck')], power: 'fortunate',
        flavor: 'a pair of dice loaded to land the killing pip and shake a richer haul from every fallen foe' },
    ] },
};

// Stamp `slot` onto every piece from its base and freeze — pure, immutable data.
export const ITEM_SETS = {};
for (const sid of Object.keys(RAW_SETS)) {
  const set = RAW_SETS[sid];
  const pieces = set.pieces.map(p => Object.freeze({ ...p, slot: BASE_SLOT[p.base] }));
  ITEM_SETS[sid] = Object.freeze({ ...set, pieces });
}
