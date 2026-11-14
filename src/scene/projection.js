import * as THREE from 'three';
import { screenRadius } from '../ui/lockBrackets.js';

const scratch = new THREE.Vector3();

/**
 * Rzutuje środek ciała na ekran w pikselach.
 * @param {THREE.Vector3} position - pozycja w świecie
 * @param {number} worldRadius - promień ciała w jednostkach świata
 * @param {THREE.PerspectiveCamera} camera
 * @returns {{center: {x: number, y: number}, radius: number}|null} null, gdy poza kadrem
 */
export function projectToScreen(position, worldRadius, camera) {
    scratch.copy(position).project(camera);
    if (scratch.z < -1 || scratch.z > 1) return null;
    return {
        center: {
            x: ((scratch.x + 1) / 2) * window.innerWidth,
            y: ((1 - scratch.y) / 2) * window.innerHeight,
        },
        radius: screenRadius(worldRadius, camera.position.distanceTo(position), camera.fov, window.innerHeight),
    };
}
