import { describe, it, expect } from 'vitest';
import { arrowTop } from '../../src/ui/slideArrow.js';

describe('arrowTop', () => {
    it('puts the arrow center on the thumbnail center', () => {
        const top = arrowTop(100, 300, 80, 40);
        expect(top + 40 / 2).toBe(300 + 80 / 2 - 100);
    });

    it('the first thumbnail at the top of the column gives a small offset', () => {
        expect(arrowTop(100, 100, 80, 40)).toBe(20);
    });

    it('an arrow taller than the thumbnail goes above it (negative offset)', () => {
        expect(arrowTop(100, 100, 20, 220)).toBe(-100);
    });

    it('a zero-height thumbnail (not loaded yet) still gives a finite value', () => {
        expect(Number.isFinite(arrowTop(0, 50, 0, 40))).toBe(true);
    });
});
