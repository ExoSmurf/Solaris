import * as THREE from 'three';

const MAP_KEYS = ['map', 'lightMap', 'bumpMap', 'normalMap', 'aoMap', 'emissiveMap', 'specularMap'];

function applyPosition(object, values, fallback) {
    for (const axis of ['x', 'y', 'z']) {
        const value = values[axis];
        if (value !== undefined) object.position[axis] = value;
        else if (fallback) object.position[axis] = 0;
    }
}

export class CelestialBody {
    constructor(config, mesh) {
        this.id = config.id;
        this.isMoon = config.showInBar === false;
        this.spin = config.spin;
        this.meshOffset = config.position ?? {};
        this.mesh = mesh;

        if (config.scale !== undefined) mesh.scale.setScalar(config.scale);

        this.pivot = null;
        if (config.orbit) {
            this.pivot = new THREE.Object3D();
            this.pivot.add(mesh);
            this.orbitSpeed = config.orbit.speed;
            this.pivotOffset = config.orbit.position ?? {};
        }
    }

    get object() {
        return this.pivot ?? this.mesh;
    }

    update() {
        applyPosition(this.mesh, this.meshOffset, false);
        this.mesh.rotation.y += this.spin;

        if (this.pivot) {
            applyPosition(this.pivot, this.pivotOffset, true);
            this.pivot.rotation.y += this.orbitSpeed;
        }
    }

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
