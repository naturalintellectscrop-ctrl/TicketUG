import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition, publicationStateForTransition } from './event-lifecycle';
describe('event lifecycle', () => {
    it('allows the canonical forward flow', () => {
        expect(canTransition('DRAFT', 'PUBLISHED')).toBe(true);
        expect(canTransition('PUBLISHED', 'SALES_OPEN')).toBe(true);
        expect(canTransition('SALES_OPEN', 'SALES_CLOSED')).toBe(true);
        expect(canTransition('SALES_CLOSED', 'EVENT_LIVE')).toBe(true);
        expect(canTransition('EVENT_LIVE', 'COMPLETED')).toBe(true);
    });
    it('rejects skipping states and reopening archived events', () => {
        expect(canTransition('DRAFT', 'SALES_OPEN')).toBe(false);
        expect(() => assertTransition('ARCHIVED', 'PUBLISHED')).toThrow();
    });
    it('preserves publication state for sales and event lifecycle transitions', () => {
        expect(publicationStateForTransition('PUBLISHED')).toBe('PUBLIC');
        expect(publicationStateForTransition('DRAFT')).toBe('PRIVATE');
        expect(publicationStateForTransition('SALES_OPEN')).toBeUndefined();
        expect(publicationStateForTransition('SALES_CLOSED')).toBeUndefined();
        expect(publicationStateForTransition('EVENT_LIVE')).toBeUndefined();
        expect(publicationStateForTransition('COMPLETED')).toBeUndefined();
    });
});
