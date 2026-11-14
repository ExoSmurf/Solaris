import * as THREE from 'three';
import { light as lightConfig } from '../config/settings.js';

/**
 * Dodaje do sceny sześć świateł punktowych z cieniami i światło otoczenia.
 * @param {THREE.Scene} scene
 * @returns {void}
 */
export function addLights(scene) {
    const { color, ambientIntensity, offsetFromCenter: d, point } = lightConfig;
    const offsets = [[0, d, 0], [0, -d, 0], [d, 0, 0], [-d, 0, 0], [0, 0, d], [0, 0, -d]];
    for (const [x, y, z] of offsets) {
        const pointLight = new THREE.PointLight(color);
        pointLight.castShadow = true;
        pointLight.shadow.bias = point.shadow.bias;
        pointLight.shadow.normalBias = point.shadow.normalBias;
        pointLight.shadow.radius = point.shadow.radius;
        pointLight.shadow.mapSize.width = point.shadow.mapSize;
        pointLight.shadow.mapSize.height = point.shadow.mapSize;
        pointLight.shadow.camera.near = point.shadow.near;
        pointLight.shadow.camera.far = point.distance;
        pointLight.position.set(x, y, z);
        pointLight.distance = point.distance;
        pointLight.power = point.power;
        scene.add(pointLight);
    }
    scene.add(new THREE.AmbientLight(color, ambientIntensity));
}
