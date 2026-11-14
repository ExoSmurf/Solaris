import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pickOnScreen, isClickGesture, createTargetReticle, cursorAction } from '../../src/ui/targetReticle.js';

const hitConfig = { minHitRadius: 28, hitScale: 1.6 };

describe('pickOnScreen', () => {
    it('hits a planet a bit outside its own radius', () => {
        const candidates = [{ index: 2, x: 100, y: 100, radius: 20 }];
        expect(pickOnScreen({ x: 130, y: 100 }, candidates, hitConfig)).toBe(2);
    });

    it('uses the minimum radius for tiny planets', () => {
        const candidates = [{ index: 1, x: 100, y: 100, radius: 2 }];
        expect(pickOnScreen({ x: 125, y: 100 }, candidates, hitConfig)).toBe(1);
        expect(pickOnScreen({ x: 130, y: 100 }, candidates, hitConfig)).toBe(-1);
    });

    it('picks the planet closest to the cursor when hit areas overlap', () => {
        const candidates = [
            { index: 1, x: 100, y: 100, radius: 30 },
            { index: 3, x: 140, y: 100, radius: 30 },
        ];
        expect(pickOnScreen({ x: 125, y: 100 }, candidates, hitConfig)).toBe(3);
    });

    it('returns -1 when nothing is near', () => {
        expect(pickOnScreen({ x: 0, y: 0 }, [{ index: 1, x: 500, y: 500, radius: 10 }], hitConfig)).toBe(-1);
    });
});

describe('isClickGesture', () => {
    it('accepts a press and release within the tolerance', () => {
        expect(isClickGesture({ x: 10, y: 10 }, { x: 13, y: 14 }, 6)).toBe(true);
    });

    it('rejects a drag', () => {
        expect(isClickGesture({ x: 10, y: 10 }, { x: 40, y: 10 }, 6)).toBe(false);
    });

    it('rejects a release without a press', () => {
        expect(isClickGesture(null, { x: 0, y: 0 }, 6)).toBe(false);
    });
});

describe('createTargetReticle', () => {
    const config = { scrambleDuration: 0.3, scrambleDelay: 0.5 };
    const frame = { x: 10, y: 20, size: 50 };
    let element;
    let name;
    let scrambler;

    beforeEach(() => {
        element = { dataset: {}, style: {} };
        name = { textContent: '' };
        scrambler = { reveal: vi.fn(), cancel: vi.fn() };
    });

    it('shows the frame and scrambles a new name only once', () => {
        const reticle = createTargetReticle(element, { name }, scrambler, config);
        reticle.hover(frame, 'Earth');
        reticle.hover(frame, 'Earth');
        expect(element.dataset.state).toBe('hover');
        expect(element.style.width).toBe('50.0px');
        expect(name.textContent).toBe('Earth');
        expect(scrambler.reveal).toHaveBeenCalledTimes(1);
        expect(scrambler.reveal).toHaveBeenCalledWith([name], 0.3, 0.5);
    });

    it('hides and cancels the scramble', () => {
        const reticle = createTargetReticle(element, { name }, scrambler, config);
        reticle.hover(frame, 'Earth');
        reticle.hide();
        expect(element.dataset.state).toBe('hidden');
        expect(scrambler.cancel).toHaveBeenCalled();
    });
});

describe('cursorAction', () => {
    it('targets when hovering a planet', () => {
        expect(cursorAction('follow', true, true)).toBe('target');
    });

    it('offers zoom in while locked and zoom out while zoomed', () => {
        expect(cursorAction('follow', false, true)).toBe('zoom-in');
        expect(cursorAction('focused', false, true)).toBe('zoom-out');
    });

    it('does nothing in the overview or while the camera is busy', () => {
        expect(cursorAction('overview', false, true)).toBe('none');
        expect(cursorAction('follow', true, false)).toBe('none');
    });
});
