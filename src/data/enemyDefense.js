// Per-enemy physical-armor / magic-resistance multipliers. 1.0 = average toughness for
// that school; the SPLIT between the two is what gives a foe its identity — a stone
// golem shrugs off blades (high phys) but melts to magic (low magic); a wraith is the
// reverse. These multiply the depth-scaled base armor (systems/defense.js), so the two
// numbers stay meaningful at every floor. Any enemy id missing here (quest foes,
// summoned adds) falls back to DEFAULT_RESIST — plain, balanced toughness.
//
// Kept as data (not logic): one tidy table to tune every enemy, validated by
// test/data/enemyDefense.test.js (every value in range, per-enemy average near 1).

export const DEFAULT_RESIST = { phys: 1, magic: 1 };

// Hard ceiling on either school's mitigation fraction. The raw depth/elite/boss base
// tops out around 0.31, so a neutral foe never reaches this — it only bites when a
// per-enemy multiplier pushes the resisted school up, keeping a foe tough-but-never-
// immune (its soft school stays the reliable answer).
export const RESIST_CAP = 0.6;

// id → { phys, magic } multiplier. Populated by the roster-wide tuning pass.
export const ENEMY_RESIST = {
  rat: { phys: 1, magic: 0.9 }, // ordinary flesh vermin, balanced with slight physical lean
  giantrat: { phys: 1.1, magic: 0.85 }, // bigger fleshy brute, thicker hide leans physical
  sewerrat: { phys: 0.95, magic: 0.95 }, // plain flesh-and-blood beast, evenly balanced
  plaguerat: { phys: 0.85, magic: 1.05 }, // diseased miasma shrugs magic a touch, soft body
  bat: { phys: 0.9, magic: 0.95 }, // small flying animal, balanced and soft
  giantbat: { phys: 1.05, magic: 0.85 }, // larger fleshy flyer, mild physical toughness
  vampirebat: { phys: 0.7, magic: 1.25 }, // unnatural vampiric creature resists magic, frail body
  cavesnake: { phys: 1, magic: 0.9 }, // reptile flesh, balanced with faint physical lean
  viper: { phys: 0.95, magic: 0.9 }, // venomous but ordinary flesh, balanced
  bogfrog: { phys: 1, magic: 0.9 }, // slick amphibian flesh, balanced
  cavespider: { phys: 1.15, magic: 0.8 }, // chitin carapace leans physical, weak to magic
  giantspider: { phys: 1.5, magic: 0.65 }, // thick carapace very tough physically, magic-soft
  webspinner: { phys: 1.2, magic: 0.8 }, // hardened spider shell leans physical
  slime: { phys: 0.45, magic: 1.65 }, // ooze shrugs blades, melts under magic
  rotgrub: { phys: 0.85, magic: 1.05 }, // soft decaying flesh, blades cut, faint necrotic resist
  maggot: { phys: 0.9, magic: 0.95 }, // squishy fleshy larva, ordinary and balanced
  centipede: { phys: 1.2, magic: 0.85 }, // chitinous armored segments lean physically tough
  scorpion: { phys: 1.5, magic: 0.7 }, // hard carapace exoskeleton, physical-tanky, magic-soft
  firebeetle: { phys: 1.4, magic: 0.85 }, // thick beetle carapace, physical shell over fiery body
  willowisp: { phys: 0.45, magic: 1.85 }, // incorporeal energy, weapons pass through, magic-resistant
  kobold: { phys: 0.95, magic: 0.9 }, // small flesh humanoid, ordinary balanced defenses
  wolf: { phys: 1, magic: 0.9 }, // ordinary beast, muscle and fur, balanced
  direwolf: { phys: 1.1, magic: 0.85 }, // larger beast, thicker hide, slight physical lean
  timberwolf: { phys: 1.05, magic: 0.9 }, // sturdy pack beast, mild physical lean
  cavebear: { phys: 1.6, magic: 0.7 }, // thick-hide brute, very physical-tough, magic-soft
  grizzly: { phys: 1.55, magic: 0.7 }, // massive thick hide brute, physical-tanky
  boar: { phys: 1.4, magic: 0.8 }, // tough hide charger, physical lean, magic-soft
  tusker: { phys: 1.5, magic: 0.75 }, // heavy thick-hide brute, strong physical lean
  panther: { phys: 1, magic: 0.85 }, // sleek flesh cat, balanced slight phys
  sabercat: { phys: 1.05, magic: 0.85 }, // muscular big-cat beast, balanced lean phys
  hyena: { phys: 0.95, magic: 0.9 }, // ordinary flesh pack beast, balanced
  vulture: { phys: 0.85, magic: 0.95 }, // frail scavenger bird, balanced slight magic
  constrictor: { phys: 1, magic: 0.85 }, // muscular snake, balanced slight phys
  gianttoad: { phys: 0.95, magic: 0.9 }, // squishy amphibian flesh, balanced
  owlbear: { phys: 1.65, magic: 0.65 }, // thick-hide brute, physical-tough
  raptor: { phys: 1.05, magic: 0.85 }, // swift flesh predator, balanced lean phys
  carrioncrawler: { phys: 1.4, magic: 0.7 }, // segmented carapace worm, phys-tough
  bloodhound: { phys: 0.95, magic: 0.9 }, // flesh hound, balanced
  wildape: { phys: 1.5, magic: 0.7 }, // heavy-muscle brute, physical-tough
  stagbeetle: { phys: 1.8, magic: 0.5 }, // thick chitin carapace, phys-tanky magic-soft
  cavelurker: { phys: 1.05, magic: 0.85 }, // subterranean flesh predator, balanced slight phys
  goblin: { phys: 0.95, magic: 0.9 }, // ordinary humanoid, balanced
  goblinarcher: { phys: 0.9, magic: 1.05 }, // fleshy goblin skirmisher; balanced, slight caster magic lean
  hobgoblin: { phys: 1.15, magic: 0.85 }, // armored goblinoid warrior; leans physical, no magic
  orc: { phys: 1.3, magic: 0.75 }, // muscular brute flesh; physical-tough, magic-soft
  orcbrute: { phys: 1.5, magic: 0.7 }, // hulking muscle brute; heavy physical, weak magic
  bandit: { phys: 1, magic: 0.9 }, // ordinary armed human; balanced, slight physical
  brigand: { phys: 1.05, magic: 0.85 }, // tougher human raider; balanced, slight physical
  cutthroat: { phys: 0.95, magic: 0.9 }, // agile lightly-armored assassin; both soft, balanced
  cultist: { phys: 0.7, magic: 1.5 }, // arcane spellcaster; magic-tanky, physically frail
  darkacolyte: { phys: 0.6, magic: 1.6 }, // demonic holy caster; very magic-resistant, soft flesh
  koboldshaman: { phys: 0.6, magic: 1.5 }, // frail arcane shaman; magic-tanky, low physical
  gnoll: { phys: 1.1, magic: 0.85 }, // hyena-folk beast; balanced, slight physical lean
  ogre: { phys: 1.6, magic: 0.6 }, // thick-hide brute; physical-tough, magic-soft
  ogrebrute: { phys: 1.7, magic: 0.6 }, // massive hide brute; heavy physical, weak magic
  troll: { phys: 1.7, magic: 0.6 }, // regenerating hide brute; physical-tough, weak to magic
  harpy: { phys: 0.9, magic: 0.95 }, // feathered flesh beast, balanced
  marauder: { phys: 1.05, magic: 0.9 }, // human raider, flesh-and-blood, slight phys
  wargrider: { phys: 1.1, magic: 0.85 }, // beast-mounted goblin, mundane flesh, slight phys
  goblinbomber: { phys: 0.9, magic: 0.95 }, // goblin flesh, bombs are physical, balanced
  warlock: { phys: 0.55, magic: 1.75 }, // arcane caster, soft body, high magic ward
  skeleton: { phys: 1.4, magic: 0.65 }, // bare bone shrugs blades, weak to magic
  skeletonarcher: { phys: 1.25, magic: 0.75 }, // bone frame, arrows mundane, phys-leaning
  skeletonknight: { phys: 1.8, magic: 0.5 }, // armored bone brute, very physical-tanky
  zombie: { phys: 1.2, magic: 0.8 }, // rotting flesh brute, shrugs hits, phys lean
  rottingzombie: { phys: 1.25, magic: 0.75 }, // decayed corporeal brute, physical-tough
  ghoul: { phys: 1, magic: 0.9 }, // corporeal flesh-eater, balanced
  ghast: { phys: 0.7, magic: 1.4 }, // spectral stench-undead, ethereal, magic-tanky
  wight: { phys: 0.75, magic: 1.35 }, // life-draining cursed spirit, magic-resistant
  gravewight: { phys: 0.7, magic: 1.45 }, // grave-bound death-spirit, strongly magic-tanky
  wraith: { phys: 0.45, magic: 1.85 }, // Incorporeal undead: blades pass through, magic bites
  specter: { phys: 0.5, magic: 1.8 }, // Ethereal spirit, near-immune to weapons
  shade: { phys: 0.55, magic: 1.65 }, // Shadowy undead, physical-soft, magic-resistant
  banshee: { phys: 0.45, magic: 1.85 }, // Incorporeal wailing caster, wields death magic
  revenant: { phys: 1.5, magic: 0.7 }, // Corporeal reanimated brute, tough flesh, magic-vulnerable
  bonegolem: { phys: 1.8, magic: 0.5 }, // Bone construct, armored against blades, magic shatters
  deathcultist: { phys: 0.6, magic: 1.7 }, // Robed spellcaster, warded, physically frail
  plaguebearer: { phys: 0.9, magic: 1.05 }, // Diseased flesh, balanced, faint plague-magic lean
  corpseeater: { phys: 1.05, magic: 0.85 }, // Flesh-and-blood ghoul, balanced, slight physical toughness
  grimwraith: { phys: 0.5, magic: 1.8 }, // Greater incorporeal wraith, weapons ineffective
  barrowwight: { phys: 1.55, magic: 0.7 }, // Armored grave-guardian undead, physical brute
  imp: { phys: 0.55, magic: 1.7 }, // Small demon caster, arcane-warded, physically weak
  lesserdemon: { phys: 0.65, magic: 1.6 }, // Demonic caster, magic-resistant, softer to steel
  devil: { phys: 0.55, magic: 1.75 }, // Higher demon, potent wards, physically vulnerable
  hellhound: { phys: 0.9, magic: 1.05 }, // fiery hound, flesh body with slight fire resist
  cerberus: { phys: 1, magic: 1.1 }, // three-headed fire hound, sturdy flesh plus flame
  succubus: { phys: 0.55, magic: 1.7 }, // arcane charm caster, soft mortal body
  incubus: { phys: 0.6, magic: 1.65 }, // arcane seducer caster, soft body
  barbeddevil: { phys: 1.55, magic: 0.7 }, // spiked carapace brute, hard shell soft to magic
  vrock: { phys: 0.95, magic: 1.05 }, // flesh vulture demon, faint magic lean
  balor: { phys: 1.3, magic: 1 }, // huge melee fire brute, leans physical
  pitfiend: { phys: 1.5, magic: 0.8 }, // armored greatest devil, physical brute
  beardeddevil: { phys: 1.4, magic: 0.75 }, // glaive-wielding devil melee brute
  quasit: { phys: 0.7, magic: 1.2 }, // tiny spell-like demon, frail flesh
  demonspawn: { phys: 1.05, magic: 0.95 }, // flesh-and-blood lesser demon, balanced
  firefiend: { phys: 0.5, magic: 1.8 }, // fire elemental caster, blades pass through
  bloodletter: { phys: 1.45, magic: 0.8 }, // blade-demon warrior, physical brute
  chaosimp: { phys: 0.6, magic: 1.5 }, // arcane imp trickster, soft body
  hellknight: { phys: 1.6, magic: 0.7 }, // Heavy demonic plate armor; physical tank, minor arcane guard
  soulreaver: { phys: 0.5, magic: 1.7 }, // Incorporeal soul-reaping undead; blades pass, magic bites
  abyssalhound: { phys: 0.85, magic: 1.15 }, // Flesh hound but abyssal-tainted; slight magic lean
  fireelemental: { phys: 0.4, magic: 1.9 }, // Pure flame; weapons find nothing, magic disrupts it
  iceelemental: { phys: 0.55, magic: 1.7 }, // Frozen energy, a touch more solid than fire
  stormelemental: { phys: 0.4, magic: 1.85 }, // Living lightning; incorporeal, only magic disrupts it
  earthelemental: { phys: 1.6, magic: 0.65 }, // Body of rock; physical tank, magic-vulnerable
  stonegolem: { phys: 1.85, magic: 0.45 }, // Solid stone construct; huge armor, poor resistance
  irongolem: { phys: 1.9, magic: 0.4 }, // Metal shell; toughest physically, magic slips through
  claygolem: { phys: 1.55, magic: 0.6 }, // Sturdy but softer clay body; lighter physical tank
  animatedarmor: { phys: 1.8, magic: 0.5 }, // Empty plate; deflects blades, weak to disenchant
  gargoyle: { phys: 1.7, magic: 0.6 }, // Stone-skinned; hard against weapons, soft to magic
  livingstatue: { phys: 1.75, magic: 0.5 }, // Carved stone; heavy armor, thin magic resistance
  magmabeast: { phys: 0.8, magic: 1.4 }, // Molten fire-flesh; leans magic-tough, softer physically
  frostwisp: { phys: 0.5, magic: 1.7 }, // Incorporeal ice energy; blades pass, magic bites
  lightningsprite: { phys: 0.55, magic: 1.65 }, // Storm-energy being; near-immaterial, magic-resistant
  sandwraith: { phys: 0.5, magic: 1.65 }, // Incorporeal undead; physical hits phase through
  crystalguardian: { phys: 1.8, magic: 0.5 }, // Hard crystal shell; shatters to spells
  runesentinel: { phys: 1.25, magic: 1.05 }, // Armored construct body, runic magic aware
  emberspirit: { phys: 0.5, magic: 1.75 }, // Fire elemental caster; soft body, magic-tough
  tempest: { phys: 0.55, magic: 1.7 }, // Storm elemental caster; diffuse, magic-resistant
  golemsentry: { phys: 1.85, magic: 0.45 }, // Stone-metal golem; brute armor, magic-frail
  ashrevenant: { phys: 0.6, magic: 1.6 }, // Ashen undead; crumbles physically, magic-warded
  beholder: { phys: 0.55, magic: 1.75 }, // Eldritch aberration caster; soft flesh, arcane-tough
  mindflayer: { phys: 0.6, magic: 1.7 }, // Psionic caster; frail body, high magic resist
  gibberingmouther: { phys: 0.7, magic: 1.35 }, // Amorphous flesh-ooze; blades sink, magic burns
  chaosspawn: { phys: 0.65, magic: 1.55 }, // Warped chaos being; magic-saturated, physically soft
  voidhorror: { phys: 0.6, magic: 1.65 }, // Void energy horror; near-immaterial, magic-tough
  nightmare: { phys: 0.6, magic: 1.55 }, // Fiendish shadow-fire steed; incorporeal flame, soft to blade
  doppelganger: { phys: 0.95, magic: 1.05 }, // Fleshy shapeshifter; balanced, faint arcane lean
  cavefisher: { phys: 1.6, magic: 0.6 }, // Chitinous carapace crab; hard shell, magic-soft
  rustmonster: { phys: 1.5, magic: 0.65 }, // Armored insect carapace; tough shell, magic-soft
  gorgon: { phys: 1.6, magic: 0.65 }, // Iron-plated metal bull; very physical, magic-soft
  medusa: { phys: 0.7, magic: 1.55 }, // Fleshy petrifying caster; gaze magic, blade-vulnerable
  basilisk: { phys: 1.15, magic: 0.9 }, // Scaled armored lizard; balanced, slight physical hide
  chimera: { phys: 1.2, magic: 0.85 }, // Thick hide plus fire head; balanced, mild physical
  manticore: { phys: 1.15, magic: 0.85 }, // Flesh lion brute; balanced, slight physical lean
  hydra: { phys: 0.8, magic: 1.35 }, // Regenerating elemental serpent caster; leans magic-resistant
  displacerbeast: { phys: 0.7, magic: 1.45 }, // Light-bending phasing panther; magic-tough, physically fragi
  otyugh: { phys: 1.5, magic: 0.7 }, // Thick-hide filth brute; physical-tough, magic-soft
  roper: { phys: 1.75, magic: 0.55 }, // Stone-bodied cave pillar; rock-hard, very magic-soft
  aboleth: { phys: 0.65, magic: 1.6 }, // Ancient psychic aberration caster; strongly magic-resistant
  ooze: { phys: 0.45, magic: 1.65 }, // Gelatinous; blades slide off, magic dissolves it
  drake: { phys: 1.55, magic: 0.75 }, // Scaled draconic brute; armor over resistance
  wyvern: { phys: 1.35, magic: 0.8 }, // Leathery flying reptile; tough hide, low arcana
  youngdragon: { phys: 1.55, magic: 0.75 }, // Scaled brute; thick hide, modest magic guard
  wyrm: { phys: 1.6, magic: 0.7 }, // Massive scaled brute; heavy armor lean
  elderwyrm: { phys: 1.7, magic: 0.6 }, // Ancient scaled brute; near-impervious hide
  frostdragon: { phys: 0.8, magic: 1.5 }, // Ice-elemental caster; warded, soft to steel
  firedragon: { phys: 0.7, magic: 1.6 }, // Fire-elemental caster; magic-warded, physically soft
  shadowdragon: { phys: 0.7, magic: 1.6 }, // Void-elemental caster; half-incorporeal, high resistance
  lich: { phys: 0.55, magic: 1.7 }, // Undead archmage; brittle bones, potent wards
  archlich: { phys: 0.55, magic: 1.75 }, // Greater undead mage; frail frame, immense wards
  demonlord: { phys: 0.75, magic: 1.55 }, // Demonic sorcerer; arcane wards over flesh
  archdemon: { phys: 0.7, magic: 1.6 }, // Greater demon caster; hellfire-warded, soft body
  titan: { phys: 1.7, magic: 0.6 }, // Colossal stone giant; crushing armor, low arcana
  stonetitan: { phys: 1.85, magic: 0.5 }, // solid rock body, blades bite, magic melts it
  kraken: { phys: 0.85, magic: 1.4 }, // caster leviathan, wards magic, fleshy to steel
  behemoth: { phys: 1.7, magic: 0.6 }, // colossal thick-hide brute, resists blows not spells
  leviathan: { phys: 1.6, magic: 0.65 }, // armored scaled sea-brute, weak to arcane
  deathknight: { phys: 1.45, magic: 0.85 }, // heavy plate plus undead, leans physical-tough
  dreadreaper: { phys: 0.6, magic: 1.7 }, // spectral death lurker, phases through steel
  voidtitan: { phys: 0.75, magic: 1.55 }, // body of void energy, soft to weapons
  // ── Bosses (keyed by BOSSES[].type, not the b_ sprite name). Tanky but never a
  //    wall: the resisted school stays <= ~1.5 so no fixed boss shuts out a pure class. ──
  ratking: { phys: 1.15, magic: 0.95 }, // fleshy swarm — balanced, slight physical lean
  inferno: { phys: 0.8, magic: 1.4 }, // fire demon — blades find little, resists magic
  dragon: { phys: 1.45, magic: 1.05 }, // scaled brute — tough hide, moderate wards
  deathknight: { phys: 1.4, magic: 1.2 }, // armored undead — heavy plate, strong wards
  allseer: { phys: 0.8, magic: 1.5 }, // eldritch caster — soft to steel, resists magic
  cindra: { phys: 0.75, magic: 1.45 }, // arcane weaver — frail body, potent magic wards
  emberbound: { phys: 0.9, magic: 1.35 }, // ashen fire warden — resists flame-magic, softer to steel
  masquerade: { phys: 0.8, magic: 1.4 }, // duke of mirrors — illusion-warded against magic
  magmaw: { phys: 1.2, magic: 1.25 }, // molten devourer — rock-tough and fire-warded, high both
  mortisvane: { phys: 0.8, magic: 1.45 }, // necrolord — deathly magic wards, soft flesh
  vael: { phys: 1.5, magic: 1.0 }, // the sunderer — brute physical bulwark, moderate magic
  tidewarden: { phys: 0.9, magic: 1.35 }, // tide elemental — water parts steel, resists magic
  shrike: { phys: 1.2, magic: 0.95 }, // impaler beast — physical predator, little warding
  kaggoroth: { phys: 1.5, magic: 1.05 }, // chained titan — colossal physical bulk, moderate wards
  ourok: { phys: 1.0, magic: 1.4 }, // dungeon heart — eldritch core, magic-warded
};

// The resist profile for an enemy type, or the balanced default.
export function resistFor(type) {
  return (type && ENEMY_RESIST[type]) || DEFAULT_RESIST;
}
