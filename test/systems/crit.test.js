import { describe, it, expect } from 'vitest';
import { isCritical } from '../../src/systems/crit.js';

describe('isCritical', () => {
  it('crits when the roll falls under the chance', () => {
    expect(isCritical(0.1, 0.25)).toBe(true);
    expect(isCritical(0.2499, 0.25)).toBe(true);
  });

  it('does not crit when the roll meets or exceeds the chance', () => {
    expect(isCritical(0.25, 0.25)).toBe(false);
    expect(isCritical(0.9, 0.25)).toBe(false);
  });

  it('always crits when forced, regardless of roll or chance', () => {
    expect(isCritical(0.99, 0, true)).toBe(true);
    expect(isCritical(1, 0, true)).toBe(true);
  });

  it('treats a missing forced flag as not forced', () => {
    expect(isCritical(0.99, 0)).toBe(false);
    expect(isCritical(0, 0)).toBe(false); // 0 < 0 is false
  });

  it('coerces a truthy non-boolean forced to true', () => {
    expect(isCritical(0.99, 0, 1)).toBe(true);
  });
});
