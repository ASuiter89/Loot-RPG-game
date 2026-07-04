import { describe, it, expect } from 'vitest';
import { equipReqStatus, equipReqUnmet, equipReqShort } from '../../src/systems/equipReq.js';

describe('equipReqStatus', () => {
  it('is null when the piece carries no gate', () => {
    expect(equipReqStatus(null, 999)).toBeNull();
    expect(equipReqStatus(undefined, 0)).toBeNull();
  });

  it('reports met when the available attribute clears the need', () => {
    const s = equipReqStatus({ attr: 'str', need: 10 }, 12);
    expect(s).toEqual({ attr: 'str', need: 10, have: 12, ok: true });
  });

  it('reports met exactly at the boundary (have === need)', () => {
    expect(equipReqStatus({ attr: 'dex', need: 8 }, 8).ok).toBe(true);
  });

  it('reports unmet when short of the need', () => {
    const s = equipReqStatus({ attr: 'int', need: 20 }, 14);
    expect(s).toEqual({ attr: 'int', need: 20, have: 14, ok: false });
  });

  it('treats a missing/undefined available value as 0', () => {
    const s = equipReqStatus({ attr: 'str', need: 5 }, undefined);
    expect(s.have).toBe(0);
    expect(s.ok).toBe(false);
  });

  it('a need of 0 is always met', () => {
    expect(equipReqStatus({ attr: 'str', need: 0 }, 0).ok).toBe(true);
  });
});

describe('equipReqUnmet', () => {
  it('is false for a null/absent status', () => {
    expect(equipReqUnmet(null)).toBe(false);
    expect(equipReqUnmet(undefined)).toBe(false);
  });
  it('is false when the gate is met', () => {
    expect(equipReqUnmet({ ok: true })).toBe(false);
  });
  it('is true only when a gate exists and is unmet', () => {
    expect(equipReqUnmet({ ok: false })).toBe(true);
  });
});

describe('equipReqShort', () => {
  it('is empty when the piece is equippable or has no gate', () => {
    expect(equipReqShort(null, 'MGT')).toBe('');
    expect(equipReqShort({ ok: true }, 'MGT')).toBe('');
  });

  it('names the shortfall (need, attribute, current) when unmet', () => {
    const s = equipReqStatus({ attr: 'str', need: 18 }, 11);
    const label = equipReqShort(s, 'MGT');
    expect(label).toContain('18 MGT');
    expect(label).toContain('have 11');
    expect(label.toLowerCase()).toContain("can't equip");
  });
});
