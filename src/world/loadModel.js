import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

/**
 * Ładuje model GLTF.
 * @param {string} url - ścieżka do pliku .gltf (np. z config/systems.js)
 * @param {GLTFLoader} [loader] - loader do użycia; domyślnie wspólny GLTFLoader (w testach można podać atrapę)
 * @returns {Promise<THREE.Group>} korzeń załadowanej sceny modelu
 */
export async function loadModel(url, loader = gltfLoader) {
    const gltf = await loader.loadAsync(url);
    return gltf.scene;
}

/**
 * Ustawia cienie na wszystkich meshach modelu i wyłącza anizotropię tekstur.
 * @param {THREE.Object3D} root - model, po którym przechodzimy (traverse)
 * @param {'cast'|'both'} mode - 'cast': tylko rzuca cień; 'both': rzuca i przyjmuje
 * @returns {void}
 */
export function prepareShadows(root, mode) {
    root.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = mode !== 'cast';
        if (node.material?.map) node.material.map.anisotropy = 0;
    });
}
