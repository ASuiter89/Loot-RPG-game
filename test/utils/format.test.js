import { describe, it, expect } from 'vitest';
import { shortNum, abbrevNums } from '../../src/utils/format.js';

describe('shortNum', () => {
  it('leaves values under 1000 unchanged', () => {
    expect(shortNum(0)).toBe('0');
    expect(shortNum(7)).toBe('7');
    expect(shortNum(999)).toBe('999');
  });

  it('abbreviates thousands with one decimal, dropping trailing zero', () => {
    expect(shortNum(1000)).toBe('1k');
    expect(shortNum(1200)).toBe('1.2k');
    expect(shortNum(1250)).toBe('1.3k'); // rounds
    expect(shortNum(9999)).toBe('10k');
  });

  it('drops the decimal past 100 of a unit', () => {
    expect(shortNum(12345)).toBe('12.3k');
    expect(shortNum(123456)).toBe('123k');
  });

  it('abbreviates millions and billions', () => {
    expect(shortNum(1_500_000)).toBe('1.5m');
    expect(shortNum(2_000_000_000)).toBe('2b');
  });

  it('preserves the sign of negatives', () => {
    expect(shortNum(-1500)).toBe('-1.5k');
    expect(shortNum(-42)).toBe('-42');
  });

  it('passes non-finite input through as a string', () => {
    expect(shortNum(NaN)).toBe('NaN');
    expect(shortNum(Infinity)).toBe('Infinity');
  });
});

describe('abbrevNums', () => {
  it('only rewrites runs of 4+ digits', () => {
    expect(abbrevNums('123')).toBe('123');
    expect(abbrevNums('1234')).toBe('1.2k');
  });

  it('keeps surrounding signs and words intact', () => {
    expect(abbrevNums('+1523')).toBe('+1.5k');
    expect(abbrevNums('BLOCK 1200')).toBe('BLOCK 1.2k');
    expect(abbrevNums('FROZEN')).toBe('FROZEN');
  });
});
