import * as THREE from 'three';

/**
 * Przesunięcie kamery (w prawo, wzdłuż jej osi X) w danej fazie przelotu.
 * Rozpędzanie: 0 → distance (ease-in), lot: distance, hamowanie: -distance → 0 (ease-out).
 * @param {'accelerate'|'cruise'|'decelerate'|'idle'} phase - faza przelotu
 * @param {number} progress - postęp fazy 0..1 (ignorowany w 'cruise' i 'idle')
 * @param {number} distance - jak daleko kamera odlatuje od układu
 * @returns {number}
 */
export function warpOffset(phase, progress, distance) {
    const u = THREE.MathUtils.clamp(progress, 0, 1);
    if (phase === 'accelerate') return distance * u ** 3;
    if (phase === 'cruise') return distance;
    if (phase === 'decelerate') return -distance * (1 - u) ** 3;
    return 0;
}

/**
 * Prędkość kamery (jednostki/s) w danej fazie przelotu, zgodna z pochodną warpOffset.
 * @param {'accelerate'|'cruise'|'decelerate'|'idle'} phase - faza przelotu
 * @param {number} progress - postęp fazy 0..1
 * @param {{distance: number, accelerateDuration: number, decelerateDuration: number}} config - ustawienia przelotu
 * @returns {number}
 */
export function warpSpeed(phase, progress, config) {
    const u = THREE.MathUtils.clamp(progress, 0, 1);
    const { distance, accelerateDuration, decelerateDuration } = config;
    if (phase === 'accelerate') return (3 * distance * u ** 2) / accelerateDuration;
    if (phase === 'cruise') return (3 * distance) / accelerateDuration;
    if (phase === 'decelerate') return (3 * distance * (1 - u) ** 2) / decelerateDuration;
    return 0;
}

/**
 * Zawija współrzędną w przedział [-bound, bound] (gwiazda, która wyleciała z lewej, wraca z prawej).
 * @param {number} value - współrzędna
 * @param {number} bound - połowa szerokości przedziału (> 0)
 * @returns {number}
 */
export function wrapCoordinate(value, bound) {
    const span = 2 * bound;
    return ((((value + bound) % span) + span) % span) - bound;
}

/**
 * Tworzy przelot między układami: kamera rozpędza się w prawo, leci, aż nowy układ się załaduje,
 * pojawia się na lewo od niego i hamuje. Sam nie rusza kamery, tylko liczy przesunięcie i prędkość.
 * @param {{distance: number, accelerateDuration: number, decelerateDuration: number, minCruiseDuration: number}} config - settings.warp
 * @returns {{readonly active: boolean, readonly phase: string, start: function, arrive: function, update: function}}
 *   start({onCruise, onDone}): zaczyna przelot; onCruise wołane raz, gdy stary układ jest już poza kadrem;
 *   arrive(): nowy układ gotowy, można hamować; update(dt): zwraca {offset, speed, intensity}
 */
export function createWarpTransition(config) {
    let phase = 'idle';
    let elapsed = 0;
    let arrived = false;
    let callbacks = {};

    const maxSpeed = warpSpeed('cruise', 0, config);

    function enter(next) {
        phase = next;
        elapsed = 0;
    }

    return {
        get active() { return phase !== 'idle'; },
        get phase() { return phase; },

        start({ onCruise, onDone } = {}) {
            if (phase !== 'idle') return;
            callbacks = { onCruise, onDone };
            arrived = false;
            enter('accelerate');
        },

        arrive() {
            arrived = true;
        },

        update(dt) {
            elapsed += dt;
            if (phase === 'accelerate' && elapsed >= config.accelerateDuration) {
                enter('cruise');
                callbacks.onCruise?.();
            }
            if (phase === 'cruise' && arrived && elapsed >= config.minCruiseDuration) {
                enter('decelerate');
            }
            if (phase === 'decelerate' && elapsed >= config.decelerateDuration) {
                enter('idle');
                callbacks.onDone?.();
            }

            const duration = phase === 'decelerate' ? config.decelerateDuration : config.accelerateDuration;
            const progress = elapsed / duration;
            const speed = warpSpeed(phase, progress, config);
            return {
                offset: warpOffset(phase, progress, config.distance),
                speed,
                intensity: maxSpeed > 0 ? speed / maxSpeed : 0,
            };
        },
    };
}

/**
 * Tworzy warstwę gwiazd przelotu: smugi przyklejone do kamery, które przesuwają się w lewo
 * z prędkością kamery i wydłużają się wraz z nią (rozmycie ruchu). Kolory jak w zwykłym starfieldzie.
 * @param {{count: number, nearDepth: number, farDepth: number, screenMargin: number, streakDuration: number, hue: number, saturation: number}} config - settings.warp.stars
 * @returns {{object: THREE.LineSegments, update: function}}
 *   update(dt, speed, intensity, camera): przesuwa smugi i ustawia je przed kamerą
 */
export function createWarpStars(config) {
    const { count, nearDepth, farDepth, screenMargin, streakDuration, hue, saturation } = config;
    const positions = new Float32Array(count * 6);
    const colors = new Float32Array(count * 8);
    const stars = Array.from({ length: count }, () => ({
        x: THREE.MathUtils.randFloatSpread(2),
        y: THREE.MathUtils.randFloatSpread(2),
        z: -THREE.MathUtils.randFloat(nearDepth, farDepth),
        color: new THREE.Color().setHSL(hue, saturation, Math.random()),
    }));
    let screenSpaceInitialized = false;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const object = new THREE.LineSegments(geometry, material);
    object.frustumCulled = false;
    object.visible = false;

    return {
        object,

        update(dt, speed, intensity, camera) {
            object.visible = intensity > 0;
            if (!object.visible) return;

            const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * screenMargin;
            const halfWidth = halfHeight * camera.aspect;
            if (!screenSpaceInitialized) {
                for (const star of stars) {
                    star.x *= halfWidth * -star.z;
                    star.y *= halfHeight * -star.z;
                }
                screenSpaceInitialized = true;
            }

            const streak = speed * streakDuration;
            stars.forEach((star, i) => {
                star.x = wrapCoordinate(star.x - speed * dt, halfWidth * -star.z);
                positions.set([star.x, star.y, star.z, star.x + streak, star.y, star.z], i * 6);
                const { r, g, b } = star.color;
                colors.set([r, g, b, intensity, r, g, b, 0], i * 8);
            });
            geometry.attributes.position.needsUpdate = true;
            geometry.attributes.color.needsUpdate = true;

            object.position.copy(camera.position);
            object.quaternion.copy(camera.quaternion);
        },
    };
}
