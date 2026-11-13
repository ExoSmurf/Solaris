/**
 * Zamienia czas, który minął od poprzedniej klatki, na liczbę "klatek 60 FPS".
 * Dzięki temu ruch ma tę samą prędkość niezależnie od odświeżania monitora.
 * @param {number} elapsedMs - czas od poprzedniej klatki w milisekundach
 * @param {number} maxFrames - górny limit (chroni przed skokiem po powrocie do karty)
 * @param {number} [fps=60] - bazowa liczba klatek na sekundę, do której skalujemy
 * @returns {number} liczba klatek w zakresie 0..maxFrames (0 dla wartości ujemnych i NaN)
 */
export function framesBetween(elapsedMs, maxFrames, fps = 60) {
    const frames = (elapsedMs * fps) / 1000;
    if (!(frames > 0)) return 0;
    return Math.min(frames, maxFrames);
}

/**
 * Ustawia osie pozycji obiektu na wartości z `values`.
 * @param {THREE.Object3D} object - obiekt, którego `position` zmieniamy w miejscu
 * @param {{x?: number, y?: number, z?: number}} values - nowe wartości osi (brakujące pomijane)
 * @param {boolean} resetMissing - true: brakującą oś ustawia na 0; false: zostawia ją bez zmian
 * @returns {void}
 */
function applyPosition(object, values, resetMissing) {
    for (const axis of ['x', 'y', 'z']) {
        const value = values[axis];
        if (value !== undefined) object.position[axis] = value;
        else if (resetMissing) object.position[axis] = 0;
    }
}

/**
 * Przesuwa ciało o jeden krok animacji: ustawia pozycje, obraca wokół własnej osi i po orbicie.
 * @param {CelestialBody} body - ciało do aktualizacji (zmieniane w miejscu)
 * @param {number} frames - ile klatek 60 FPS minęło (patrz framesBetween)
 * @returns {void}
 */
export function advance(body, frames) {
    applyPosition(body.mesh, body.meshOffset, false);
    body.mesh.rotation.y += body.spin * frames;

    if (body.pivot) {
        applyPosition(body.pivot, body.pivotOffset, true);
        body.pivot.rotation.y += body.orbitSpeed * frames;
    }
}

/**
 * Wykonuje kołysanie (wobble) dla każdego ciała, które ma `wobble` w configu.
 * @param {CelestialBody[]} bodies - wszystkie ciała aktywnego układu (potrzebne do znalezienia followerów)
 * @param {number} frames - ile klatek 60 FPS minęło
 * @returns {void}
 */
export function applyWobbles(bodies, frames) {
    for (const body of bodies) {
        if (body.wobble) stepWobble(body, bodies, frames);
    }
}

/**
 * Jeden krok kołysania: po przekroczeniu `limit` zmienia kierunek (clamp) i obraca ciało oraz jego followerów.
 * @param {CelestialBody} body - ciało z konfiguracją `wobble`; jego `wobbleDown` przechowuje kierunek
 * @param {CelestialBody[]} bodies - ciała układu, w których szukamy followerów po `id`
 * @param {number} frames - ile klatek 60 FPS minęło
 * @returns {void}
 */
function stepWobble(body, bodies, frames) {
    const { axis, limit, step, followers = [] } = body.wobble;
    const rotation = body.mesh.rotation;

    if (rotation[axis] > limit) body.wobbleDown = true;
    else if (rotation[axis] < -limit) body.wobbleDown = false;

    const sign = body.wobbleDown ? -1 : 1;
    rotation[axis] += sign * step * frames;

    for (const follower of followers) {
        const target = bodies.find((b) => b.id === follower.id);
        const move = body.wobbleDown ? follower.down : follower.up;
        if (target && move) target.mesh.rotation[move.axis] += sign * move.step * frames;
    }
}
