import { describe, it, expect } from 'vitest';
import { revealCount, revealOrder, toGalactic } from '../../src/ui/scrambleText.js';

describe('toGalactic', () => {
    it('turns letters into enchanting table glyphs, ignoring case', () => {
        expect(toGalactic('a')).toBe('ᔑ');
        expect(toGalactic('A')).toBe('ᔑ');
        expect(toGalactic('e')).toBe('ᒷ');
    });

    it('turns digits into glyphs too', () => {
        for (const digit of '0123456789') expect(toGalactic(digit)).not.toBe(digit);
    });

    it('keeps spaces, punctuation and other characters', () => {
        for (const char of [' ', ',', '.', '*', '°', '/', ':', '\n']) expect(toGalactic(char)).toBe(char);
    });
});

describe('revealOrder', () => {
    it('is a permutation of all indices', () => {
        const order = revealOrder(50);
        expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i));
    });

    it('is the same every time (deterministic)', () => {
        expect(revealOrder(30)).toEqual(revealOrder(30));
    });

    it('roughly goes left to right: the first half revealed is mostly from the left half', () => {
        const order = revealOrder(100);
        const leftInFirstHalf = order.slice(0, 50).filter((i) => i < 50).length;
        expect(leftInFirstHalf).toBeGreaterThan(30);
    });

    it('handles empty and single-character texts', () => {
        expect(revealOrder(0)).toEqual([]);
        expect(revealOrder(1)).toEqual([0]);
    });
});

describe('revealCount', () => {
    it('reveals nothing at 0 and everything at 1', () => {
        expect(revealCount(0, 40)).toBe(0);
        expect(revealCount(1, 40)).toBe(40);
    });

    it('reveals about half half way', () => {
        expect(revealCount(0.5, 40)).toBe(20);
    });

    it('never goes outside 0..length', () => {
        expect(revealCount(-1, 40)).toBe(0);
        expect(revealCount(3, 40)).toBe(40);
    });

    it('only grows as progress grows', () => {
        let previous = 0;
        for (let p = 0; p <= 1; p += 0.01) {
            const count = revealCount(p, 57);
            expect(count).toBeGreaterThanOrEqual(previous);
            previous = count;
        }
    });
});
