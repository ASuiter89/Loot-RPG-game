// ── HAND-CRAFTED UNIQUES ─────────────────────────────────────────────────────
// The one-of-a-kind, NAMED artifact for every gear type in the game — one unique
// per weapon sub-type, off-hand, armour slot base and jewelry base (58 in all).
//
// Unlike every other rarity (which rolls random affixes), a unique is FIXED: it
// always carries the same `native` signature stat and the same six `mods`, plus a
// hand-picked SET of 2–3 signature `powers` (each a "legendary modifier" like
// Vampiric) — where an ordinary legendary rolls a single one. Only the numeric
// VALUES vary — they roll scaled to the depth the piece drops on, once, then lock
// (see buildUnique + isFixedItem in src/legacy/game.js). Pure data — no logic here.
//
// Each entry:
//   id      stable key, saved on the item (item.unique) — never reused
//   base    the exact gear base this is the unique version of (must match a SLOTS name)
//   slot    that base's equipment slot
//   name    the artifact's proper name (unique across the set)
//   cls     the class/archetype it's built for ('warrior'|'rogue'|'mage'|'templar'|'any')
//   native  its signature stat — baked in & protected, may be unusual for the type.
//           Never the slot's auto headline (DMG for weapons, DEF/ATK for armour, the
//           family headline for off-hands); for jewelry the native IS the headline.
//   mods    EXACTLY six modifiers: five stats + one attribute, all distinct and none
//           equal to the native or a headline. Their values scale with depth on drop.
//   powers  2–3 distinct signature power keys (see ITEM_POWERS in src/legacy/game.js);
//           the FIRST is the primary/signature power, mirrored onto a derived `power`
//           field for back-compat. Caster items only carry caster-lane powers
//           (never Warmage/Frenzied); martial items never carry Spellbound/Quickened.
//   flavor  one original line of flavour text
//
// Caster gear (Staff/Wand, Tome/Focus, Crown/Circlet, Robe, Gloves, Leggings, Loop,
// Necklace) uses SPELLPWR/CASTSPD and never SKILLPWR/ATKSPD; martial gear the reverse.

// A stat modifier.
const s = (key) => ({ kind: 'stat', key });
// An attribute modifier.
const a = (key) => ({ kind: 'attr', key });

// Which slot each base belongs to (mirrors SLOTS in src/legacy/game.js). Used to
// stamp `slot` onto every definition so lookups never re-derive it.
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

// The raw definitions (slot is stamped on below, so it's never out of sync).
const DEFS = [
  // ── SWORDS ──
  { id: 'sixteenCuts', base: 'Shortsword', name: 'Sixteen Cuts', cls: 'rogue', native: 'DBLSTRIKE',
    mods: [s('ATKSPD'), s('LEECH'), s('ACC'), s('DODGE'), s('BLEED'), a('agility')], powers: ['duelist', 'flurry', 'hemorrhage'],
    flavor: 'answers each heartbeat with a fresh wound before the last has closed' },
  { id: 'theEvenHand', base: 'Arming Sword', name: 'The Even Hand', cls: 'templar', native: 'DR',
    mods: [s('ATK'), s('CRIT'), s('HP'), s('CDR'), s('ACC'), a('might')], powers: ['warlord', 'tenacious', 'deadeye'],
    flavor: 'weighs itself against every foe and is found the equal of each' },
  { id: 'theLastCourtesy', base: 'Rapier', name: 'The Last Courtesy', cls: 'rogue', native: 'PEN',
    mods: [s('CRIT'), s('CRITDMG'), s('ACC'), s('DODGE'), s('ATKSPD'), a('agility')], powers: ['executioner', 'rending', 'keen'],
    flavor: 'slips past the guard and ends the matter with a single, courteous thrust' },
  { id: 'titanfell', base: 'Greatsword', name: 'Titanfell', cls: 'warrior', native: 'CLEAVE',
    mods: [s('ATK'), s('IDMG'), s('HP'), s('PEN'), s('CDR'), a('might')], powers: ['giantsbane', 'cleaving', 'brutal'],
    flavor: 'sweeps through the common rank and topples the towering alike' },
  { id: 'crescentfall', base: 'Claymore', name: 'Crescentfall', cls: 'warrior', native: 'LEECH',
    mods: [s('CRITDMG'), s('EXEC'), s('CRIT'), s('ATK'), s('HPKILL'), a('might')], powers: ['reckless', 'bloodthirsty', 'executioner'],
    flavor: 'carves a red crescent through the air and drinks whatever it opens' },
  // ── AXES ──
  { id: 'twinbite', base: 'Hatchet', name: 'Twinbite', cls: 'warrior', native: 'DBLSTRIKE',
    mods: [s('ATKSPD'), s('CRIT'), s('CRITDMG'), s('ACC'), s('DODGE'), a('agility')], powers: ['vampiric', 'flurry', 'savage'],
    flavor: 'twin heads drink deep before the first wound is even felt' },
  { id: 'bloodmarch', base: 'War Axe', name: 'Bloodmarch', cls: 'warrior', native: 'HPKILL',
    mods: [s('CLEAVE'), s('ATK'), s('BLEED'), s('DR'), s('THORNS'), a('might')], powers: ['brutal', 'cleaving', 'hemorrhage'],
    flavor: 'the ranks break, and the fallen feed the next swing' },
  { id: 'worldrender', base: 'Greataxe', name: 'Worldrender', cls: 'warrior', native: 'CLEAVE',
    mods: [s('BOSSDMG'), s('CRITDMG'), s('PEN'), s('STUNPWR'), s('CDR'), a('might')], powers: ['reckless', 'giantsbane', 'cleaving'],
    flavor: 'one swing to level a battle line, the next to fell a king' },
  { id: 'gallowsedge', base: 'Battleaxe', name: 'Gallowsedge', cls: 'warrior', native: 'EXEC',
    mods: [s('CRIT'), s('ACC'), s('ATK'), s('SKILLPWR'), s('HP'), a('luck')], powers: ['savage', 'executioner', 'brutal'],
    flavor: 'the wounded do not rise; the edge sees to that' },
  // ── DAGGERS ──
  { id: 'flickerfang', base: 'Dagger', name: 'Flickerfang', cls: 'rogue', native: 'DBLSTRIKE',
    mods: [s('CRIT'), s('CRITDMG'), s('ATKSPD'), s('SKILLPWR'), s('LEECH'), a('agility')], powers: ['arcing', 'flurry', 'keen'],
    flavor: 'home and gone before the flinch, leaving a dozen cuts where the eye caught one' },
  { id: 'coldwhisper', base: 'Stiletto', name: 'Coldwhisper', cls: 'rogue', native: 'PEN',
    mods: [s('CRIT'), s('CRITDMG'), s('ACC'), s('DODGE'), s('SPD'), a('agility')], powers: ['executioner', 'deadeye', 'fleet'],
    flavor: 'slips between the plates to find the small warm space a heartbeat used to fill' },
  { id: 'sanguemourn', base: 'Kris', name: 'Sanguemourn', cls: 'mage', native: 'MP',
    mods: [s('LEECH'), s('BLEED'), s('MPKILL'), s('HPKILL'), s('MCR'), a('spirit')], powers: ['siphoning', 'vampiric', 'hemorrhage'],
    flavor: 'each wound it opens is an offering, and the spilled warmth answers as power in your veins' },
  // ── MACES ──
  { id: 'vesperToll', base: 'Mace', name: 'Vesper, Toll of the Faithful', cls: 'templar', native: 'REGEN',
    mods: [a('vitality'), s('DEF'), s('DR'), s('HP'), s('STUNPWR'), s('SKILLPWR')], powers: ['bulwark', 'stalwart', 'mending'],
    flavor: 'cast from a chapel bell that still tolls for every soul it lays to rest' },
  { id: 'sanguineCrown', base: 'Morningstar', name: 'The Deposer', cls: 'warrior', native: 'BOSSDMG',
    mods: [a('might'), s('PEN'), s('IDMG'), s('CRITDMG'), s('DBLSTRIKE'), s('LEECH')], powers: ['executioner', 'giantsbane', 'vampiric'],
    flavor: 'a head of spikes for the slayers of kings, drinking deep from every champion it fells' },
  { id: 'cataclast', base: 'Maul', name: 'Cataclast', cls: 'warrior', native: 'CLEAVE',
    mods: [a('might'), s('ATK'), s('IDMG'), s('HP'), s('TENAC'), s('SKILLPWR')], powers: ['concussive', 'cleaving', 'brutal'],
    flavor: 'one fall splits the earth and leaves a whole warband reeling in the dust' },
  // ── SPEARS ──
  { id: 'dawnwardVigil', base: 'Spear', name: 'Dawnward, the Endless Vigil', cls: 'templar', native: 'DR',
    mods: [s('ATK'), s('ACC'), s('CRIT'), s('BLOCK'), s('SKILLPWR'), a('vitality')], powers: ['arcing', 'warded', 'bulwark'],
    flavor: 'kept level through a thousand sleepless watches, its point forever turned toward the dark' },
  { id: 'grimtollTithe', base: 'Halberd', name: 'Grimtoll, the Reaping Tithe', cls: 'warrior', native: 'EXEC',
    mods: [s('ATK'), s('IDMG'), s('CRITDMG'), s('BLEED'), s('ATKSPD'), a('might')], powers: ['cleaving', 'executioner', 'hemorrhage'],
    flavor: 'one long arc, and a whole front rank folds into the mud behind it' },
  { id: 'wyrmreach', base: 'Pike', name: 'Wyrmreach, the Skypiercer', cls: 'warrior', native: 'PEN',
    mods: [s('ATK'), s('ACC'), s('CRIT'), s('CRITDMG'), s('SKILLPWR'), a('agility')], powers: ['giantsbane', 'rending', 'deadeye'],
    flavor: 'long enough to reach a beast\'s heart the instant before its jaws can close' },
  // ── STAVES & WANDS (caster) ──
  { id: 'raveningFont', base: 'Staff', name: 'The Ravening Font', cls: 'mage', native: 'MP',
    mods: [s('SPELLPWR'), s('MPLEECH'), s('CASTSPD'), s('REGEN'), s('CDR'), a('spirit')], powers: ['vampiric', 'spellbound', 'siphoning'],
    flavor: 'a bottomless wellspring that drinks blood and magic alike, and is never once sated' },
  { id: 'astralNeedle', base: 'Wand', name: 'The Astral Needle', cls: 'mage', native: 'CRITDMG',
    mods: [s('SPELLPWR'), s('CRIT'), s('CASTSPD'), s('MP'), s('MAGICPEN'), a('luck')], powers: ['arcing', 'spellbound', 'savage'],
    flavor: 'a splinter of dying starlight, so keen it finds the seam in any ward' },
  // ── BOWS & SCYTHES ──
  { id: 'stormfletch', base: 'Shortbow', name: 'Stormfletch', cls: 'rogue', native: 'ATKSPD',
    mods: [s('DBLSTRIKE'), s('CRIT'), s('ACC'), s('SPD'), s('DODGE'), a('agility')], powers: ['flurry', 'frenzied', 'keen'],
    flavor: 'looses a squall of arrows faster than the eye can follow, each barb chasing the last throat' },
  { id: 'horizonfall', base: 'Longbow', name: 'Horizonfall', cls: 'rogue', native: 'BOSSDMG',
    mods: [s('CRITDMG'), s('CRIT'), s('PEN'), s('EXEC'), s('IDMG'), a('agility')], powers: ['deadeye', 'giantsbane', 'executioner'],
    flavor: 'its aimed shot leaves at first light and finds the throat it was promised, however far the beast flees' },
  { id: 'reaptide', base: 'Scythe', name: 'Reaptide', cls: 'warrior', native: 'EXEC',
    mods: [s('LEECH'), s('HPKILL'), s('CRIT'), s('PEN'), s('IDMG'), a('might')], powers: ['reckless', 'executioner', 'bloodthirsty'],
    flavor: 'swung wide and heedless of your own guard, it presses the dying like grain into your veins' },
  { id: 'ranksunder', base: 'War Scythe', name: 'Ranksunder', cls: 'warrior', native: 'CLEAVE',
    mods: [s('LEECH'), s('HPKILL'), s('ATK'), s('SKILLPWR'), s('TENAC'), a('vitality')], powers: ['warlord', 'cleaving', 'bloodthirsty'],
    flavor: 'one long sweep fells an entire rank, and every man who falls only feeds the advance' },

  // ── OFF-HANDS ──
  { id: 'quickguard', base: 'Buckler', name: 'Quickguard', cls: 'templar', native: 'THORNS',
    mods: [s('DR'), s('HP'), s('DODGE'), s('TENAC'), s('REGEN'), a('vitality')], powers: ['evasive', 'thornmail', 'warded'],
    flavor: 'small enough to catch a blade and turn it back down the arm that swung it' },
  { id: 'oathkeeper', base: 'Kite Shield', name: 'Oathkeeper', cls: 'templar', native: 'HP',
    mods: [s('DR'), s('THORNS'), s('TENAC'), s('REGEN'), s('SKILLPWR'), a('vitality')], powers: ['aegis', 'tenacious', 'thornmail'],
    flavor: 'a knight\'s shield that gives ground to no one and answers each blow in kind' },
  { id: 'mountainhold', base: 'Tower Shield', name: 'Mountainhold', cls: 'templar', native: 'DR',
    mods: [s('HP'), s('THORNS'), s('TENAC'), s('STUNPWR'), s('HPKILL'), a('vitality')], powers: ['ironhide', 'warded', 'tenacious'],
    flavor: 'planted once, it does not move, and the tide breaks upon it' },
  { id: 'cinderCodex', base: 'Tome', name: 'The Cinder Codex', cls: 'mage', native: 'IDMG',
    mods: [s('CRIT'), s('CDR'), s('MP'), s('MPLEECH'), s('BOSSDMG'), a('spirit')], powers: ['spellbound', 'brutal', 'hasty'],
    flavor: 'every page is a sentence of fire, and it is a very long book' },
  { id: 'theStillEye', base: 'Focus', name: 'The Still Eye', cls: 'mage', native: 'CASTSPD',
    mods: [s('CDR'), s('MCR'), s('MP'), s('MPLEECH'), s('REGEN'), a('spirit')], powers: ['siphoning', 'quickened', 'focused'],
    flavor: 'at the storm\'s centre, where every spell comes quick and costs almost nothing' },
  { id: 'neverspent', base: 'Quiver', name: 'Neverspent', cls: 'rogue', native: 'DBLSTRIKE',
    mods: [s('ATKSPD'), s('CRIT'), s('ACC'), s('PEN'), s('IDMG'), a('agility')], powers: ['flurry', 'frenzied', 'deadeye'],
    flavor: 'reach for the last arrow and find, always, one more' },
  { id: 'theContrary', base: 'Parrying Dagger', name: 'The Contrary', cls: 'rogue', native: 'DODGE',
    mods: [s('CRIT'), s('CRITDMG'), s('ACC'), s('DBLSTRIKE'), s('PEN'), a('agility')], powers: ['duelist', 'evasive', 'keen'],
    flavor: 'it does its finest work catching what the main hand invites' },

  // ── HEAD ──
  { id: 'ironbrow', base: 'Helm', name: 'Ironbrow', cls: 'warrior', native: 'DR',
    mods: [s('HP'), s('TENAC'), s('THORNS'), s('REGEN'), s('BLOCK'), a('vitality')], powers: ['stalwart', 'warded', 'tenacious'],
    flavor: 'the last thing many a blow ever meets, and it does not yield' },
  { id: 'findersCap', base: 'Cap', name: 'Finder\'s Cap', cls: 'any', native: 'MAGICFIND',
    mods: [s('GOLDFIND'), s('XPGAIN'), s('MATFIND'), s('CRIT'), s('SPD'), a('luck')], powers: ['fortunate', 'prospector', 'scholar'],
    flavor: 'worn by someone who always seemed to leave a room richer than they entered it' },
  { id: 'sunlitDiadem', base: 'Crown', name: 'The Sunlit Diadem', cls: 'mage', native: 'SPELLPWR',
    mods: [s('MP'), s('CDR'), s('CASTSPD'), s('CRITDMG'), s('MCR'), a('spirit')], powers: ['attuned', 'spellbound', 'quickened'],
    flavor: 'kings knelt to the mind that wore it, and so did the storm' },
  { id: 'nightface', base: 'Hood', name: 'Nightface', cls: 'rogue', native: 'DODGE',
    mods: [s('CRIT'), s('CRITDMG'), s('SPD'), s('ACC'), s('PEN'), a('agility')], powers: ['keen', 'evasive', 'deadeye'],
    flavor: 'the dark keeps its own, and shows them where to strike' },
  { id: 'theClearMind', base: 'Circlet', name: 'The Clear Mind', cls: 'mage', native: 'CDR',
    mods: [s('CASTSPD'), s('MCR'), s('MP'), s('MPLEECH'), s('CRITDMG'), a('spirit')], powers: ['focused', 'hasty', 'quickened'],
    flavor: 'thought runs quick and clean beneath it, and the words come cheap' },

  // ── CHEST ──
  { id: 'bastionPlate', base: 'Chestplate', name: 'Bastion', cls: 'warrior', native: 'HP',
    mods: [s('DR'), s('TENAC'), s('THORNS'), s('REGEN'), s('HPKILL'), a('vitality')], powers: ['warded', 'stalwart', 'tenacious'],
    flavor: 'dented by a hundred killing blows, pierced by none' },
  { id: 'bramblecoat', base: 'Cuirass', name: 'The Bramblecoat', cls: 'warrior', native: 'THORNS',
    mods: [s('IDMG'), s('HP'), s('DR'), s('TENAC'), s('STUNPWR'), a('might')], powers: ['aegis', 'thornmail', 'brutal'],
    flavor: 'reach for the one inside and the coat reaches back' },
  { id: 'juggernautMail', base: 'Mail', name: 'Juggernaut', cls: 'warrior', native: 'TENAC',
    mods: [s('HP'), s('DR'), s('IDMG'), s('HPKILL'), s('STUNPWR'), a('might')], powers: ['brutal', 'tenacious', 'ironhide'],
    flavor: 'stun, freeze, or fear — it has felt them all and kept walking' },
  { id: 'ghostleather', base: 'Tunic', name: 'Ghostleather', cls: 'rogue', native: 'DODGE',
    mods: [s('SPD'), s('HP'), s('REGEN'), s('CRIT'), s('ACC'), a('agility')], powers: ['fleet', 'evasive', 'keen'],
    flavor: 'the blow lands where you were, never where you are' },
  { id: 'tidefoldMantle', base: 'Robe', name: 'The Tidefold Mantle', cls: 'mage', native: 'MP',
    mods: [s('SPELLPWR'), s('CDR'), s('CASTSPD'), s('MCR'), s('REGEN'), a('spirit')], powers: ['spellbound', 'attuned', 'quickened'],
    flavor: 'a bottomless well of power stitched into cloth, and the hem is never dry' },

  // ── HANDS ──
  { id: 'crushgrip', base: 'Gauntlets', name: 'Crushgrip', cls: 'warrior', native: 'STUNPWR',
    mods: [s('IDMG'), s('HP'), s('BLOCK'), s('CRIT'), s('PEN'), a('might')], powers: ['brutish', 'concussive', 'bulwark'],
    flavor: 'it closes once, and whatever it holds is done arguing' },
  { id: 'thirstingCuffs', base: 'Bracers', name: 'The Thirsting Cuffs', cls: 'any', native: 'LEECH',
    mods: [s('HP'), s('HPKILL'), s('IDMG'), s('CRIT'), s('DR'), a('vitality')], powers: ['mending', 'bloodthirsty', 'vampiric'],
    flavor: 'they take a little from everything you strike and give it quietly back' },
  { id: 'hairtrigger', base: 'Grips', name: 'Hairtrigger', cls: 'rogue', native: 'CRITDMG',
    mods: [s('CRIT'), s('DBLSTRIKE'), s('ACC'), s('PEN'), s('SKILLPWR'), a('agility')], powers: ['keen', 'savage', 'flurry'],
    flavor: 'steady where it counts, and it always counts' },
  { id: 'spellweaversGloves', base: 'Gloves', name: 'The Weaver\'s Ten', cls: 'mage', native: 'CDR',
    mods: [s('CASTSPD'), s('MCR'), s('SPELLPWR'), s('MP'), s('CRITDMG'), a('spirit')], powers: ['quickened', 'hasty', 'spellbound'],
    flavor: 'ten fingers that finish a spell before the mouth has spoken it' },

  // ── LEGS ──
  { id: 'rootstride', base: 'Greaves', name: 'Rootstride', cls: 'templar', native: 'REGEN',
    mods: [s('HP'), s('DR'), s('TENAC'), s('HPKILL'), s('BLOCK'), a('vitality')], powers: ['tenacious', 'mending', 'warded'],
    flavor: 'planted with every step, and nothing short of the earth itself will move them' },
  { id: 'victorsWeight', base: 'Tassets', name: 'The Victor\'s Weight', cls: 'warrior', native: 'HPKILL',
    mods: [s('IDMG'), s('HP'), s('MPKILL'), s('CRIT'), s('ATK'), a('might')], powers: ['warlord', 'brutish', 'stalwart'],
    flavor: 'each kill leaves it a little heavier with borrowed strength' },
  { id: 'windstep', base: 'Trousers', name: 'Windstep', cls: 'rogue', native: 'SPD',
    mods: [s('DODGE'), s('HP'), s('REGEN'), s('CRIT'), s('DBLSTRIKE'), a('agility')], powers: ['evasive', 'fleet', 'deadeye'],
    flavor: 'the ground barely knows you passed, and neither does the blade' },
  { id: 'deepwellLeggings', base: 'Leggings', name: 'The Deepwell Weave', cls: 'mage', native: 'MP',
    mods: [s('SPELLPWR'), s('CDR'), s('CASTSPD'), s('REGEN'), s('MPKILL'), a('spirit')], powers: ['attuned', 'spellbound', 'focused'],
    flavor: 'the reserve runs deeper than the cloth has any right to hold' },

  // ── RINGS (native is the headline) ──
  { id: 'gildedSeal', base: 'Signet', name: 'The Gilded Seal', cls: 'any', native: 'GOLDFIND',
    mods: [s('MAGICFIND'), s('XPGAIN'), s('IDMG'), s('ATK'), s('HP'), a('might')], powers: ['greedy', 'prospector', 'fortunate'],
    flavor: 'every ring it stamps pays out, one way or another' },
  { id: 'lifebinderBand', base: 'Band', name: 'Lifebinder', cls: 'any', native: 'HP',
    mods: [s('REGEN'), s('DR'), s('TENAC'), s('HPKILL'), s('IDMG'), a('vitality')], powers: ['mending', 'stalwart', 'tenacious'],
    flavor: 'wear it long enough and you forget what it is to tire' },
  { id: 'aetherLoop', base: 'Loop', name: 'The Aether Loop', cls: 'mage', native: 'SPELLPWR',
    mods: [s('MP'), s('CDR'), s('CASTSPD'), s('MCR'), s('CRITDMG'), a('spirit')], powers: ['spellbound', 'attuned', 'hasty'],
    flavor: 'a small circle for a very large amount of the sky' },
  { id: 'foolsFortune', base: 'Ring', name: 'Fool\'s Fortune', cls: 'any', native: 'CRIT',
    mods: [s('CRITDMG'), s('MAGICFIND'), s('GOLDFIND'), s('ACC'), s('IDMG'), a('luck')], powers: ['fortunate', 'keen', 'savage'],
    flavor: 'it favours the bold and the doomed alike, and rarely says which you are' },

  // ── AMULETS (native is the headline) ──
  { id: 'archmagesNecklace', base: 'Necklace', name: 'The Sevenfold Chain', cls: 'mage', native: 'SPELLPWR',
    mods: [s('CRIT'), s('MP'), s('CDR'), s('CASTSPD'), s('CRITDMG'), a('spirit')], powers: ['savage', 'spellbound', 'focused'],
    flavor: 'seven links for seven schools, and it has mastered them all' },
  { id: 'heartstone', base: 'Pendant', name: 'Heartstone', cls: 'any', native: 'DR',
    mods: [s('HP'), s('REGEN'), s('HPKILL'), s('THORNS'), s('TENAC'), a('vitality')], powers: ['stalwart', 'mending', 'warded'],
    flavor: 'it keeps a rhythm of its own, and lends it to you when yours falters' },
  { id: 'magpiesEye', base: 'Talisman', name: 'The Magpie\'s Eye', cls: 'any', native: 'MAGICFIND',
    mods: [s('GOLDFIND'), s('XPGAIN'), s('MATFIND'), s('CRIT'), s('HP'), a('luck')], powers: ['salvager', 'fortunate', 'prospector'],
    flavor: 'it wants for you what it wanted for itself, and it always got its shine' },
  { id: 'conquerorsChain', base: 'Amulet', name: 'The Conqueror\'s Chain', cls: 'any', native: 'IDMG',
    mods: [s('ATK'), s('CRIT'), s('HP'), s('PEN'), s('SKILLPWR'), a('might')], powers: ['brutish', 'brutal', 'warmage'],
    flavor: 'worn by those who took what they wanted and wore it home' },
  { id: 'quickpulse', base: 'Charm', name: 'The Quickpulse', cls: 'rogue', native: 'REGEN',
    mods: [s('SPD'), s('DODGE'), s('CRIT'), s('HPKILL'), s('ACC'), a('agility')], powers: ['fleet', 'mending', 'evasive'],
    flavor: 'wounds close and feet fly, as if the body were in a hurry to be done' },
];

// Stamp the slot onto every definition, mirror the primary power onto a derived
// `power` field (back-compat with the single-power consumers), and freeze — pure,
// immutable data.
export const UNIQUES = DEFS.map(d => Object.freeze({ ...d, slot: BASE_SLOT[d.base], power: d.powers[0] }));

const BY_ID = {};
const BY_BASE = {};
for (const u of UNIQUES) { BY_ID[u.id] = u; BY_BASE[u.base] = u; }

// The unique with this stable id, or null.
export function uniqueById(id) { return BY_ID[id] || null; }
// The unique that is the one-of-a-kind version of a given gear base, or null.
export function uniqueForBase(base) { return BY_BASE[base] || null; }
// Every unique that drops in a given equipment slot.
export function uniquesForSlot(slot) { return UNIQUES.filter(u => u.slot === slot); }
// Every gear base that has a unique (one per gear type).
export function allUniqueBases() { return UNIQUES.map(u => u.base); }
