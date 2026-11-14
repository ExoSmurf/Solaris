import { describe, it, expect, vi } from 'vitest';
import { createImagePreloader, planetImageUrls } from '../../src/ui/preloadImages.js';

describe('planetImageUrls', () => {
    it('gives the normal and the high-res version of every image', () => {
        expect(planetImageUrls(['cares', 'mesa'], '/img/')).toEqual([
            '/img/cares.webp',
            '/img/cares2.webp',
            '/img/mesa.webp',
            '/img/mesa2.webp',
        ]);
    });

    it('a planet without images gives no urls', () => {
        expect(planetImageUrls([], '/img/')).toEqual([]);
        expect(planetImageUrls(undefined, '/img/')).toEqual([]);
    });
});

describe('createImagePreloader', () => {
    it('loads every url once', () => {
        const load = vi.fn();
        const preloader = createImagePreloader(load);
        expect(preloader.preload(['/a.webp', '/b.webp'])).toBe(2);
        expect(load).toHaveBeenCalledTimes(2);
    });

    it('does not load the same url again when focusing the planet a second time', () => {
        const load = vi.fn();
        const preloader = createImagePreloader(load);
        preloader.preload(['/a.webp']);
        expect(preloader.preload(['/a.webp', '/b.webp'])).toBe(1);
        expect(load).toHaveBeenCalledTimes(2);
    });

    it('skips empty urls', () => {
        const load = vi.fn();
        expect(createImagePreloader(load).preload(['', null, undefined])).toBe(0);
        expect(load).not.toHaveBeenCalled();
    });
});
