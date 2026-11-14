import { describe, it, expect, vi } from 'vitest';
import { fitFontSize } from '../../src/ui/fitText.js';

describe('fitFontSize', () => {
    it('keeps the CSS size when the text already fits', () => {
        expect(fitFontSize(() => true, 25, 8)).toBe(25);
    });

    it('returns the largest size that fits', () => {
        const fits = (size) => size * 8 <= 140;
        expect(fitFontSize(fits, 25, 8)).toBe(17);
    });

    it('falls back to the minimum when nothing fits', () => {
        expect(fitFontSize(() => false, 25, 8)).toBe(8);
    });

    it('stops at the first size that fits (does not keep shrinking)', () => {
        const fits = vi.fn((size) => size <= 20);
        fitFontSize(fits, 25, 8);
        expect(fits).toHaveBeenCalledTimes(6);
    });

    it('works with a bigger step', () => {
        expect(fitFontSize((size) => size <= 19, 25, 8, 2)).toBe(19);
    });

    it('a maximum below the minimum gives the minimum', () => {
        expect(fitFontSize(() => true, 6, 8)).toBe(8);
    });
});
