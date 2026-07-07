// Locked-vault flavours — the sealed rock rooms the hero cracks open with a found
// key. A vault used to be a single tile hiding one chest; now the door can open on
// any of these themed rooms, so finding a key is a real "what's behind it?" moment.
//
// Pure data — the legacy monolith owns the carving, spawning and rendering; the
// weighted pick lives in `src/systems/vaultRooms.js`. Each entry:
//   id       stable identifier (also the changelog-friendly name)
//   kind     discriminator the legacy `populateVault` switch fills the room by
//   weight   relative roll weight (bigger = more common)
//   w, h     preferred interior size in tiles (shrinks if the rock won't fit it)
//   openMsg  themed line logged the moment the door is unlocked (the reveal)
//   needsDeep only offered when there's room below to actually drop two floors
export const VAULT_ROOMS = [
  { id: 'treasure', kind: 'treasure', weight: 10, w: 2, h: 2,
    openMsg: 'A treasure vault — a fat chest waits inside!' },
  { id: 'hoard', kind: 'hoard', weight: 7, w: 5, h: 4,
    openMsg: 'A hoard vault — chests stacked wall to wall!' },
  { id: 'gold', kind: 'gold', weight: 6, w: 4, h: 3,
    openMsg: 'A coin trove — heaps of gold spill across the floor!' },
  { id: 'feast', kind: 'feast', weight: 5, w: 4, h: 3,
    openMsg: 'A hidden larder — a spread of food to devour!' },
  { id: 'fountain', kind: 'fountain', weight: 6, w: 3, h: 3,
    openMsg: 'A hidden spring — a healing fountain bubbles within!' },
  { id: 'oasis', kind: 'oasis', weight: 4, w: 4, h: 3,
    openMsg: 'A secret oasis — a healing fountain and a chest both!' },
  { id: 'shrine', kind: 'shrine', weight: 6, w: 3, h: 3,
    openMsg: 'A sealed sanctum — a shrine offers its blessing!' },
  { id: 'armory', kind: 'armory', weight: 6, w: 4, h: 3,
    openMsg: 'An armory — chests of gear behind the lock!' },
  { id: 'elites', kind: 'elites', weight: 8, w: 5, h: 4,
    openMsg: 'A guardroom — elite wardens turn to face you!' },
  { id: 'swarm', kind: 'swarm', weight: 7, w: 5, h: 4,
    openMsg: 'A brood nest — a swarm boils out at you!' },
  { id: 'champion', kind: 'champion', weight: 4, w: 4, h: 4,
    openMsg: "A champion's tomb — its guardian stirs!" },
  { id: 'menagerie', kind: 'menagerie', weight: 5, w: 5, h: 4,
    openMsg: 'A monster den — brutes and swarmers alike!' },
  { id: 'gauntlet', kind: 'gauntlet', weight: 5, w: 3, h: 3,
    openMsg: 'A trapped vault — spikes ring the prize!' },
  { id: 'firepit', kind: 'firepit', weight: 4, w: 3, h: 3,
    openMsg: 'A molten cache — the loot sits amid the lava!' },
  { id: 'warcamp', kind: 'warcamp', weight: 5, w: 5, h: 4,
    openMsg: "A raiders' cache — guards and their plundered spoils!" },
  { id: 'deepstair', kind: 'deepstair', weight: 5, w: 3, h: 3, needsDeep: true,
    openMsg: 'A hidden stair — it plunges two floors deep!' },
];
