import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

export async function loadModel(url, loader = gltfLoader) {
    const gltf = await loader.loadAsync(url);
    return gltf.scene;
}

export function prepareShadows(root, mode) {
    root.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = mode !== 'cast';
        if (node.material?.map) node.material.map.anisotropy = 0;
    });
}
