import { systems } from '../config/systems.js';
import { loadSolarSystem } from '../world/solarSystem.js';

const SYSTEM_KEYS = { 1: 'sun', 2: 'blackhole' };
const systemCache = new Map();

/**
 * Czeka na następną klatkę animacji.
 * @returns {Promise<number>}
 */
function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
}

/**
 * Wysyła tekstury modelu na GPU po jednej na klatkę, żeby nie robić tego naraz w pierwszej klatce
 * z nowym układem (to dawało widoczne przycięcie animacji).
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Object3D} root - model albo cały układ
 * @returns {Promise<void>}
 */
async function uploadTexturesGradually(renderer, root) {
    const textures = new Set();
    root.traverse((node) => {
        if (!node.isMesh) return;
        for (const value of Object.values(node.material)) {
            if (value?.isTexture) textures.add(value);
        }
    });
    for (const texture of textures) {
        renderer.initTexture(texture);
        await nextFrame();
    }
}

/**
 * Ładuje układ raz i trzyma go w pamięci; kolejne wywołania zwracają ten sam układ.
 * @param {number} solarNo - numer układu (1: Słońce, 2: czarna dziura)
 * @param {THREE.Scene} scene
 * @returns {Promise<object>} układ z world/solarSystem.js
 */
export async function prepareSystem(solarNo, scene) {
    if (!systemCache.has(solarNo)) {
        const system = await loadSolarSystem(systems[SYSTEM_KEYS[solarNo]], { scene });
        system.solarNo = solarNo;
        system.warmed = false;
        systemCache.set(solarNo, system);
    }
    return systemCache.get(solarNo);
}

/**
 * Kompiluje shadery i wysyła tekstury układu na GPU, zanim zostanie pokazany.
 * @param {object} system - układ z prepareSystem
 * @param {{renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, warpStars: {object: THREE.Object3D}}} deps
 * @returns {Promise<void>}
 */
export async function warmSystem(system, { renderer, scene, camera, warpStars }) {
    if (system.warmed) return;
    warpStars.object.visible = true;
    await renderer.compileAsync(scene, camera);
    warpStars.object.visible = false;
    await uploadTexturesGradually(renderer, system.root);
    system.warmed = true;
}
