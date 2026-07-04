import { describe, it, expect } from 'vitest';
import { abbreviateNumber, formatDamageRange, abbreviateNumbersIn } from '../../src/utils/format.js';

describe('abbreviateNumber', () => {
  it('prints small values exactly (rounded)', () => {
    expect(abbreviateNumber(0)).toBe('0');
    expect(abbreviateNumber(5)).toBe('5');
    expect(abbreviateNumber(42)).toBe('42');
    expect(abbreviateNumber(999)).toBe('999');
    expect(abbreviateNumber(55.4)).toBe('55');
    expect(abbreviateNumber(55.6)).toBe('56');
  });

  it('abbreviates thousands with a k suffix', () => {
    expect(abbreviateNumber(1000)).toBe('1k');
    expect(abbreviateNumber(1200)).toBe('1.2k');
    expect(abbreviateNumber(12000)).toBe('12k');
    expect(abbreviateNumber(125000)).toBe('125k');
  });

  it('abbreviates millions, billions and trillions', () => {
    expect(abbreviateNumber(1_000_000)).toBe('1M');
    expect(abbreviateNumber(1_500_000)).toBe('1.5M');
    expect(abbreviateNumber(2_000_000)).toBe('2M');
    expect(abbreviateNumber(1_000_000_000)).toBe('1B');
    expect(abbreviateNumber(1_500_000_000)).toBe('1.5B');
    expect(abbreviateNumber(1_000_000_000_000)).toBe('1T');
  });

  it('drops a trailing .0 (whole units past ten)', () => {
    expect(abbreviateNumber(10_000)).toBe('10k');
    expect(abbreviateNumber(10_000_000)).toBe('10M');
  });

  it('handles negatives with a leading sign', () => {
    expect(abbreviateNumber(-500)).toBe('-500');
    expect(abbreviateNumber(-1500)).toBe('-1.5k');
  });

  it('treats non-finite input as 0', () => {
    expect(abbreviateNumber(NaN)).toBe('0');
    expect(abbreviateNumber(Infinity)).toBe('0');
    expect(abbreviateNumber(-Infinity)).toBe('0');
    expect(abbreviateNumber(undefined)).toBe('0');
  });
});

describe('formatDamageRange', () => {
  it('joins distinct ends with an en dash', () => {
    expect(formatDamageRange(12, 18)).toBe('12–18');
    expect(formatDamageRange(1200, 1800)).toBe('1.2k–1.8k');
  });

  it('collapses to a single number when both ends abbreviate alike', () => {
    expect(formatDamageRange(50, 50)).toBe('50');
    // A fixed-damage spell has min === max.
    expect(formatDamageRange(340, 340)).toBe('340');
  });

  it('abbreviates each end independently', () => {
    expect(formatDamageRange(900, 1500)).toBe('900–1.5k');
  });
});

describe('abbreviateNumbersIn', () => {
  it('abbreviates a bare big damage number', () => {
    expect(abbreviateNumbersIn('15230')).toBe('15k');   // ≥10 of a unit → whole
    expect(abbreviateNumbersIn('8400')).toBe('8.4k');   // <10 of a unit → one decimal
    expect(abbreviateNumbersIn('2000000')).toBe('2M');
  });
  it('leaves numbers under 1000 (fewer than 4 digits) untouched', () => {
    expect(abbreviateNumbersIn('250')).toBe('250');
    expect(abbreviateNumbersIn('999')).toBe('999');
  });
  it('keeps prefixes and suffixes around the number', () => {
    expect(abbreviateNumbersIn('15230!')).toBe('15k!');        // crit marker
    expect(abbreviateNumbersIn('+8400')).toBe('+8.4k');        // heal / gold
    expect(abbreviateNumbersIn('-2500')).toBe('-2.5k');        // life cost
    expect(abbreviateNumbersIn('💥8400')).toBe('💥8.4k');      // detonation
    expect(abbreviateNumbersIn('+12000 MP')).toBe('+12k MP');  // mana restore
  });
  it('only abbreviates the 4+ digit run in a compound label', () => {
    expect(abbreviateNumbersIn('2×15230')).toBe('2×15k');      // the ×2 count stays
    expect(abbreviateNumbersIn('BLOCK 4200')).toBe('BLOCK 4.2k');
    expect(abbreviateNumbersIn('2×250')).toBe('2×250');        // nothing 4+ digits
  });
  it('leaves pure-text labels alone', () => {
    expect(abbreviateNumbersIn('MISS')).toBe('MISS');
    expect(abbreviateNumbersIn('DODGE')).toBe('DODGE');
    expect(abbreviateNumbersIn('FURY 3')).toBe('FURY 3');
  });
  it('does not disturb sprite-span markup (no 4-digit runs in keys)', () => {
    expect(abbreviateNumbersIn('<span data-spr=ic_orb></span>13400'))
      .toBe('<span data-spr=ic_orb></span>13k');
  });
  it('returns non-string input unchanged', () => {
    expect(abbreviateNumbersIn(undefined)).toBe(undefined);
    expect(abbreviateNumbersIn(1234)).toBe(1234);
  });
});
