import { describe, it, expect } from 'vitest';
import { TERRAIN_PACKS, BIOME_PACK_OVERRIDES, packForBiome, terrainPacksInUse } from '../../src/data/terrainPacks.js';

describe('terrainPacks registry', () => {
  it('ships the bundled LPC pack as the default', () => {
    expect(TERRAIN_PACKS.lpc).toMatchObject({ id: 'lpc', tile: 32, cols: 32 });
  });
  it('has no biome overrides by default (world unchanged)', () => {
    expect(Object.keys(BIOME_PACK_OVERRIDES)).toHaveLength(0);
  });
});

describe('packForBiome', () => {
  it('falls back to LPC for unmapped biomes', () => {
    expect(packForBiome('the Cherry Blossom Grove')).toBe(TERRAIN_PACKS.lpc);
    expect(packForBiome('nonexistent')).toBe(TERRAIN_PACKS.lpc);
  });
  it('resolves a registered override', () => {
    TERRAIN_PACKS['test-pack'] = { id: 'test-pack', tile: 32, cols: 32 };
    BIOME_PACK_OVERRIDES['the Test Biome'] = 'test-pack';
    try {
      expect(packForBiome('the Test Biome')).toBe(TERRAIN_PACKS['test-pack']);
    } finally {
      delete TERRAIN_PACKS['test-pack'];
      delete BIOME_PACK_OVERRIDES['the Test Biome'];
    }
  });
  it('degrades a dangling override (unregistered pack) to LPC', () => {
    BIOME_PACK_OVERRIDES['the Broken Biome'] = 'not-registered';
    try {
      expect(packForBiome('the Broken Biome')).toBe(TERRAIN_PACKS.lpc);
    } finally {
      delete BIOME_PACK_OVERRIDES['the Broken Biome'];
    }
  });
});

describe('terrainPacksInUse', () => {
  it('credits only LPC by default', () => {
    expect(terrainPacksInUse()).toEqual([TERRAIN_PACKS.lpc]);
  });
  it('adds a registered pack a biome opts into, and ignores dangling overrides', () => {
    TERRAIN_PACKS['ms'] = { id: 'ms', label: 'Mana Seed', tile: 32, cols: 32, license: 'x', credit: 'Seliel' };
    BIOME_PACK_OVERRIDES['the Cherry Blossom Grove'] = 'ms';
    BIOME_PACK_OVERRIDES['the Void Sanctum'] = 'ghost'; // unregistered — skipped
    try {
      const inUse = terrainPacksInUse();
      expect(inUse).toContain(TERRAIN_PACKS.lpc);
      expect(inUse).toContain(TERRAIN_PACKS.ms);
      expect(inUse).toHaveLength(2);
    } finally {
      delete TERRAIN_PACKS.ms;
      delete BIOME_PACK_OVERRIDES['the Cherry Blossom Grove'];
      delete BIOME_PACK_OVERRIDES['the Void Sanctum'];
    }
  });
});
