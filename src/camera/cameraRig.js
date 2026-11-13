import * as THREE from 'three';

const BUSY_MODES = new Set(['travel', 'focusLock', 'focusHold', 'focusZoom', 'focusOut']);
const FOCUSED_MODES = new Set(['focusLock', 'focusHold', 'focusZoom', 'focused']);
const PROGRESS_EPSILON = 1e-9;

/**
 * Krzywa wygładzająca ruch: wolny start, szybki środek, wolny koniec.
 * @param {number} t - postęp ruchu (przycinany do zakresu 0..1)
 * @returns {number} wygładzony postęp w zakresie 0..1
 */
export function easeInOutCubic(t) {
    const x = THREE.MathUtils.clamp(t, 0, 1);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Deterministyczna liczba "losowa" dla danego numeru (ten sam numer zawsze daje tę samą wartość).
 * @param {number} n - dowolna liczba całkowita
 * @returns {number} wartość w zakresie -1..1
 */
export function jitterNoise(n) {
    const s = Math.sin(n * 12.9898) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
}

/**
 * Przesunięcie punktu, na który patrzy kamera, podczas namierzania celu: szarpane drgania jak przy celowniku,
 * które przeskakują `frequency` razy na sekundę i słabną do zera na końcu fazy.
 * Na starcie i na końcu (elapsed <= 0 i elapsed >= total) przesunięcie wynosi dokładnie 0.
 * @param {number} elapsed - czas od początku namierzania w sekundach
 * @param {number} total - czas namierzania w sekundach
 * @param {{amplitude: number, frequency: number}} wobble - amplituda w jednostkach świata i liczba przeskoków na sekundę
 * @returns {{x: number, y: number}} przesunięcie w prawo (x) i w górę (y) względem widoku kamery
 */
export function lockWobbleOffset(elapsed, total, { amplitude, frequency }) {
    if (amplitude <= 0 || total <= 0 || elapsed <= 0 || elapsed >= total) return { x: 0, y: 0 };
    const envelope = amplitude * (1 - elapsed / total);
    const tick = Math.floor(elapsed * frequency);
    return {
        x: envelope * jitterNoise(tick * 2 + 1),
        y: envelope * jitterNoise(tick * 2 + 2),
    };
}

/**
 * Zwraca indeks następnej planety po `current`, pomijając ciało centralne (indeks 0) i księżyce.
 * Po ostatniej planecie wraca do pierwszej.
 * @param {{isMoon: boolean}[]} bodies - ciała aktywnego układu, ciało centralne pod indeksem 0
 * @param {number} current - indeks aktualnie śledzonego ciała
 * @returns {number} indeks następnej planety albo 0, gdy układ nie ma planet
 */
export function nextPlanetIndex(bodies, current) {
    const planets = bodies.map((_, i) => i).filter((i) => i !== 0 && !bodies[i].isMoon);
    if (planets.length === 0) return 0;
    return planets.find((i) => i > current) ?? planets[0];
}

/**
 * Tworzy sterowanie kamerą z trybami:
 * overview (orbita wokół centrum), travel (lot do ciała), follow (śledzenie planety z pozycji domyślnej),
 * focusLock -> focusHold -> focusZoom -> focused (dwufazowe przybliżenie z przystankiem), focusOut (oddalenie).
 * @param {object} options
 * @param {THREE.PerspectiveCamera} options.camera - kamera sceny
 * @param {{target: THREE.Vector3, enabled: boolean, update: function}} options.controls - OrbitControls używane w trybie overview
 * @param {object} options.config - `camera` z config/settings.js (position.start, fov, fly, focus)
 * @param {function({mode: string, targetIndex: number}): void} [options.onChange] - wywoływane przy każdej zmianie trybu
 * @returns {object} sterowanie kamerą; opis metod przy każdej z nich
 */
export function createCameraRig({ camera, controls, config, onChange = () => {} }) {
    const home = new THREE.Vector3().copy(config.position.start);
    const look = new THREE.Vector3();
    const fromLook = new THREE.Vector3();
    const fromPosition = new THREE.Vector3();
    const targetPosition = new THREE.Vector3();
    const aim = new THREE.Vector3();
    const viewDirection = new THREE.Vector3();
    const viewRight = new THREE.Vector3();
    const viewUp = new THREE.Vector3();

    let bodies = [];
    let mode = 'overview';
    let targetIndex = 0;
    let progress = 0;
    let duration = 1;
    let fromFov = config.fov.default;
    let toFov = config.fov.default;
    let afterFocusOut = null;
    let refocusOnArrival = false;
    let lockElapsed = 0;

    function addScreenOffset(point, { x, y }) {
        viewDirection.subVectors(point, camera.position).normalize();
        viewRight.crossVectors(viewDirection, camera.up).normalize();
        viewUp.crossVectors(viewRight, viewDirection).normalize();
        point.addScaledVector(viewRight, x).addScaledVector(viewUp, y);
    }

    function setMode(next) {
        mode = next;
        controls.enabled = mode === 'overview';
        onChange({ mode, targetIndex });
    }

    function isBusy() {
        return BUSY_MODES.has(mode);
    }

    function targetWorld(out) {
        return bodies[targetIndex].mesh.getWorldPosition(out);
    }

    function startPhase(nextMode, phaseDuration) {
        progress = 0;
        duration = phaseDuration;
        setMode(nextMode);
    }

    function startTravel(index, travelDuration, refocus) {
        fromLook.copy(look);
        fromPosition.copy(camera.position);
        targetIndex = index;
        refocusOnArrival = refocus;
        startPhase('travel', travelDuration);
    }

    function startFov(to, nextMode, phaseDuration) {
        fromFov = camera.fov;
        toFov = to;
        startPhase(nextMode, phaseDuration);
    }

    function startFocus() {
        lockElapsed = 0;
        startFov(config.fov.lock, 'focusLock', config.focus.lockDuration);
    }

    function startUnfocus(action) {
        afterFocusOut = action;
        startFov(config.fov.default, 'focusOut', config.focus.outDuration);
    }

    function advanceProgress(dt) {
        progress = progress + dt / duration;
        if (progress > 1 - PROGRESS_EPSILON) progress = 1;
        return easeInOutCubic(progress);
    }

    function finishTravel() {
        if (targetIndex === 0) {
            controls.target.copy(look);
            setMode('overview');
            return;
        }
        setMode('follow');
        if (refocusOnArrival) {
            refocusOnArrival = false;
            startFocus();
        }
    }

    function finishPhase() {
        if (mode === 'focusLock') {
            startPhase('focusHold', config.focus.holdDuration);
        } else if (mode === 'focusHold') {
            startFov(config.fov.min, 'focusZoom', config.focus.zoomDuration);
        } else if (mode === 'focusZoom') {
            setMode('focused');
        } else if (mode === 'focusOut') {
            setMode('follow');
            const action = afterFocusOut;
            afterFocusOut = null;
            if (action) action();
        }
    }

    function showOverview() {
        if (isBusy() || mode === 'overview') return false;
        const fly = () => startTravel(0, config.fly.duration, false);
        if (mode === 'focused') startUnfocus(fly);
        else fly();
        return true;
    }

    return {
        /** @returns {string} aktualny tryb kamery */
        get mode() {
            return mode;
        },

        /** @returns {boolean} czy trwa lot, po którym kamera sama się przybliży (przejście z focusu na focus) */
        get refocusing() {
            return mode === 'travel' && refocusOnArrival;
        },

        /** @returns {number} postęp bieżącej fazy w zakresie 0..1 (np. jak daleko jest namierzanie) */
        get phaseProgress() {
            return progress;
        },

        /** @returns {number} indeks śledzonego ciała w aktywnym układzie (0 = ciało centralne) */
        get targetIndex() {
            return targetIndex;
        },

        /**
         * Czy kamera jest w trakcie ruchu (lot, fazy przybliżania albo oddalanie).
         * @returns {boolean}
         */
        isBusy,

        /**
         * Czy kamera jest przybliżona albo właśnie się przybliża.
         * @returns {boolean}
         */
        isFocused() {
            return FOCUSED_MODES.has(mode);
        },

        /**
         * Ustawia ciała nowego układu i natychmiast przełącza kamerę na orbitę wokół centrum z pozycji domyślnej.
         * @param {{mesh: THREE.Object3D, isMoon: boolean}[]} list - ciała układu, centrum pod indeksem 0
         * @returns {void}
         */
        setBodies(list) {
            bodies = list;
            targetIndex = 0;
            afterFocusOut = null;
            refocusOnArrival = false;
            camera.position.copy(home);
            camera.fov = config.fov.default;
            camera.updateProjectionMatrix();
            if (bodies.length > 0) targetWorld(look);
            controls.target.copy(look);
            setMode('overview');
        },

        /**
         * Rozpoczyna płynny lot do ciała. Indeks 0 oznacza powrót do orbity wokół centrum.
         * Jeśli kamera jest przybliżona: oddala się, leci do nowej planety i przybliża się na niej ponownie.
         * @param {number} index - indeks ciała w aktywnym układzie
         * @param {{fast?: boolean}} [options] - fast: krótszy lot (wybór z paska planet)
         * @returns {boolean} false, gdy wybór jest ignorowany (ruch w toku, księżyc, brak ciała, to samo ciało)
         */
        select(index, { fast = false } = {}) {
            if (isBusy() || !bodies[index]) return false;
            if (index === 0) return showOverview();
            if (bodies[index].isMoon) return false;
            if (index === targetIndex && mode !== 'overview') return false;
            const travelDuration = fast ? config.fly.barDuration : config.fly.duration;
            if (mode === 'focused') startUnfocus(() => startTravel(index, travelDuration, true));
            else startTravel(index, travelDuration, false);
            return true;
        },

        /**
         * Rozpoczyna powrót do orbity wokół ciała centralnego (bez ponownego przybliżania).
         * @returns {boolean} false, gdy kamera już orbituje albo jest w ruchu
         */
        showOverview,

        /**
         * Włącza lub wyłącza przybliżenie na śledzoną planetę.
         * @param {boolean} on - true: przybliż (dwie fazy z przystankiem); false: oddal
         * @returns {boolean} false, gdy zmiana nie jest możliwa (ruch w toku, orbita wokół centrum, już w tym stanie)
         */
        setFocus(on) {
            if (isBusy()) return false;
            if (on && mode === 'follow') {
                startFocus();
                return true;
            }
            if (!on && mode === 'focused') {
                startUnfocus(null);
                return true;
            }
            return false;
        },

        /**
         * Przesuwa kamerę o jeden krok animacji.
         * @param {number} dt - czas od poprzedniej klatki w sekundach
         * @returns {void}
         */
        update(dt) {
            if (bodies.length === 0) return;

            if (mode === 'overview') {
                targetWorld(look);
                controls.target.copy(look);
                controls.update(dt);
                return;
            }

            if (mode === 'travel') {
                const t = advanceProgress(dt);
                look.lerpVectors(fromLook, targetWorld(targetPosition), t);
                camera.position.lerpVectors(fromPosition, home, t);
                camera.lookAt(look);
                if (progress >= 1) finishTravel();
                return;
            }

            targetWorld(look);
            aim.copy(look);
            if (mode === 'focusLock') {
                lockElapsed += dt;
                const offset = lockWobbleOffset(lockElapsed, config.focus.lockDuration, config.focus.wobble);
                addScreenOffset(aim, offset);
            }
            camera.lookAt(aim);

            if (!isBusy()) return;

            const t = advanceProgress(dt);
            if (mode !== 'focusHold') {
                camera.fov = THREE.MathUtils.lerp(fromFov, toFov, t);
                camera.updateProjectionMatrix();
            }
            if (progress >= 1) finishPhase();
        },
    };
}
