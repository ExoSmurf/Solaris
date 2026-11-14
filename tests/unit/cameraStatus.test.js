import { describe, it, expect } from 'vitest';
import { cameraStatus, createCameraStatus } from '../../src/ui/cameraStatus.js';

const PLANET = 2;
const CENTER = 0;

function fakeElement() {
    let text = '';
    const element = {
        writes: 0,
        dataset: {},
        get textContent() {
            return text;
        },
        set textContent(value) {
            text = value;
            element.writes++;
        },
    };
    return element;
}

describe('cameraStatus', () => {
    it('travel to a planet shows "searching..."', () => {
        expect(cameraStatus('travel', PLANET)).toEqual({ text: 'searching...', visibility: 'visible' });
    });

    it('travel back to the center (sun) shows nothing', () => {
        expect(cameraStatus('travel', CENTER).visibility).toBe('hidden');
    });

    it('lock and hold phases show "locking in..." without coordinates', () => {
        for (const mode of ['focusLock', 'focusHold']) {
            expect(cameraStatus(mode, PLANET)).toEqual({ text: 'locking in...', visibility: 'visible' });
        }
    });

    it('zoom phase shows "zooming..." without the planet name', () => {
        expect(cameraStatus('focusZoom', PLANET)).toEqual({ text: 'zooming...', visibility: 'visible' });
    });

    it('once focused the last text fades out', () => {
        expect(cameraStatus('focused', PLANET)).toEqual({ text: 'zooming...', visibility: 'fading' });
    });

    it('zooming out, following and orbiting show nothing', () => {
        for (const mode of ['focusOut', 'follow', 'overview']) {
            expect(cameraStatus(mode, PLANET).visibility, mode).toBe('hidden');
        }
    });

    it('an unknown mode shows nothing', () => {
        expect(cameraStatus('somethingElse', PLANET).visibility).toBe('hidden');
    });
});

describe('createCameraStatus', () => {
    it('writes text and state on the element', () => {
        const element = fakeElement();
        createCameraStatus(element).show({ text: 'searching...', visibility: 'visible' });
        expect(element.textContent).toBe('searching...');
        expect(element.dataset.state).toBe('visible');
    });

    it('does not rewrite the same text every frame', () => {
        const element = fakeElement();
        const status = createCameraStatus(element);
        for (let i = 0; i < 100; i++) status.show({ text: 'searching...', visibility: 'visible' });
        expect(element.writes).toBe(1);
    });

    it('hiding keeps the last text so the box does not flash empty', () => {
        const element = fakeElement();
        const status = createCameraStatus(element);
        status.show({ text: 'zooming...', visibility: 'fading' });
        status.show({ text: '', visibility: 'hidden' });
        expect(element.textContent).toBe('zooming...');
        expect(element.dataset.state).toBe('hidden');
    });

    it('fading keeps showing the final text while it disappears', () => {
        const element = fakeElement();
        const status = createCameraStatus(element);
        status.show({ text: 'zooming...', visibility: 'visible' });
        status.show({ text: 'zooming...', visibility: 'fading' });
        expect(element.textContent).toBe('zooming...');
        expect(element.dataset.state).toBe('fading');
    });
});
