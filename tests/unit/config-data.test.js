import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { systems } from '../../src/config/systems.js';
import { bodyInfo } from '../../src/config/info.js';
import { camera, light, render, paths } from '../../src/config/settings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUBLIC = join(ROOT, 'public');
const publicFile = (webPath) => join(PUBLIC, webPath);

const allBodies = Object.values(systems).flatMap((s) => s.bodies);
const allIds = allBodies.map((b) => b.id);
const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

describe('systems: structure', () => {
    it('defines exactly two systems', () => {
        expect(Object.keys(systems)).toEqual(['sun', 'blackhole']);
    });

    it('sun system has 6 bodies and black hole system has 10', () => {
        expect(systems.sun.bodies).toHaveLength(6);
        expect(systems.blackhole.bodies).toHaveLength(10);
    });

    it('every body id is unique across both systems', () => {
        expect(new Set(allIds).size).toBe(allIds.length);
    });

    it('every parent points to a body in the same system', () => {
        for (const system of Object.values(systems)) {
            const ids = system.bodies.map((b) => b.id);
            for (const body of system.bodies) {
                if (body.parent !== undefined) {
                    expect(ids, `${body.id} parent`).toContain(body.parent);
                }
            }
        }
    });

    it('parent is never the body itself and does not form a cycle', () => {
        const byId = Object.fromEntries(allBodies.map((b) => [b.id, b]));
        for (const body of allBodies) {
            const seen = new Set();
            let current = body;
            while (current && current.parent !== undefined) {
                expect(seen.has(current.id), `cycle at ${body.id}`).toBe(false);
                seen.add(current.id);
                current = byId[current.parent];
            }
        }
    });

    it('hidden-from-bar bodies are exactly the moons', () => {
        const hidden = allBodies.filter((b) => b.showInBar === false).map((b) => b.id);
        expect(hidden).toEqual(['moon', 'pyroxBlob1', 'pyroxBlob2', 'pyroxBlob3', 'pyroxBlob4']);
    });
});

describe('systems: values', () => {
    it('model paths exist in public/', () => {
        for (const body of allBodies) {
            expect(existsSync(publicFile(body.model)), body.model).toBe(true);
        }
    });

    it('spin, orbit speed and position components are finite numbers', () => {
        for (const body of allBodies) {
            expect(isFiniteNumber(body.spin), `${body.id} spin`).toBe(true);
            for (const axis of ['x', 'y', 'z']) {
                if (body.position && body.position[axis] !== undefined) {
                    expect(isFiniteNumber(body.position[axis]), `${body.id} position.${axis}`).toBe(true);
                }
            }
            if (body.orbit) {
                expect(isFiniteNumber(body.orbit.speed), `${body.id} orbit.speed`).toBe(true);
                if (body.orbit.position) {
                    for (const [axis, v] of Object.entries(body.orbit.position)) {
                        expect(isFiniteNumber(v), `${body.id} orbit.position.${axis}`).toBe(true);
                    }
                }
            }
        }
    });

    it('scale, when given, is positive', () => {
        for (const body of allBodies) {
            if (body.scale !== undefined) expect(body.scale, body.id).toBeGreaterThan(0);
        }
    });

    it('shadow is either undefined (cast and receive), cast or none', () => {
        for (const body of allBodies) {
            if (body.shadow !== undefined) expect(['cast', 'none'], body.id).toContain(body.shadow);
        }
    });
});

describe('bodyInfo: consistency with systems', () => {
    it('every body has an info entry with a name', () => {
        for (const id of allIds) {
            expect(bodyInfo[id], id).toBeDefined();
            expect(typeof bodyInfo[id].name, id).toBe('string');
        }
    });

    it('no info entry exists without a matching body', () => {
        expect(Object.keys(bodyInfo).sort()).toEqual([...allIds].sort());
    });

    it('bodies shown in the bar have a preview image file', () => {
        for (const body of allBodies.filter((b) => b.showInBar !== false)) {
            const key = bodyInfo[body.id].preview ?? paths.defaultPreview;
            expect(existsSync(publicFile(`${paths.previews}${key}.webp`)), `${body.id} preview ${key}`).toBe(true);
        }
    });

    it('every gallery image has a .webp and a 2.webp high-res version', () => {
        for (const [id, info] of Object.entries(bodyInfo)) {
            for (const name of info.images ?? []) {
                const low = publicFile(`${paths.images}${name}.webp`);
                const high = publicFile(`${paths.images}${name}2.webp`);
                expect(existsSync(low), `${id} image ${name}`).toBe(true);
                expect(existsSync(high), `${id} high-res ${name}`).toBe(true);
            }
        }
    });

    it('bodies with no images have an empty list, not undefined', () => {
        for (const id of allIds) {
            if (bodyInfo[id].images !== undefined) expect(Array.isArray(bodyInfo[id].images), id).toBe(true);
        }
    });
});

describe('settings: sanity', () => {
    it('fov steps are ordered: focused < lock < default', () => {
        expect(camera.fov.min).toBeLessThan(camera.fov.lock);
        expect(camera.fov.lock).toBeLessThan(camera.fov.default);
    });

    it('orbit distance limits are ordered and the start position is within them', () => {
        expect(camera.orbit.minDistance).toBeLessThan(camera.orbit.maxDistance);
        const { x, y, z } = camera.position.start;
        const distance = Math.hypot(x, y, z);
        expect(distance).toBeGreaterThanOrEqual(camera.orbit.minDistance);
        expect(distance).toBeLessThanOrEqual(camera.orbit.maxDistance);
    });

    it('camera durations are positive and the bar flight is not slower than a normal flight', () => {
        expect(camera.fly.duration).toBeGreaterThan(0);
        expect(camera.fly.barDuration).toBeGreaterThan(0);
        expect(camera.fly.barDuration).toBeLessThanOrEqual(camera.fly.duration);
        for (const key of ['lockDuration', 'holdDuration', 'zoomDuration', 'outDuration']) {
            expect(camera.focus[key], key).toBeGreaterThan(0);
        }
        expect(camera.focus.wobble.amplitude).toBeGreaterThanOrEqual(0);
        expect(camera.focus.wobble.frequency).toBeGreaterThan(0);
    });

    it('light and render values are positive where they must be', () => {
        expect(light.point.distance).toBeGreaterThan(0);
        expect(light.point.shadow.mapSize).toBeGreaterThan(0);
        expect(render.exposure).toBeGreaterThan(0);
        expect(render.maxPixelRatio).toBeGreaterThanOrEqual(1);
        expect(camera.fov.min).toBeGreaterThan(0);
    });
});
