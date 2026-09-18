import { describe, expect, it } from 'vitest';
import { calculateLineTotal, calculateOrderTotal, validateOrderItems } from './order.rules';
describe('order rules', () => {
    it('requires positive unique quantities', () => {
        expect(() => validateOrderItems([])).toThrow();
        expect(() => validateOrderItems([{ ticketTypeId: 'a', quantity: 0 }])).toThrow();
        expect(() => validateOrderItems([{ ticketTypeId: 'a', quantity: 1 }, { ticketTypeId: 'a', quantity: 1 }])).toThrow();
        expect(() => validateOrderItems([{ ticketTypeId: 'a', quantity: 2 }])).not.toThrow();
    });
    it('calculates deterministic integer totals', () => {
        expect(calculateLineTotal(50000, 2)).toBe(100000);
        expect(calculateOrderTotal([100000, 75000])).toBe(175000);
    });
    it('rejects unsafe totals', () => {
        expect(() => calculateLineTotal(Number.MAX_SAFE_INTEGER, 2)).toThrow();
    });
});
