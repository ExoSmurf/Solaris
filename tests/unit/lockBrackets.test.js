import { describe, it, expect } from 'vitest';
import { bracketFrame, createLockBrackets, easeOutCubic, formatCoordinates, formatDelta, lockBracketsState, movementSpeed, screenRadius, searchCoordinates, searchSpread, smoothValue } from '../../src/ui/lockBrackets.js';
import { hud } from '../../src/config/settings.js';

const config = hud.brackets;
const viewport = { width: 1600, height: 900 };
const center = { x: 800, y: 450 };

function fakeElement() {
    return { dataset: {}, style: {} };
}

function fakeLabel() {
    let text = '';
    const label = {
        writes: 0,
        get textContent() {
            return text;
        },
        set textContent(value) {
            text = value;
            label.writes++;
        },
    };
    return label;
}

describe('formatCoordinates', () => {
    it('prints one decimal per axis in brackets', () => {
        expect(formatCoordinates({ x: 3, y: 0, z: -1.24 })).toBe('[3.0, 0.0, -1.2]');
    });

    it('never prints "-0.0" for tiny negative values', () => {
        expect(formatCoordinates({ x: -0.04, y: -0, z: 0.04 })).toBe('[0.0, 0.0, 0.0]');
    });

    it('keeps large values intact', () => {
        expect(formatCoordinates({ x: 123.456, y: -24, z: 19 })).toBe('[123.5, -24.0, 19.0]');
    });
});

describe('screenRadius', () => {
    it('with a 90 degree fov at distance 1, radius 1 fills half the screen height', () => {
        expect(screenRadius(1, 1, 90, 900)).toBeCloseTo(450);
    });

    it('twice as far looks half as big', () => {
        expect(screenRadius(1, 20, 45, 900)).toBeCloseTo(screenRadius(1, 10, 45, 900) / 2);
    });

    it('a narrower fov (zoomed in) makes the planet bigger on screen', () => {
        expect(screenRadius(1, 30, 10, 900)).toBeGreaterThan(screenRadius(1, 30, 45, 900));
    });

    it('zero, negative or NaN distance gives 0 instead of Infinity', () => {
        expect(screenRadius(1, 0, 45, 900)).toBe(0);
        expect(screenRadius(1, -5, 45, 900)).toBe(0);
        expect(screenRadius(1, NaN, 45, 900)).toBe(0);
    });
});

describe('easeOutCubic', () => {
    it('goes 0 -> 1, is already past halfway at the middle, and clamps', () => {
        expect(easeOutCubic(0)).toBe(0);
        expect(easeOutCubic(1)).toBe(1);
        expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
        expect(easeOutCubic(-1)).toBe(0);
        expect(easeOutCubic(2)).toBe(1);
    });
});

describe('lockBracketsState', () => {
    const PLANET = false;
    const REFOCUS = true;
    const SEARCH = 0.35;

    it('searches while flying from focus to focus, closing only part of the way', () => {
        expect(lockBracketsState('travel', 0, REFOCUS, SEARCH)).toEqual({ visibility: 'searching', closing: 0 });
        const end = lockBracketsState('travel', 1, REFOCUS, SEARCH);
        expect(end.visibility).toBe('searching');
        expect(end.closing).toBeCloseTo(SEARCH);
    });

    it('never closes further than searchClosing while searching', () => {
        for (let p = 0; p <= 1; p += 0.1) {
            expect(lockBracketsState('travel', p, REFOCUS, SEARCH).closing).toBeLessThanOrEqual(SEARCH + 1e-12);
        }
    });

    it('shows nothing on a normal flight (not focused before, or back to the center)', () => {
        expect(lockBracketsState('travel', 0.5, false, SEARCH).visibility).toBe('hidden');
    });

    it('locking in continues from where searching stopped (no jump) and ends fully closed', () => {
        expect(lockBracketsState('focusLock', 0, PLANET, SEARCH).closing).toBeCloseTo(SEARCH);
        expect(lockBracketsState('focusLock', 1, PLANET, SEARCH).closing).toBeCloseTo(1);
        expect(lockBracketsState('focusLock', 0.5, PLANET, SEARCH).visibility).toBe('closing');
    });

    it('is locked during the hold phase', () => {
        expect(lockBracketsState('focusHold', 0.5, PLANET, SEARCH)).toEqual({ visibility: 'locked', closing: 1 });
    });

    it('fades out while zooming', () => {
        expect(lockBracketsState('focusZoom', 0.5, PLANET, SEARCH).visibility).toBe('fading');
    });

    it('is hidden in every other mode', () => {
        for (const mode of ['overview', 'follow', 'focused', 'focusOut']) {
            expect(lockBracketsState(mode, 0.5, PLANET, SEARCH).visibility, mode).toBe('hidden');
        }
    });
});

describe('bracketFrame', () => {
    it('starts as big as the screen', () => {
        const frame = bracketFrame(center, 20, viewport, 0, config);
        expect(frame.size).toBeCloseTo(Math.max(viewport.width, viewport.height) * config.startScale);
    });

    it('ends at roughly the planet width (diameter times padding)', () => {
        const frame = bracketFrame(center, 40, viewport, 1, config);
        expect(frame.size).toBeCloseTo(40 * 2 * config.padding);
    });

    it('is always centered on the planet', () => {
        for (const closing of [0, 0.25, 0.5, 1]) {
            const frame = bracketFrame({ x: 300, y: 200 }, 40, viewport, closing, config);
            expect(frame.x + frame.size / 2).toBeCloseTo(300);
            expect(frame.y + frame.size / 2).toBeCloseTo(200);
        }
    });

    it('only shrinks while closing', () => {
        let previous = Infinity;
        for (let i = 0; i <= 20; i++) {
            const { size } = bracketFrame(center, 40, viewport, i / 20, config);
            expect(size).toBeLessThanOrEqual(previous);
            previous = size;
        }
    });

    it('a tiny or far planet still gets brackets of at least minSize', () => {
        expect(bracketFrame(center, 0.5, viewport, 1, config).size).toBe(config.minSize);
        expect(bracketFrame(center, 0, viewport, 1, config).size).toBe(config.minSize);
    });

    it('a planet bigger than the screen does not make the brackets grow while closing', () => {
        const start = bracketFrame(center, 2000, viewport, 0, config).size;
        const end = bracketFrame(center, 2000, viewport, 1, config).size;
        expect(end).toBeLessThanOrEqual(start);
    });
});

describe('searchSpread', () => {
    it('converts the bracket half size from pixels to world units at the planet distance', () => {
        expect(searchSpread(200, 1, 20)).toBeCloseTo(5);
    });

    it('shrinks as the brackets close', () => {
        expect(searchSpread(100, 1, 20)).toBeLessThan(searchSpread(800, 1, 20));
    });

    it('is 0 when the planet has no size on screen', () => {
        expect(searchSpread(200, 1, 0)).toBe(0);
        expect(searchSpread(200, 1, NaN)).toBe(0);
    });
});

describe('searchCoordinates', () => {
    const planet = { x: 10, y: 0, z: -5 };

    it('stays inside the searched area on every axis', () => {
        for (let tick = 0; tick < 200; tick++) {
            const point = searchCoordinates(planet, 3, tick);
            expect(Math.abs(point.x - planet.x)).toBeLessThanOrEqual(3);
            expect(Math.abs(point.y - planet.y)).toBeLessThanOrEqual(3);
            expect(Math.abs(point.z - planet.z)).toBeLessThanOrEqual(3);
        }
    });

    it('is not the exact planet position', () => {
        const point = searchCoordinates(planet, 3, 7);
        expect(formatCoordinates(point)).not.toBe(formatCoordinates(planet));
    });

    it('is the same within one tick and changes on the next tick', () => {
        expect(searchCoordinates(planet, 3, 4)).toEqual(searchCoordinates(planet, 3, 4));
        expect(searchCoordinates(planet, 3, 5)).not.toEqual(searchCoordinates(planet, 3, 4));
    });

    it('with no spread gives the exact position', () => {
        expect(searchCoordinates(planet, 0, 9)).toEqual(planet);
    });
});

describe('movementSpeed', () => {
    it('is distance divided by time', () => {
        expect(movementSpeed({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }, 0.5)).toBeCloseTo(10);
    });

    it('is 0 when nothing moved', () => {
        expect(movementSpeed({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 }, 0.016)).toBe(0);
    });

    it('is 0 instead of Infinity or NaN for zero, negative or NaN time', () => {
        const a = { x: 0, y: 0, z: 0 };
        const b = { x: 1, y: 0, z: 0 };
        expect(movementSpeed(a, b, 0)).toBe(0);
        expect(movementSpeed(a, b, -1)).toBe(0);
        expect(movementSpeed(a, b, NaN)).toBe(0);
    });
});

describe('smoothValue', () => {
    it('moves part of the way towards the new value', () => {
        expect(smoothValue(0, 10, 0.8)).toBeCloseTo(2);
    });

    it('smoothing 0 jumps straight to the new value, 1 never moves', () => {
        expect(smoothValue(5, 10, 0)).toBe(10);
        expect(smoothValue(5, 10, 1)).toBe(5);
    });

    it('converges to a constant input', () => {
        let value = 0;
        for (let i = 0; i < 200; i++) value = smoothValue(value, 3, 0.85);
        expect(value).toBeCloseTo(3, 6);
    });
});

describe('formatDelta', () => {
    it('prints two decimals with the delta sign and unit', () => {
        expect(formatDelta(0.4234)).toBe('Δ 0.42 u/s');
        expect(formatDelta(0)).toBe('Δ 0.00 u/s');
    });
});

describe('createLockBrackets', () => {
    function makeParts() {
        return { coordinates: fakeLabel(), delta: fakeLabel(), progress: { style: {} } };
    }

    const readout = (overrides = {}) => ({ coordinates: '[1.0, 2.0, 3.0]', delta: 'Δ 0.10 u/s', progress: 0.5, ...overrides });

    it('sets state, position and size on the element', () => {
        const element = fakeElement();
        createLockBrackets(element, makeParts()).show({ visibility: 'closing' }, { x: 10, y: 20, size: 100 }, readout());
        expect(element.dataset.state).toBe('closing');
        expect(element.style.transform).toBe('translate(10.0px, 20.0px)');
        expect(element.style.width).toBe('100.0px');
        expect(element.style.height).toBe('100.0px');
    });

    it('hides when the planet is off screen (no frame)', () => {
        const element = fakeElement();
        createLockBrackets(element, makeParts()).show({ visibility: 'locked' }, null, readout());
        expect(element.dataset.state).toBe('hidden');
    });

    it('does not touch the size when only the position changes', () => {
        const element = fakeElement();
        const brackets = createLockBrackets(element, makeParts());
        brackets.show({ visibility: 'locked' }, { x: 10, y: 20, size: 100 }, readout());
        element.style.width = 'untouched';
        brackets.show({ visibility: 'locked' }, { x: 11, y: 20, size: 100 }, readout());
        expect(element.style.width).toBe('untouched');
        expect(element.style.transform).toBe('translate(11.0px, 20.0px)');
    });

    it('keeps the last position and texts when hidden, so nothing jumps while fading', () => {
        const element = fakeElement();
        const parts = makeParts();
        const brackets = createLockBrackets(element, parts);
        brackets.show({ visibility: 'fading' }, { x: 10, y: 20, size: 100 }, readout());
        brackets.show({ visibility: 'hidden' }, null, readout({ coordinates: '[9.0, 9.0, 9.0]', delta: 'Δ 9.00 u/s' }));
        expect(element.style.transform).toBe('translate(10.0px, 20.0px)');
        expect(parts.coordinates.textContent).toBe('[1.0, 2.0, 3.0]');
        expect(parts.delta.textContent).toBe('Δ 0.10 u/s');
    });

    it('shows coordinates and speed and updates them live', () => {
        const parts = makeParts();
        const brackets = createLockBrackets(fakeElement(), parts);
        brackets.show({ visibility: 'closing' }, { x: 10, y: 20, size: 100 }, readout());
        brackets.show({ visibility: 'closing' }, { x: 10, y: 20, size: 90 }, readout({ coordinates: '[1.1, 2.0, 3.0]', delta: 'Δ 0.20 u/s' }));
        expect(parts.coordinates.textContent).toBe('[1.1, 2.0, 3.0]');
        expect(parts.delta.textContent).toBe('Δ 0.20 u/s');
    });

    it('does not rewrite texts that did not change', () => {
        const parts = makeParts();
        const brackets = createLockBrackets(fakeElement(), parts);
        for (let i = 0; i < 50; i++) brackets.show({ visibility: 'locked' }, { x: 10, y: 20, size: 100 }, readout());
        expect(parts.coordinates.writes).toBe(1);
        expect(parts.delta.writes).toBe(1);
    });

    it('fills the progress bar and clamps it to 0..1', () => {
        const parts = makeParts();
        const brackets = createLockBrackets(fakeElement(), parts);
        brackets.show({ visibility: 'closing' }, { x: 0, y: 0, size: 100 }, readout({ progress: 0.25 }));
        expect(parts.progress.style.transform).toBe('scaleX(0.250)');
        brackets.show({ visibility: 'locked' }, { x: 0, y: 0, size: 100 }, readout({ progress: 3 }));
        expect(parts.progress.style.transform).toBe('scaleX(1.000)');
        brackets.show({ visibility: 'closing' }, { x: 0, y: 0, size: 100 }, readout({ progress: -1 }));
        expect(parts.progress.style.transform).toBe('scaleX(0.000)');
    });
});
