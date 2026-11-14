import * as THREE from 'three';

/**
 * Losowe gwiazdy na sferze wokół sceny.
 * @param {{numStars?: number}} [options]
 * @returns {THREE.Points}
 */
export function createStarfield({ numStars = 2500 } = {}) {
    const verts = [];
    const colors = [];
    for (let i = 0; i < numStars; i += 1) {
        const radius = Math.random() * 25 + 35;
        const theta = 2 * Math.PI * Math.random();
        const phi = Math.acos(2 * Math.random() - 1);
        verts.push(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta),
            radius * Math.cos(phi),
        );
        const col = new THREE.Color().setHSL(0.6, 0.2, Math.random());
        colors.push(col.r, col.g, col.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
        size: 0.2,
        vertexColors: true,
        map: new THREE.TextureLoader().load("./textures/circle.webp"),
    });
    const points = new THREE.Points(geo, mat);
    points.name = "starfield";
    points.material.transparent = true;
    return points;
}
