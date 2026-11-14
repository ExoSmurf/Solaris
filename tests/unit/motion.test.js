import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { advance, applyWobbles, framesBetween } from '../../src/motion/motion.js';
import { CelestialBody } from '../../src/world/body.js';
import { systems } from '../../src/config/systems.js';

const makeMesh = () => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
const sunBody = (id) => systems.sun.bodies.find((b) => b.id === id);
const bhBody = (id) => systems.blackhole.bodies.find((b) => b.id === id);

describe('framesBetween', () => {
    it('one 60 FPS frame is about 1 frame', () => {
        expect(framesBetween(1000 / 60, 6)).toBeCloseTo(1);
    });

    it('a 120 Hz frame is about half a frame', () => {
        expect(framesBetween(1000 / 120, 6)).toBeCloseTo(0.5);
    });

    it('zero elapsed time is zero frames', () => {
        expect(framesBetween(0, 6)).toBe(0);
    });

    it('negative elapsed time (clock went backwards) is zero frames', () => {
        expect(framesBetween(-50, 6)).toBe(0);
    });

    it('NaN elapsed time is zero frames', () => {
        expect(framesBetween(NaN, 6)).toBe(0);
    });

    it('a long pause (tab hidden) is capped to maxFrames', () => {
        expect(framesBetween(60_000, 6)).toBe(6);
    });
});

describe('advance: spin and orbit scale with frames', () => {
    it('one step of 6 frames equals six steps of 1 frame', () => {
        const a = new CelestialBody(sunBody('venus'), makeMesh());
        const b = new CelestialBody(sunBody('venus'), makeMesh());
        advance(a, 6);
        for (let i = 0; i < 6; i++) advance(b, 1);
        expect(a.mesh.rotation.y).toBeCloseTo(b.mesh.rotation.y, 12);
        expect(a.pivot.rotation.y).toBeCloseTo(b.pivot.rotation.y, 12);
    });

    it('a fractional frame moves proportionally', () => {
        const body = new CelestialBody({ id: 'x', spin: 0.1 }, makeMesh());
        advance(body, 0.5);
        expect(body.mesh.rotation.y).toBeCloseTo(0.05);
    });

    it('zero frames change nothing', () => {
        const body = new CelestialBody({ id: 'x', spin: 0.1, orbit: { speed: 0.1 } }, makeMesh());
        advance(body, 0);
        expect(body.mesh.rotation.y).toBe(0);
        expect(body.pivot.rotation.y).toBe(0);
    });

    it('a body with no orbit has no pivot movement', () => {
        const body = new CelestialBody({ id: 'x', spin: 0 }, makeMesh());
        expect(() => advance(body, 3)).not.toThrow();
        expect(body.pivot).toBeNull();
    });
});

describe('applyWobbles: bounded oscillation', () => {
    const earthBodies = () => {
        const earth = new CelestialBody(sunBody('earth'), makeMesh());
        const moon = new CelestialBody(sunBody('moon'), makeMesh());
        return { earth, moon, bodies: [earth, moon] };
    };

    it('starts moving in the positive direction', () => {
        const { earth, bodies } = earthBodies();
        applyWobbles(bodies, 1);
        expect(earth.mesh.rotation.x).toBeCloseTo(0.002);
    });

    it('turns around once it passes the limit and never leaves the band', () => {
        const { earth, bodies } = earthBodies();
        let max = -Infinity;
        let min = Infinity;
        for (let i = 0; i < 5000; i++) {
            applyWobbles(bodies, 1);
            max = Math.max(max, earth.mesh.rotation.x);
            min = Math.min(min, earth.mesh.rotation.x);
        }
        expect(max).toBeLessThanOrEqual(0.5 + 0.002 + 1e-9);
        expect(min).toBeGreaterThanOrEqual(-0.5 - 0.002 - 1e-9);
        expect(max).toBeGreaterThan(0.49);
        expect(min).toBeLessThan(-0.49);
    });

    it('stays bounded when frames are large (6 per tick)', () => {
        const { earth, bodies } = earthBodies();
        let max = -Infinity;
        for (let i = 0; i < 1000; i++) {
            applyWobbles(bodies, 6);
            max = Math.max(max, Math.abs(earth.mesh.rotation.x));
        }
        expect(max).toBeLessThanOrEqual(0.5 + 6 * 0.002 + 1e-9);
    });

    it('the moon follows: x decreases while earth goes down, y increases while earth goes up', () => {
        const { earth, moon, bodies } = earthBodies();
        const startX = moon.mesh.rotation.x;
        const startY = moon.mesh.rotation.y;
        for (let i = 0; i < 200; i++) applyWobbles(bodies, 1);
        expect(earth.wobbleDown).toBe(false);
        expect(moon.mesh.rotation.y).toBeGreaterThan(startY);
        expect(moon.mesh.rotation.x).toBeLessThan(startX + 1e-9);
    });

    it('a body without wobble config is never moved by applyWobbles', () => {
        const venus = new CelestialBody(sunBody('venus'), makeMesh());
        const before = venus.mesh.rotation.toArray();
        applyWobbles([venus], 1);
        expect(venus.mesh.rotation.toArray()).toEqual(before);
    });

    it('a body with a wobble but no followers only moves itself', () => {
        const saturn = new CelestialBody(sunBody('saturn'), makeMesh());
        applyWobbles([saturn], 1);
        expect(saturn.mesh.rotation.y).toBe(0);
        expect(saturn.mesh.rotation.z).toBe(0);
    });

    it('saturn stays inside its own 0.7 limit', () => {
        const saturn = new CelestialBody(sunBody('saturn'), makeMesh());
        let max = 0;
        let min = 0;
        for (let i = 0; i < 5000; i++) {
            applyWobbles([saturn], 1);
            max = Math.max(max, saturn.mesh.rotation.x);
            min = Math.min(min, saturn.mesh.rotation.x);
        }
        expect(max).toBeLessThanOrEqual(0.7 + 0.002 + 1e-9);
        expect(min).toBeGreaterThanOrEqual(-0.7 - 0.002 - 1e-9);
    });
});

describe('applyWobbles: black hole system', () => {
    it('pyrox blobs only move in the negative x direction (they follow pyrox going down)', () => {
        const pyrox = new CelestialBody(bhBody('pyrox'), makeMesh());
        const blobs = ['pyroxBlob1', 'pyroxBlob2', 'pyroxBlob3', 'pyroxBlob4'].map((id) => new CelestialBody(bhBody(id), makeMesh()));
        const bodies = [pyrox, ...blobs];
        let previous = blobs.map((b) => b.mesh.rotation.x);
        for (let i = 0; i < 3000; i++) {
            applyWobbles(bodies, 1);
            const now = blobs.map((b) => b.mesh.rotation.x);
            for (let k = 0; k < blobs.length; k++) {
                expect(now[k]).toBeLessThanOrEqual(previous[k] + 1e-12);
            }
            previous = now;
        }
    });

    it('pyrox stays inside its 0.5 limit', () => {
        const pyrox = new CelestialBody(bhBody('pyrox'), makeMesh());
        const blobs = ['pyroxBlob1', 'pyroxBlob2', 'pyroxBlob3', 'pyroxBlob4'].map((id) => new CelestialBody(bhBody(id), makeMesh()));
        let max = -Infinity;
        let min = Infinity;
        for (let i = 0; i < 5000; i++) {
            applyWobbles([pyrox, ...blobs], 1);
            max = Math.max(max, pyrox.mesh.rotation.x);
            min = Math.min(min, pyrox.mesh.rotation.x);
        }
        expect(max).toBeLessThanOrEqual(0.5 + 0.0036 + 1e-9);
        expect(min).toBeGreaterThanOrEqual(-0.5 - 0.0036 - 1e-9);
    });

    it('a blob whose id is missing from the system is skipped without throwing', () => {
        const pyrox = new CelestialBody(bhBody('pyrox'), makeMesh());
        expect(() => applyWobbles([pyrox], 1)).not.toThrow();
    });
});
