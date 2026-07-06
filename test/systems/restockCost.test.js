import { describe, it, expect } from 'vitest';
import { restockCost, RESTOCK_ESCALATION } from '../../src/systems/restockCost.js';

describe('restockCost', () => {
  it('charges the flat base for the first restock', () => {
    expect(restockCost(200, 0)).toBe(200);
    expect(restockCost(200)).toBe(200); // count defaults to 0
  });

  it('escalates each subsequent restock by a fixed fraction of the base', () => {
    expect(restockCost(200, 1)).toBe(Math.round(200 * (1 + RESTOCK_ESCALATION)));
    expect(restockCost(200, 2)).toBe(Math.round(200 * (1 + 2 * RESTOCK_ESCALATION)));
    expect(restockCost(200, 3)).toBe(Math.round(200 * (1 + 3 * RESTOCK_ESCALATION)));
  });

  it('is strictly increasing in the restock count', () => {
    let prev = -1;
    for (let n = 0; n <= 10; n++) {
      const c = restockCost(100, n);
      expect(c).toBeGreaterThan(prev);
      prev = c;
    }
  });

  it('floors fractional counts and clamps negatives to the base', () => {
    expect(restockCost(100, -5)).toBe(100);
    expect(restockCost(100, 2.9)).toBe(restockCost(100, 2));
  });

  it('honours a custom escalation rate', () => {
    expect(restockCost(100, 2, 0.5)).toBe(200);
  });
});
