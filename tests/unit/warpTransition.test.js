import { describe, it, expect, vi } from 'vitest';
import { warpOffset, warpSpeed, wrapCoordinate, createWarpTransition } from '../../src/camera/warpTransition.js';

const config = { distance: 60, accelerateDuration: 1.2, decelerateDuration: 1.8, minCruiseDuration: 0.6 };

describe('warpOffset', () => {
    it('starts at 0 and reaches the full distance when accelerating', () => {
        expect(warpOffset('accelerate', 0, 60)).toBe(0);
        expect(warpOffset('accelerate', 1, 60)).toBe(60);
    });

    it('starts on the other side and lands at 0 when decelerating', () => {
        expect(warpOffset('decelerate', 0, 60)).toBe(-60);
        expect(warpOffset('decelerate', 1, 60)).toBe(-0);
    });

    it('holds the distance while cruising and is 0 when idle', () => {
        expect(warpOffset('cruise', 0.3, 60)).toBe(60);
        expect(warpOffset('idle', 0.5, 60)).toBe(0);
    });

    it('clamps progress outside 0..1', () => {
        expect(warpOffset('accelerate', 2, 60)).toBe(60);
        expect(warpOffset('accelerate', -1, 60)).toBe(0);
    });
});

describe('warpSpeed', () => {
    it('ends acceleration at the cruise speed', () => {
        expect(warpSpeed('accelerate', 1, config)).toBeCloseTo(warpSpeed('cruise', 0, config));
    });

    it('is 0 at the start of acceleration, the end of deceleration and when idle', () => {
        expect(warpSpeed('accelerate', 0, config)).toBe(0);
        expect(warpSpeed('decelerate', 1, config)).toBe(0);
        expect(warpSpeed('idle', 0, config)).toBe(0);
    });
});

describe('wrapCoordinate', () => {
    it('keeps values inside the range untouched', () => {
        expect(wrapCoordinate(3, 10)).toBe(3);
    });

    it('wraps values that left on the left to the right side', () => {
        expect(wrapCoordinate(-12, 10)).toBeCloseTo(8);
    });

    it('wraps values far outside the range', () => {
        expect(wrapCoordinate(-55, 10)).toBeCloseTo(5);
        expect(wrapCoordinate(31, 10)).toBeCloseTo(-9);
    });
});

describe('createWarpTransition', () => {
    it('goes through accelerate, cruise and decelerate, calling callbacks once', () => {
        const warp = createWarpTransition(config);
        const onCruise = vi.fn();
        const onDone = vi.fn();
        warp.start({ onCruise, onDone });
        expect(warp.phase).toBe('accelerate');

        warp.update(config.accelerateDuration);
        expect(warp.phase).toBe('cruise');
        expect(onCruise).toHaveBeenCalledTimes(1);

        warp.arrive();
        warp.update(config.minCruiseDuration);
        expect(warp.phase).toBe('decelerate');

        warp.update(config.decelerateDuration);
        expect(warp.phase).toBe('idle');
        expect(warp.active).toBe(false);
        expect(onCruise).toHaveBeenCalledTimes(1);
        expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('keeps cruising until the new system arrives', () => {
        const warp = createWarpTransition(config);
        warp.start();
        warp.update(config.accelerateDuration);
        warp.update(10);
        expect(warp.phase).toBe('cruise');
    });

    it('cruises at least the minimum time even if loading was instant', () => {
        const warp = createWarpTransition(config);
        warp.start({ onCruise: () => warp.arrive() });
        warp.update(config.accelerateDuration);
        warp.update(config.minCruiseDuration / 2);
        expect(warp.phase).toBe('cruise');
    });

    it('ignores start while already active', () => {
        const warp = createWarpTransition(config);
        const first = vi.fn();
        const second = vi.fn();
        warp.start({ onCruise: first });
        warp.start({ onCruise: second });
        warp.update(config.accelerateDuration);
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).not.toHaveBeenCalled();
    });

    it('reports full intensity while cruising and none when idle', () => {
        const warp = createWarpTransition(config);
        expect(warp.update(0.1).intensity).toBe(0);
        warp.start();
        warp.update(config.accelerateDuration);
        expect(warp.update(0.1).intensity).toBe(1);
    });
});
