import * as THREE from 'three';
import { loadModel, prepareShadows } from './loadModel.js';
import { CelestialBody } from './body.js';

export async function loadSolarSystem(config, { scene, load = loadModel }) {
    const root = new THREE.Group();
    const meshes = await Promise.all(config.bodies.map((body) => load(body.model)));

    const bodies = config.bodies.map((cfg, i) => {
        prepareShadows(meshes[i], cfg.shadow ?? 'both');
        return new CelestialBody(cfg, meshes[i]);
    });
    const byId = new Map(bodies.map((body) => [body.id, body]));

    config.bodies.forEach((cfg, i) => {
        const parent = cfg.parent !== undefined ? byId.get(cfg.parent).mesh : root;
        parent.add(bodies[i].object);
    });

    scene.add(root);

    return {
        root,
        bodies,
        byId,
        update() {
            for (const body of bodies) body.update();
        },
        unload() {
            scene.remove(root);
            for (const body of bodies) body.dispose();
        },
    };
}
