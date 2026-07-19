import { describe, it, expect } from 'vitest';
import { creditInitials } from '../../src/systems/credit.js';
import { CONTRIBUTORS, DEFAULT_INITIALS } from '../../src/data/contributors.js';

describe('creditInitials', () => {
  it('maps every Jeff Louie identity to JL', () => {
    for (const a of ['Jeff Louie', 'JeffCLouie', 'jeffclouie']) {
      expect(creditInitials(a), a).toBe('JL');
    }
  });

  it('maps every Andrew Suiter identity to AS', () => {
    for (const a of ['Andrew Suiter', 'ASuiter89', 'asuiter89']) {
      expect(creditInitials(a), a).toBe('AS');
    }
  });

  it('ignores case and surrounding whitespace', () => {
    expect(creditInitials('  jeff louie ')).toBe('JL');
    expect(creditInitials('ANDREW SUITER')).toBe('AS');
  });

  it('falls back for an unknown, empty, or missing name', () => {
    expect(creditInitials('Someone Else')).toBe(DEFAULT_INITIALS);
    expect(creditInitials('')).toBe(DEFAULT_INITIALS);
    expect(creditInitials(undefined)).toBe(DEFAULT_INITIALS);
    expect(creditInitials(null)).toBe(DEFAULT_INITIALS);
  });

  it('does not silently bucket the tool into a maintainer badge', () => {
    // "Claude" is not a contributor — it must hit the fallback, never JL.
    expect(creditInitials('Claude')).toBe(DEFAULT_INITIALS);
    expect(creditInitials('Claude')).not.toBe('JL');
  });

  it('the table covers exactly the two maintainers', () => {
    expect(CONTRIBUTORS.map(c => c.initials).sort()).toEqual(['AS', 'JL']);
    for (const c of CONTRIBUTORS) {
      expect(c.aliases, `${c.initials} aliases`).toContain(c.name);
    }
  });
});
