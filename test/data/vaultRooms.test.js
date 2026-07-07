import { describe, it, expect } from 'vitest';
import { VAULT_ROOMS } from '../../src/data/vaultRooms.js';

// The kinds the legacy populateVault switch knows how to fill a room with. If a new
// flavour is added to the data, wiring it here (and in the switch) is intentional.
const KNOWN_KINDS = new Set([
  'treasure', 'hoard', 'gold', 'feast', 'fountain', 'oasis', 'shrine', 'armory',
  'elites', 'swarm', 'champion', 'menagerie', 'gauntlet', 'firepit', 'warcamp', 'deepstair',
]);

describe('VAULT_ROOMS data', () => {
  it('offers a generous spread of flavours (the whole point of the feature)', () => {
    expect(VAULT_ROOMS.length).toBeGreaterThanOrEqual(16);
  });

  it('has a unique id per entry', () => {
    const ids = VAULT_ROOMS.map(v => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is well-formed: known kind, positive weight, sane room size, a reveal line', () => {
    for (const v of VAULT_ROOMS) {
      expect(KNOWN_KINDS.has(v.kind), `unknown kind: ${v.kind}`).toBe(true);
      expect(v.weight).toBeGreaterThan(0);
      expect(v.w).toBeGreaterThanOrEqual(2);
      expect(v.h).toBeGreaterThanOrEqual(2);
      expect(typeof v.openMsg).toBe('string');
      expect(v.openMsg.length).toBeGreaterThan(0);
    }
  });

  it('gates exactly the express-stair flavour behind needsDeep', () => {
    const deep = VAULT_ROOMS.filter(v => v.needsDeep);
    expect(deep).toHaveLength(1);
    expect(deep[0].kind).toBe('deepstair');
  });

  it('keeps the classic single-chest treasure vault as a flavour', () => {
    expect(VAULT_ROOMS.some(v => v.kind === 'treasure')).toBe(true);
  });
});
