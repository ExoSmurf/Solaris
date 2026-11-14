import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { CelestialBody } from '../../src/world/body.js';
import { prepareShadows } from '../../src/world/loadModel.js';
import { loadSolarSystem } from '../../src/world/solarSystem.js';
import { systems } from '../../src/config/systems.js';

const makeMesh = () => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: new THREE.Texture() }));
const makeGroup = () => {
    const group = new THREE.Group();
    group.add(makeMesh());
    return group;
};

describe('CelestialBody: movement', () => {
    it('spin adds to rotation.y on every update', () => {
        const body = new CelestialBody({ id: 'a', spin: 0.25 }, makeMesh());
        body.update();
        body.update();
        expect(body.mesh.rotation.y).toBeCloseTo(0.5);
    });

    it('zero spin leaves rotation unchanged', () => {
        const body = new CelestialBody({ id: 'a', spin: 0 }, makeMesh());
        body.update();
        expect(body.mesh.rotation.y).toBe(0);
    });

    it('mesh keeps the axes it was not given (undefined means untouched)', () => {
        const mesh = makeMesh();
        mesh.position.set(7, 8, 9);
        const body = new CelestialBody({ id: 'a', spin: 0, position: { x: 3 } }, mesh);
        body.update();
        expect(mesh.position.toArray()).toEqual([3, 8, 9]);
    });

    it('pivot with no offset resets every axis to 0 on update', () => {
        const body = new CelestialBody({ id: 'a', spin: 0, orbit: { speed: 0 } }, makeMesh());
        body.pivot.position.set(5, 5, 5);
        body.update();
        expect(body.pivot.position.toArray()).toEqual([0, 0, 0]);
    });

    it('pivot offset overrides only the given axes and zeroes the rest', () => {
        const body = new CelestialBody({ id: 'a', spin: 0, orbit: { speed: 0, position: { x: 2 } } }, makeMesh());
        body.pivot.position.set(1, 1, 1);
        body.update();
        expect(body.pivot.position.toArray()).toEqual([2, 0, 0]);
    });

    it('orbit speed accumulates on the pivot, not on the mesh', () => {
        const body = new CelestialBody({ id: 'a', spin: 0, orbit: { speed: 0.1 } }, makeMesh());
        for (let i = 0; i < 5; i++) body.update();
        expect(body.pivot.rotation.y).toBeCloseTo(0.5);
        expect(body.mesh.rotation.y).toBe(0);
    });

    it('negative orbit speed rotates backwards', () => {
        const body = new CelestialBody({ id: 'a', spin: 0, orbit: { speed: -0.2 } }, makeMesh());
        body.update();
        expect(body.pivot.rotation.y).toBeCloseTo(-0.2);
    });

    it('body without orbit has no pivot and its object is the mesh', () => {
        const mesh = makeMesh();
        const body = new CelestialBody({ id: 'a', spin: 0 }, mesh);
        expect(body.pivot).toBeNull();
        expect(body.object).toBe(mesh);
    });

    it('body with orbit exposes the pivot as its object and holds the mesh inside it', () => {
        const mesh = makeMesh();
        const body = new CelestialBody({ id: 'a', spin: 0, orbit: { speed: 0 } }, mesh);
        expect(body.object).toBe(body.pivot);
        expect(mesh.parent).toBe(body.pivot);
    });

    it('repeated updates keep rotation finite', () => {
        const body = new CelestialBody({ id: 'a', spin: 0.01, orbit: { speed: 0.01 } }, makeMesh());
        for (let i = 0; i < 100000; i++) body.update();
        expect(Number.isFinite(body.mesh.rotation.y)).toBe(true);
        expect(Number.isFinite(body.pivot.rotation.y)).toBe(true);
    });
});

describe('CelestialBody: scale and flags', () => {
    it('scale is applied uniformly', () => {
        const mesh = makeMesh();
        new CelestialBody({ id: 'a', spin: 0, scale: 4 }, mesh);
        expect(mesh.scale.toArray()).toEqual([4, 4, 4]);
    });

    it('no scale keeps the default of 1', () => {
        const mesh = makeMesh();
        new CelestialBody({ id: 'a', spin: 0 }, mesh);
        expect(mesh.scale.toArray()).toEqual([1, 1, 1]);
    });

    it('isMoon is true only when showInBar is false', () => {
        expect(new CelestialBody({ id: 'a', spin: 0, showInBar: false }, makeMesh()).isMoon).toBe(true);
        expect(new CelestialBody({ id: 'a', spin: 0 }, makeMesh()).isMoon).toBe(false);
        expect(new CelestialBody({ id: 'a', spin: 0, showInBar: true }, makeMesh()).isMoon).toBe(false);
    });
});

describe('CelestialBody: radius', () => {
    it('measures the bounding sphere including the scale', () => {
        const body = new CelestialBody({ id: 'a', spin: 0, scale: 4 }, makeMesh());
        expect(body.radius).toBeCloseTo((Math.sqrt(3) / 2) * 4);
    });

    it('does not depend on the mesh offset', () => {
        const body = new CelestialBody({ id: 'a', spin: 0, position: { x: 50 } }, makeMesh());
        body.update();
        expect(body.radius).toBeCloseTo(Math.sqrt(3) / 2);
    });

    it('an empty model has radius 0', () => {
        expect(new CelestialBody({ id: 'a', spin: 0 }, new THREE.Group()).radius).toBe(0);
    });

    it('the earth radius does not include the moon hanging under it', async () => {
        const fakeLoad = vi.fn(async () => makeGroup());
        const system = await loadSolarSystem(systems.sun, { scene: new THREE.Scene(), load: fakeLoad });
        expect(system.byId.get('earth').radius).toBeCloseTo(Math.sqrt(3) / 2);
    });
});

describe('CelestialBody: dispose', () => {
    it('disposes geometry and every material, including the map texture', () => {
        const mesh = makeMesh();
        const geoSpy = vi.spyOn(mesh.geometry, 'dispose');
        const matSpy = vi.spyOn(mesh.material, 'dispose');
        const mapSpy = vi.spyOn(mesh.material.map, 'dispose');
        new CelestialBody({ id: 'a', spin: 0 }, mesh).dispose();
        expect(geoSpy).toHaveBeenCalledTimes(1);
        expect(matSpy).toHaveBeenCalledTimes(1);
        expect(mapSpy).toHaveBeenCalledTimes(1);
    });

    it('handles a material array and a missing map without throwing', () => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()]);
        expect(() => new CelestialBody({ id: 'a', spin: 0 }, mesh).dispose()).not.toThrow();
    });
});

describe('prepareShadows', () => {
    it('cast mode casts but does not receive', () => {
        const group = makeGroup();
        prepareShadows(group, 'cast');
        const mesh = group.children[0];
        expect(mesh.castShadow).toBe(true);
        expect(mesh.receiveShadow).toBe(false);
    });

    it('none mode neither casts nor receives', () => {
        const group = makeGroup();
        prepareShadows(group, 'none');
        const mesh = group.children[0];
        expect(mesh.castShadow).toBe(false);
        expect(mesh.receiveShadow).toBe(false);
    });

    it('default mode casts and receives', () => {
        const group = makeGroup();
        prepareShadows(group, 'both');
        const mesh = group.children[0];
        expect(mesh.castShadow).toBe(true);
        expect(mesh.receiveShadow).toBe(true);
    });

    it('sets anisotropy of the map to 0', () => {
        const group = makeGroup();
        prepareShadows(group, 'both');
        expect(group.children[0].material.map.anisotropy).toBe(0);
    });

    it('ignores nodes that are not meshes', () => {
        const group = new THREE.Group();
        group.add(new THREE.Object3D());
        expect(() => prepareShadows(group, 'both')).not.toThrow();
    });
});

describe('loadSolarSystem', () => {
    const fakeLoad = vi.fn(async () => makeGroup());

    it('builds one body per config entry, in config order', async () => {
        const scene = new THREE.Scene();
        const system = await loadSolarSystem(systems.sun, { scene, load: fakeLoad });
        expect(system.bodies.map((b) => b.id)).toEqual(systems.sun.bodies.map((b) => b.id));
    });

    it('loads each model path from config', async () => {
        const load = vi.fn(async () => makeGroup());
        await loadSolarSystem(systems.blackhole, { scene: new THREE.Scene(), load });
        expect(load.mock.calls.map((c) => c[0])).toEqual(systems.blackhole.bodies.map((b) => b.model));
    });

    it('bodies without a parent are attached to the system root', async () => {
        const system = await loadSolarSystem(systems.sun, { scene: new THREE.Scene(), load: fakeLoad });
        expect(system.byId.get('venus').object.parent).toBe(system.root);
        expect(system.byId.get('earth').object.parent).toBe(system.root);
    });

    it('moon hangs under the earth mesh, not under the root', async () => {
        const system = await loadSolarSystem(systems.sun, { scene: new THREE.Scene(), load: fakeLoad });
        expect(system.byId.get('moon').object.parent).toBe(system.byId.get('earth').mesh);
    });

    it('pyrox blobs hang under the pyrox mesh', async () => {
        const system = await loadSolarSystem(systems.blackhole, { scene: new THREE.Scene(), load: fakeLoad });
        for (const id of ['pyroxBlob1', 'pyroxBlob2', 'pyroxBlob3', 'pyroxBlob4']) {
            expect(system.byId.get(id).object.parent).toBe(system.byId.get('pyrox').mesh);
        }
    });

    it('root is added to the scene', async () => {
        const scene = new THREE.Scene();
        const system = await loadSolarSystem(systems.sun, { scene, load: fakeLoad });
        expect(system.root.parent).toBe(scene);
    });

    it('unload removes the root from the scene and disposes every body', async () => {
        const scene = new THREE.Scene();
        const system = await loadSolarSystem(systems.sun, { scene, load: fakeLoad });
        const disposeSpies = system.bodies.map((b) => vi.spyOn(b, 'dispose'));
        system.unload();
        expect(scene.children).not.toContain(system.root);
        for (const spy of disposeSpies) expect(spy).toHaveBeenCalledTimes(1);
    });

    it('two systems can be loaded into one scene and unloaded independently', async () => {
        const scene = new THREE.Scene();
        const sun = await loadSolarSystem(systems.sun, { scene, load: fakeLoad });
        const bh = await loadSolarSystem(systems.blackhole, { scene, load: fakeLoad });
        sun.unload();
        expect(scene.children).toContain(bh.root);
        expect(scene.children).not.toContain(sun.root);
    });

    it('a failing model load rejects instead of building a half system', async () => {
        const load = vi.fn(async (url) => {
            if (url.includes('neptune')) throw new Error('404');
            return makeGroup();
        });
        const scene = new THREE.Scene();
        await expect(loadSolarSystem(systems.blackhole, { scene, load })).rejects.toThrow('404');
        expect(scene.children).toHaveLength(0);
    });

    it('update(6) moves bodies as far as six update(1) calls', async () => {
        const a = await loadSolarSystem(systems.sun, { scene: new THREE.Scene(), load: fakeLoad });
        const b = await loadSolarSystem(systems.sun, { scene: new THREE.Scene(), load: fakeLoad });
        a.update(6);
        for (let i = 0; i < 6; i++) b.update(1);
        for (const id of ['venus', 'earth', 'saturn', 'pluto']) {
            expect(a.byId.get(id).pivot.rotation.y, id).toBeCloseTo(b.byId.get(id).pivot.rotation.y, 12);
            expect(a.byId.get(id).mesh.rotation.y, id).toBeCloseTo(b.byId.get(id).mesh.rotation.y, 12);
        }
    });

    it('update applies wobble to earth and its moon follower', async () => {
        const system = await loadSolarSystem(systems.sun, { scene: new THREE.Scene(), load: fakeLoad });
        system.update(1);
        expect(system.byId.get('earth').mesh.rotation.x).toBeCloseTo(0.002);
        expect(system.byId.get('moon').mesh.rotation.y).toBeCloseTo(0.02 + 0.01);
    });

    it('update(0) changes no rotation', async () => {
        const system = await loadSolarSystem(systems.blackhole, { scene: new THREE.Scene(), load: fakeLoad });
        system.update(0);
        for (const body of system.bodies) {
            expect(body.mesh.rotation.toArray().slice(0, 3), body.id).toEqual([0, 0, 0]);
            if (body.pivot) expect(body.pivot.rotation.y, body.id).toBe(0);
        }
    });

    it('update moves every body once', async () => {
        const system = await loadSolarSystem(systems.sun, { scene: new THREE.Scene(), load: fakeLoad });
        system.update();
        expect(system.byId.get('venus').mesh.position.x).toBe(3);
        expect(system.byId.get('venus').pivot.rotation.y).toBeCloseTo(0.00035);
    });
});
