import { describe, it, expect } from 'vitest';
import {
  VIBE_ALL,
  parseVibe,
  serializeVibe,
  toggleVibe,
  pickVibeSection,
  pickStartSection,
} from '../../src/systems/musicVibe.js';

const N = 26;                       // style count in the live data
const first = () => 0;              // rng that always picks the first candidate
const last = () => 0.999999;       // rng that always picks the last candidate

describe('parseVibe', () => {
  it("treats 'auto', null, undefined and empty as all-styles ([])", () => {
    expect(parseVibe(VIBE_ALL, N)).toEqual([]);
    expect(parseVibe(null, N)).toEqual([]);
    expect(parseVibe(undefined, N)).toEqual([]);
    expect(parseVibe('', N)).toEqual([]);
  });

  it('back-compat: a single stored index parses to a one-element set', () => {
    expect(parseVibe('3', N)).toEqual([3]);
  });

  it('parses a comma list, sorting and de-duping', () => {
    expect(parseVibe('9,3,5', N)).toEqual([3, 5, 9]);
    expect(parseVibe('3,3,5', N)).toEqual([3, 5]);
  });

  it('drops out-of-range and non-numeric tokens', () => {
    expect(parseVibe('3,99,-1,abc,', N)).toEqual([3]);
  });

  it('accepts an array of numbers or numeric strings', () => {
    expect(parseVibe([5, 2, 2], N)).toEqual([2, 5]);
    expect(parseVibe(['1', '2'], N)).toEqual([1, 2]);
  });

  it('collapses a full selection back to all ([])', () => {
    const everything = Array.from({ length: N }, (_, i) => i);
    expect(parseVibe(everything, N)).toEqual([]);
    expect(parseVibe(everything.join(','), N)).toEqual([]);
  });
});

describe('serializeVibe', () => {
  it('empty / all → auto', () => {
    expect(serializeVibe([], N)).toBe(VIBE_ALL);
    expect(serializeVibe(VIBE_ALL, N)).toBe(VIBE_ALL);
    expect(serializeVibe(Array.from({ length: N }, (_, i) => i), N)).toBe(VIBE_ALL);
  });

  it('a subset → sorted comma list', () => {
    expect(serializeVibe([9, 3, 5], N)).toBe('3,5,9');
    expect(serializeVibe('3', N)).toBe('3');
  });

  it('round-trips through parseVibe', () => {
    expect(parseVibe(serializeVibe([7, 1, 4], N), N)).toEqual([1, 4, 7]);
  });
});

describe('toggleVibe', () => {
  it('adds a style not yet selected', () => {
    expect(toggleVibe(VIBE_ALL, 3, N)).toEqual([3]);
    expect(toggleVibe('3,5', 1, N)).toEqual([1, 3, 5]);
  });

  it('removes a style already selected', () => {
    expect(toggleVibe('3,5', 3, N)).toEqual([5]);
    expect(toggleVibe('3', 3, N)).toEqual([]);
  });

  it('ignores an out-of-range index', () => {
    expect(toggleVibe('3,5', 99, N)).toEqual([3, 5]);
    expect(toggleVibe('3,5', -1, N)).toEqual([3, 5]);
  });
});

describe('pickVibeSection', () => {
  it('shuffle-all returns a valid style index', () => {
    for (const rng of [first, last, () => 0.5]) {
      const i = pickVibeSection(VIBE_ALL, N, rng);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(N);
    }
  });

  it('shuffle-all avoids the current style so it never repeats', () => {
    expect(pickVibeSection(VIBE_ALL, N, first, 0)).not.toBe(0);
    expect(pickVibeSection(VIBE_ALL, N, last, N - 1)).not.toBe(N - 1);
  });

  it('picks only from the selected subset', () => {
    expect(pickVibeSection('3,5', N, first)).toBe(3);
    expect(pickVibeSection('3,5', N, last)).toBe(5);
  });

  it('avoids the current style within a multi-style subset', () => {
    expect(pickVibeSection('3,5', N, first, 3)).toBe(5);
    expect(pickVibeSection('3,5', N, last, 5)).toBe(3);
  });

  it('a single locked style is returned even when asked to avoid it', () => {
    expect(pickVibeSection('3', N, first, 3)).toBe(3);
    expect(pickVibeSection('3', N, last, 3)).toBe(3);
  });

  it('an avoid outside the pool leaves the pool intact', () => {
    expect(pickVibeSection('3,5', N, first, 99)).toBe(3);
  });
});

describe('pickStartSection', () => {
  const happy = [6, 10];

  it('shuffle-all favours a happy style', () => {
    expect(pickStartSection(VIBE_ALL, N, happy, first)).toBe(6);
    expect(pickStartSection(VIBE_ALL, N, happy, last)).toBe(10);
  });

  it('shuffle-all with no happy list falls back to any style', () => {
    expect(pickStartSection(VIBE_ALL, N, [], first)).toBe(0);
  });

  it('tolerates a missing happy list', () => {
    expect(pickStartSection(VIBE_ALL, N, undefined, first)).toBe(0);
    expect(pickStartSection('3', N, null, first)).toBe(3);
  });

  it('drops invalid happy indices', () => {
    expect(pickStartSection(VIBE_ALL, N, [6, 99, -1], first)).toBe(6);
  });

  it('favours a happy style inside the selection', () => {
    expect(pickStartSection('6,7', N, happy, first)).toBe(6);
    expect(pickStartSection('6,7', N, happy, last)).toBe(6);
  });

  it('falls back to any selected style when none are happy', () => {
    expect(pickStartSection('0,7', N, happy, first)).toBe(0);
    expect(pickStartSection('0,7', N, happy, last)).toBe(7);
  });
});
