import * as THREE from 'three';
import { loadModel, prepareShadows } from './loadModel.js';
import { CelestialBody } from './body.js';
import { applyWobbles } from '../motion/motion.js';

/**
 * Ładuje cały układ (wszystkie modele równolegle), buduje ciała, podpina dzieci pod rodziców i dodaje układ do sceny.
 * Jeśli któryś model się nie załaduje, nic nie trafia do sceny, a Promise kończy się błędem.
 * @param {{bodies: object[]}} config - układ z config/systems.js (np. systems.sun)
 * @param {{scene: THREE.Scene, load?: function}} options - scena docelowa i opcjonalny loader (do testów)
 * @returns {Promise<{root: THREE.Group, bodies: CelestialBody[], byId: Map<string, CelestialBody>, update: function, unload: function}>}
 *   root: grupa z całym układem; bodies: ciała w kolejności z configu; byId: ciała po id;
 *   update(frames = 1): przesuwa każde ciało o `frames` klatek 60 FPS i wykonuje kołysanie (wobble);
 *   unload(): usuwa układ ze sceny i zwalnia pamięć
 */
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
        update(frames = 1) {
            for (const body of bodies) body.update(frames);
            applyWobbles(bodies, frames);
        },
        unload() {
            scene.remove(root);
            for (const body of bodies) body.dispose();
        },
    };
}
