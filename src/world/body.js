import * as THREE from 'three';
import { advance } from '../motion/motion.js';

const MAP_KEYS = ['map', 'lightMap', 'bumpMap', 'normalMap', 'aoMap', 'emissiveMap', 'specularMap'];

/**
 * Mierzy promień modelu (kula otaczająca, ze skalą modelu), bez względu na jego pozycję.
 * Wywoływane przed podpięciem innych ciał (księżyców), żeby ich nie liczyć.
 * @param {THREE.Object3D} mesh - model ciała
 * @returns {number} promień w jednostkach świata (0 dla pustego modelu)
 */
function measureRadius(mesh) {
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    if (box.isEmpty()) return 0;
    return box.getBoundingSphere(new THREE.Sphere()).radius;
}

/**
 * Jedno ciało niebieskie w scenie: model (mesh) i opcjonalny pivot, wokół którego krąży.
 */
export class CelestialBody {
    /**
     * @param {object} config - wpis ciała z config/systems.js (id, position, spin, orbit, scale, wobble, showInBar)
     * @param {THREE.Object3D} mesh - załadowany model (gltf.scene)
     */
    constructor(config, mesh) {
        this.id = config.id;
        this.isMoon = config.showInBar === false;
        this.spin = config.spin;
        this.meshOffset = config.position ?? {};
        this.mesh = mesh;
        this.wobble = config.wobble ?? null;
        this.wobbleDown = false;

        if (config.scale !== undefined) mesh.scale.setScalar(config.scale);
        this.radius = measureRadius(mesh);

        this.pivot = null;
        if (config.orbit) {
            this.pivot = new THREE.Object3D();
            this.pivot.add(mesh);
            this.orbitSpeed = config.orbit.speed;
            this.pivotOffset = config.orbit.position ?? {};
        }
    }

    /**
     * Obiekt, który dodajemy do sceny lub do rodzica.
     * @returns {THREE.Object3D} pivot, jeśli ciało krąży po orbicie; w przeciwnym razie sam mesh
     */
    get object() {
        return this.pivot ?? this.mesh;
    }

    /**
     * Przesuwa ciało o jeden krok animacji (pozycja, obrót, orbita).
     * @param {number} [frames=1] - ile klatek 60 FPS minęło
     * @returns {void}
     */
    update(frames = 1) {
        advance(this, frames);
    }

    /**
     * Zwalnia pamięć GPU: geometrie, materiały i tekstury modelu. Po tym ciała nie da się już użyć.
     * @returns {void}
     */
    dispose() {
        this.mesh.traverse((node) => {
            if (!node.isMesh) return;
            node.geometry?.dispose();
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            for (const material of materials) {
                if (!material) continue;
                for (const key of MAP_KEYS) material[key]?.dispose();
                material.dispose();
            }
        });
    }
}
