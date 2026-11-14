import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createCameraRig, easeInOutCubic, jitterNoise, lockWobbleOffset, nextPlanetIndex } from '../../src/camera/cameraRig.js';
import { camera as cameraConfig } from '../../src/config/settings.js';

const FLY = cameraConfig.fly.duration;
const BAR = cameraConfig.fly.barDuration;
const { lockDuration: LOCK, holdDuration: HOLD, zoomDuration: ZOOM, outDuration: FOCUS_OUT } = cameraConfig.focus;
const FOCUS_IN = LOCK + HOLD + ZOOM;
const HOME = new THREE.Vector3().copy(cameraConfig.position.start);

function makeBody(x, z = 0, isMoon = false) {
    const mesh = new THREE.Object3D();
    mesh.position.set(x, 0, z);
    mesh.updateMatrixWorld(true);
    return { mesh, isMoon };
}

function makeSunSystem() {
    return [
        makeBody(0),
        makeBody(3),
        makeBody(-9),
        makeBody(-10, 0, true),
        makeBody(17),
        makeBody(-24),
    ];
}

function setup(bodies = makeSunSystem()) {
    const camera = new THREE.PerspectiveCamera(cameraConfig.fov.default, 1, 1, 1000);
    const controls = { target: new THREE.Vector3(), enabled: false, update: vi.fn() };
    const changes = [];
    const rig = createCameraRig({ camera, controls, config: cameraConfig, onChange: (e) => changes.push(e.mode) });
    rig.setBodies(bodies);
    changes.length = 0;
    return { rig, camera, controls, bodies, changes };
}

function run(rig, seconds, step = 1 / 60) {
    let t = 0;
    while (t < seconds - 1e-9) {
        const dt = Math.min(step, seconds - t);
        rig.update(dt);
        t += dt;
    }
}

function looksAt(camera, point) {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const expected = point.clone().sub(camera.position).normalize();
    return direction.dot(expected);
}

describe('easeInOutCubic', () => {
    it('starts at 0, ends at 1 and is 0.5 in the middle', () => {
        expect(easeInOutCubic(0)).toBe(0);
        expect(easeInOutCubic(1)).toBe(1);
        expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    });

    it('clamps values outside 0..1', () => {
        expect(easeInOutCubic(-3)).toBe(0);
        expect(easeInOutCubic(7)).toBe(1);
    });

    it('never goes backwards', () => {
        let previous = 0;
        for (let i = 1; i <= 100; i++) {
            const value = easeInOutCubic(i / 100);
            expect(value).toBeGreaterThanOrEqual(previous);
            previous = value;
        }
    });
});

describe('lockWobbleOffset', () => {
    const wobble = { amplitude: 0.2, frequency: 3 };
    const total = 1;

    it('is exactly zero at the start and at the end (no jump in or out)', () => {
        expect(lockWobbleOffset(0, total, wobble)).toEqual({ x: 0, y: 0 });
        expect(lockWobbleOffset(total, total, wobble)).toEqual({ x: 0, y: 0 });
        expect(lockWobbleOffset(total + 5, total, wobble)).toEqual({ x: 0, y: 0 });
    });

    it('is zero for negative time and for a zero-length phase', () => {
        expect(lockWobbleOffset(-1, total, wobble)).toEqual({ x: 0, y: 0 });
        expect(lockWobbleOffset(0.5, 0, wobble)).toEqual({ x: 0, y: 0 });
    });

    it('never exceeds the amplitude', () => {
        for (let t = 0; t <= total; t += 0.001) {
            const { x, y } = lockWobbleOffset(t, total, wobble);
            expect(Math.abs(x)).toBeLessThanOrEqual(wobble.amplitude);
            expect(Math.abs(y)).toBeLessThanOrEqual(wobble.amplitude);
        }
    });

    it('actually moves in the middle of the phase', () => {
        let max = 0;
        for (let t = 0; t <= total; t += 0.01) {
            const { x, y } = lockWobbleOffset(t, total, wobble);
            max = Math.max(max, Math.abs(x), Math.abs(y));
        }
        expect(max).toBeGreaterThan(wobble.amplitude / 4);
    });

    it('dies down: the second half shakes less than the first', () => {
        const peak = (from, to) => {
            let max = 0;
            for (let t = from; t <= to; t += 0.001) {
                const { x, y } = lockWobbleOffset(t, total, wobble);
                max = Math.max(max, Math.abs(x), Math.abs(y));
            }
            return max;
        };
        expect(peak(0.5, 1)).toBeLessThan(peak(0, 0.5));
    });

    it('jumps in steps: inside one tick only the fade changes, the direction stays', () => {
        const tick = 1 / wobble.frequency;
        const normalized = (t) => lockWobbleOffset(t, total, wobble).x / (wobble.amplitude * (1 - t / total));
        expect(tick * 2.1).toBeLessThan(total);
        expect(normalized(tick * 1.1)).toBeCloseTo(normalized(tick * 1.9), 9);
        expect(normalized(tick * 2.1)).not.toBeCloseTo(normalized(tick * 1.9), 3);
    });

    it('is the same for the same time (deterministic)', () => {
        expect(lockWobbleOffset(0.37, total, wobble)).toEqual(lockWobbleOffset(0.37, total, wobble));
    });

    it('zero amplitude means no wobble', () => {
        expect(lockWobbleOffset(0.3, total, { amplitude: 0, frequency: 3 })).toEqual({ x: 0, y: 0 });
    });
});

describe('jitterNoise', () => {
    it('stays inside -1..1 and is deterministic', () => {
        for (let n = -500; n <= 500; n++) {
            const value = jitterNoise(n);
            expect(value).toBeGreaterThanOrEqual(-1);
            expect(value).toBeLessThanOrEqual(1);
            expect(jitterNoise(n)).toBe(value);
        }
    });

    it('neighbouring ticks give different values', () => {
        const values = new Set(Array.from({ length: 50 }, (_, n) => jitterNoise(n).toFixed(6)));
        expect(values.size).toBeGreaterThan(45);
    });
});

describe('nextPlanetIndex', () => {
    const sun = makeSunSystem();

    it('from the center goes to the first planet', () => {
        expect(nextPlanetIndex(sun, 0)).toBe(1);
    });

    it('skips moons', () => {
        expect(nextPlanetIndex(sun, 2)).toBe(4);
    });

    it('wraps from the last planet to the first, skipping the center', () => {
        expect(nextPlanetIndex(sun, 5)).toBe(1);
    });

    it('skips a run of several moons (pyrox blobs)', () => {
        const blackhole = [makeBody(0), makeBody(1), makeBody(2, 0, true), makeBody(3, 0, true), makeBody(4, 0, true), makeBody(5)];
        expect(nextPlanetIndex(blackhole, 1)).toBe(5);
    });

    it('returns 0 when the system has only the center and moons', () => {
        expect(nextPlanetIndex([makeBody(0), makeBody(1, 0, true)], 0)).toBe(0);
    });
});

describe('setBodies', () => {
    it('starts in overview at home with default fov and enabled controls', () => {
        const { rig, camera, controls } = setup();
        expect(rig.mode).toBe('overview');
        expect(rig.targetIndex).toBe(0);
        expect(rig.isBusy()).toBe(false);
        expect(camera.position.equals(HOME)).toBe(true);
        expect(camera.fov).toBe(cameraConfig.fov.default);
        expect(controls.enabled).toBe(true);
    });

    it('resets everything when called in the middle of a flight (system switch)', () => {
        const { rig, camera, controls } = setup();
        rig.select(4);
        run(rig, FLY / 2);
        rig.setBodies(makeSunSystem());
        expect(rig.mode).toBe('overview');
        expect(rig.isBusy()).toBe(false);
        expect(camera.position.equals(HOME)).toBe(true);
        expect(controls.enabled).toBe(true);
    });

    it('resets a focused camera back to default fov', () => {
        const { rig, camera } = setup();
        rig.select(1);
        run(rig, FLY);
        rig.setFocus(true);
        run(rig, FOCUS_IN);
        rig.setBodies(makeSunSystem());
        expect(camera.fov).toBe(cameraConfig.fov.default);
    });
});

describe('overview', () => {
    it('drives the orbit controls around the center with the frame time', () => {
        const { rig, controls } = setup();
        rig.update(0.016);
        expect(controls.update).toHaveBeenCalledWith(0.016);
        expect(controls.target.toArray()).toEqual([0, 0, 0]);
    });

    it('showOverview while already in overview is ignored', () => {
        const { rig, changes } = setup();
        expect(rig.showOverview()).toBe(false);
        expect(changes).toEqual([]);
    });

    it('focus is not possible while orbiting the center', () => {
        const { rig } = setup();
        expect(rig.setFocus(true)).toBe(false);
        expect(rig.mode).toBe('overview');
    });
});

describe('select: flying to a planet', () => {
    it('goes travel -> follow and reports both changes', () => {
        const { rig, changes } = setup();
        expect(rig.select(1)).toBe(true);
        expect(rig.isBusy()).toBe(true);
        run(rig, FLY);
        expect(rig.mode).toBe('follow');
        expect(changes).toEqual(['travel', 'follow']);
    });

    it('disables orbit controls during the flight and while following', () => {
        const { rig, controls } = setup();
        rig.select(1);
        expect(controls.enabled).toBe(false);
        run(rig, FLY);
        expect(controls.enabled).toBe(false);
    });

    it('returns the camera smoothly to home when leaving the orbit', () => {
        const { rig, camera } = setup();
        camera.position.set(30, 5, 0);
        const startDistance = camera.position.distanceTo(HOME);
        rig.select(1);
        run(rig, FLY / 2);
        const midDistance = camera.position.distanceTo(HOME);
        expect(midDistance).toBeGreaterThan(0);
        expect(midDistance).toBeLessThan(startDistance);
        run(rig, FLY / 2);
        expect(camera.position.distanceTo(HOME)).toBeLessThan(1e-9);
    });

    it('ends looking exactly at the target, even if the target moved during the flight', () => {
        const { rig, camera, bodies } = setup();
        rig.select(4);
        run(rig, FLY / 2);
        bodies[4].mesh.position.set(0, 0, 17);
        bodies[4].mesh.updateMatrixWorld(true);
        run(rig, FLY / 2);
        expect(looksAt(camera, new THREE.Vector3(0, 0, 17))).toBeCloseTo(1, 6);
    });

    it('keeps following a moving planet after arriving', () => {
        const { rig, camera, bodies } = setup();
        rig.select(1);
        run(rig, FLY);
        bodies[1].mesh.position.set(0, 0, -3);
        bodies[1].mesh.updateMatrixWorld(true);
        rig.update(1 / 60);
        expect(looksAt(camera, new THREE.Vector3(0, 0, -3))).toBeCloseTo(1, 6);
        expect(camera.position.distanceTo(HOME)).toBeLessThan(1e-9);
    });

    it('a fast (planet bar) flight finishes sooner than a normal one', () => {
        const { rig } = setup();
        rig.select(1, { fast: true });
        run(rig, BAR);
        expect(rig.mode).toBe('follow');
    });

    it('a normal flight is still busy after the fast duration', () => {
        const { rig } = setup();
        rig.select(1);
        run(rig, BAR);
        expect(rig.isBusy()).toBe(true);
    });

    it('one huge dt finishes the flight without overshooting', () => {
        const { rig, camera } = setup();
        camera.position.set(30, 5, 0);
        rig.select(1);
        rig.update(100);
        expect(rig.mode).toBe('follow');
        expect(camera.position.distanceTo(HOME)).toBeLessThan(1e-9);
    });

    it('dt of 0 does not advance the flight', () => {
        const { rig, camera } = setup();
        camera.position.set(30, 5, 0);
        rig.select(1);
        rig.update(0);
        expect(camera.position.toArray()).toEqual([30, 5, 0]);
        expect(rig.isBusy()).toBe(true);
    });
});

describe('select: what gets ignored', () => {
    it('a second select during a flight is ignored', () => {
        const { rig } = setup();
        rig.select(1);
        expect(rig.select(4)).toBe(false);
        run(rig, FLY);
        expect(rig.targetIndex).toBe(1);
    });

    it('a moon cannot be selected', () => {
        const { rig, changes } = setup();
        expect(rig.select(3)).toBe(false);
        expect(changes).toEqual([]);
    });

    it('an index outside the system is ignored', () => {
        const { rig } = setup();
        expect(rig.select(99)).toBe(false);
        expect(rig.select(-1)).toBe(false);
    });

    it('selecting the planet that is already followed does nothing', () => {
        const { rig, changes } = setup();
        rig.select(1);
        run(rig, FLY);
        changes.length = 0;
        expect(rig.select(1)).toBe(false);
        expect(changes).toEqual([]);
    });

    it('select(0) from a planet flies back to the orbit around the center', () => {
        const { rig, controls } = setup();
        rig.select(1);
        run(rig, FLY);
        expect(rig.select(0)).toBe(true);
        run(rig, FLY);
        expect(rig.mode).toBe('overview');
        expect(rig.targetIndex).toBe(0);
        expect(controls.enabled).toBe(true);
    });
});

describe('focus', () => {
    function following() {
        const ctx = setup();
        ctx.rig.select(1);
        run(ctx.rig, FLY);
        ctx.changes.length = 0;
        return ctx;
    }

    function focused() {
        const ctx = following();
        ctx.rig.setFocus(true);
        run(ctx.rig, FOCUS_IN);
        ctx.changes.length = 0;
        return ctx;
    }

    it('zooms in through three phases: lock -> hold -> zoom -> focused', () => {
        const { rig, camera, changes } = following();
        expect(rig.setFocus(true)).toBe(true);
        expect(rig.isBusy()).toBe(true);
        run(rig, FOCUS_IN);
        expect(changes).toEqual(['focusLock', 'focusHold', 'focusZoom', 'focused']);
        expect(camera.fov).toBeCloseTo(cameraConfig.fov.min);
        expect(rig.isBusy()).toBe(false);
    });

    it('the lock phase ends exactly at the lock fov', () => {
        const { rig, camera } = following();
        rig.setFocus(true);
        run(rig, LOCK);
        expect(rig.mode).toBe('focusHold');
        expect(camera.fov).toBeCloseTo(cameraConfig.fov.lock);
    });

    it('fov does not change during the hold phase (the "step")', () => {
        const { rig, camera } = following();
        rig.setFocus(true);
        run(rig, LOCK);
        const held = camera.fov;
        run(rig, HOLD * 0.9);
        expect(rig.mode).toBe('focusHold');
        expect(camera.fov).toBe(held);
    });

    it('fov moves gradually inside the lock phase', () => {
        const { rig, camera } = following();
        rig.setFocus(true);
        run(rig, LOCK / 2);
        expect(camera.fov).toBeLessThan(cameraConfig.fov.default);
        expect(camera.fov).toBeGreaterThan(cameraConfig.fov.lock);
    });

    it('wobbles around the planet while locking in and is steady again when zooming starts', () => {
        const { rig, camera, bodies } = following();
        const target = bodies[1].mesh.getWorldPosition(new THREE.Vector3());
        rig.setFocus(true);
        let lowest = 1;
        const step = 1 / 60;
        for (let t = 0; t < LOCK + HOLD - step; t += step) {
            rig.update(step);
            lowest = Math.min(lowest, looksAt(camera, target));
        }
        expect(lowest).toBeLessThan(1 - 1e-6);
        run(rig, step * 2);
        expect(rig.mode).toBe('focusZoom');
        expect(looksAt(camera, target)).toBeCloseTo(1, 9);
    });

    it('the hold phase is steady (the target is locked, no more wobble)', () => {
        const { rig, camera, bodies } = following();
        const target = bodies[1].mesh.getWorldPosition(new THREE.Vector3());
        rig.setFocus(true);
        run(rig, LOCK);
        expect(rig.mode).toBe('focusHold');
        for (let i = 0; i < 10; i++) {
            rig.update(HOLD / 20);
            expect(looksAt(camera, target)).toBeCloseTo(1, 9);
        }
    });

    it('phaseProgress goes from 0 to 1 during locking in', () => {
        const { rig } = following();
        rig.setFocus(true);
        expect(rig.phaseProgress).toBe(0);
        run(rig, LOCK / 2);
        expect(rig.phaseProgress).toBeGreaterThan(0.4);
        expect(rig.phaseProgress).toBeLessThan(0.6);
    });

    it('isFocused is true for every zoom-in phase and while focused, false while zooming out', () => {
        const { rig } = following();
        expect(rig.isFocused()).toBe(false);
        rig.setFocus(true);
        expect(rig.isFocused()).toBe(true);
        run(rig, LOCK);
        expect(rig.isFocused()).toBe(true);
        run(rig, HOLD + ZOOM);
        expect(rig.isFocused()).toBe(true);
        rig.setFocus(false);
        expect(rig.isFocused()).toBe(false);
    });

    it('zooms back out: focusOut -> follow with default fov', () => {
        const { rig, camera, changes } = focused();
        expect(rig.setFocus(false)).toBe(true);
        run(rig, FOCUS_OUT);
        expect(camera.fov).toBeCloseTo(cameraConfig.fov.default);
        expect(changes).toEqual(['focusOut', 'follow']);
    });

    it('runs the then callback once the zoom-out finishes', () => {
        const { rig } = focused();
        const then = vi.fn();
        expect(rig.setFocus(false, { then })).toBe(true);
        expect(then).not.toHaveBeenCalled();
        run(rig, FOCUS_OUT);
        expect(rig.mode).toBe('follow');
        expect(then).toHaveBeenCalledTimes(1);
    });

    it('focus requests in any busy phase are ignored', () => {
        const { rig } = following();
        rig.setFocus(true);
        expect(rig.setFocus(false)).toBe(false);
        run(rig, LOCK);
        expect(rig.mode).toBe('focusHold');
        expect(rig.setFocus(false)).toBe(false);
        expect(rig.select(4)).toBe(false);
    });

    it('asking for the state it is already in is ignored', () => {
        const { rig } = following();
        expect(rig.setFocus(false)).toBe(false);
        rig.setFocus(true);
        run(rig, FOCUS_IN);
        expect(rig.setFocus(true)).toBe(false);
    });

    it('selecting another planet while focused: zoom out, fly, zoom in again on the new planet', () => {
        const { rig, camera, changes } = focused();
        expect(rig.select(4)).toBe(true);
        expect(rig.mode).toBe('focusOut');
        run(rig, FOCUS_OUT);
        expect(rig.mode).toBe('travel');
        expect(rig.targetIndex).toBe(4);
        run(rig, FLY);
        expect(rig.mode).toBe('focusLock');
        run(rig, FOCUS_IN);
        expect(changes).toEqual(['focusOut', 'follow', 'travel', 'follow', 'focusLock', 'focusHold', 'focusZoom', 'focused']);
        expect(camera.fov).toBeCloseTo(cameraConfig.fov.min);
    });

    it('next planet while focused refocuses too (planet bar fast flight)', () => {
        const { rig, camera } = focused();
        rig.select(nextPlanetIndex(makeSunSystem(), rig.targetIndex), { fast: true });
        run(rig, FOCUS_OUT + BAR + FOCUS_IN);
        expect(rig.mode).toBe('focused');
        expect(rig.targetIndex).toBe(2);
        expect(camera.fov).toBeCloseTo(cameraConfig.fov.min);
    });

    it('refocusing is true only during the flight that will zoom in on arrival', () => {
        const { rig } = focused();
        expect(rig.refocusing).toBe(false);
        rig.select(4);
        expect(rig.refocusing).toBe(false);
        run(rig, FOCUS_OUT);
        expect(rig.mode).toBe('travel');
        expect(rig.refocusing).toBe(true);
        run(rig, FLY);
        expect(rig.refocusing).toBe(false);
    });

    it('a normal flight is not refocusing', () => {
        const { rig } = following();
        rig.select(4);
        expect(rig.refocusing).toBe(false);
    });

    it('a normal flight (not focused) does not zoom in on arrival', () => {
        const { rig } = following();
        rig.select(4);
        run(rig, FLY + FOCUS_IN);
        expect(rig.mode).toBe('follow');
    });

    it('going to the overview while focused zooms out and orbits, without zooming in again', () => {
        const { rig, changes } = focused();
        expect(rig.showOverview()).toBe(true);
        run(rig, FOCUS_OUT + FLY + FOCUS_IN);
        expect(changes).toEqual(['focusOut', 'follow', 'travel', 'overview']);
    });

    it('a manual zoom out does not start any flight', () => {
        const { rig } = focused();
        rig.setFocus(false);
        run(rig, FOCUS_OUT + FLY);
        expect(rig.mode).toBe('follow');
        expect(rig.targetIndex).toBe(1);
    });

    it('a system switch during the refocus chain drops the pending zoom', () => {
        const { rig } = focused();
        rig.select(4);
        run(rig, FOCUS_OUT + FLY / 2);
        rig.setBodies(makeSunSystem());
        run(rig, FLY + FOCUS_IN);
        expect(rig.mode).toBe('overview');
    });
});

describe('update without bodies', () => {
    it('does nothing and does not throw', () => {
        const camera = new THREE.PerspectiveCamera();
        const controls = { target: new THREE.Vector3(), enabled: true, update: vi.fn() };
        const rig = createCameraRig({ camera, controls, config: cameraConfig });
        expect(() => rig.update(1)).not.toThrow();
        expect(controls.update).not.toHaveBeenCalled();
    });
});
