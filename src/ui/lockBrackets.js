const COORDINATE_DECIMALS = 1;
const DELTA_DECIMALS = 2;

/**
 * Formatuje pozycję jako "[x, y, z]".
 * @param {{x: number, y: number, z: number}} position - pozycja planety w świecie
 * @returns {string} np. "[3.0, 0.0, -1.2]"
 */
export function formatCoordinates({ x, y, z }) {
    const format = (value) => {
        const text = value.toFixed(COORDINATE_DECIMALS);
        return text === `-${(0).toFixed(COORDINATE_DECIMALS)}` ? (0).toFixed(COORDINATE_DECIMALS) : text;
    };
    return `[${format(x)}, ${format(y)}, ${format(z)}]`;
}

/**
 * Przybliżony promień planety na ekranie w pikselach.
 * @param {number} worldRadius - promień planety w jednostkach świata
 * @param {number} distance - odległość kamery od środka planety
 * @param {number} fovDegrees - pionowy kąt widzenia kamery w stopniach
 * @param {number} viewportHeight - wysokość obszaru renderowania w pikselach
 * @returns {number} promień w pikselach (0, gdy odległość nie jest dodatnia)
 */
export function screenRadius(worldRadius, distance, fovDegrees, viewportHeight) {
    if (!(distance > 0)) return 0;
    const halfHeight = Math.tan((fovDegrees * Math.PI) / 360) * distance;
    return (worldRadius / halfHeight) * (viewportHeight / 2);
}

/**
 * Ease-out: szybki start, miękkie zatrzymanie (klamry "dojeżdżają" do celu).
 * @param {number} t - postęp 0..1 (przycinany)
 * @returns {number} wygładzony postęp 0..1
 */
export function easeOutCubic(t) {
    const x = Math.min(Math.max(t, 0), 1);
    return 1 - Math.pow(1 - x, 3);
}

/**
 * Wybiera stan klamer na podstawie trybu kamery.
 * @param {string} mode - tryb kamery z cameraRig
 * @param {number} phaseProgress - postęp bieżącej fazy kamery 0..1
 * @returns {{visibility: 'closing'|'locked'|'fading'|'hidden', closing: number}}
 *   closing: zamykanie się klamer w trakcie namierzania; locked: cel namierzony; fading: znikają; hidden: ukryte
 */
export function lockBracketsState(mode, phaseProgress) {
    if (mode === 'focusLock') return { visibility: 'closing', closing: phaseProgress };
    if (mode === 'focusHold') return { visibility: 'locked', closing: 1 };
    if (mode === 'focusZoom') return { visibility: 'fading', closing: 1 };
    return { visibility: 'hidden', closing: 0 };
}

/**
 * Liczy kwadrat, w którego rogach są klamry: od rozmiaru ekranu (closing = 0) do szerokości planety (closing = 1).
 * @param {{x: number, y: number}} center - środek planety na ekranie w pikselach
 * @param {number} radius - promień planety na ekranie w pikselach
 * @param {{width: number, height: number}} viewport - rozmiar obszaru renderowania
 * @param {number} closing - postęp zamykania 0..1
 * @param {{padding: number, minSize: number, startScale: number}} config - `hud.brackets` z config/settings.js
 * @returns {{x: number, y: number, size: number}} lewy górny róg i bok kwadratu w pikselach
 */
export function bracketFrame(center, radius, viewport, closing, config) {
    const target = Math.max(radius * 2 * config.padding, config.minSize);
    const start = Math.max(viewport.width, viewport.height, target) * config.startScale;
    const size = start + (target - start) * easeOutCubic(closing);
    return { x: center.x - size / 2, y: center.y - size / 2, size };
}

/**
 * Prędkość przesunięcia planety między dwiema klatkami.
 * @param {{x: number, y: number, z: number}} previous - pozycja w poprzedniej klatce
 * @param {{x: number, y: number, z: number}} current - pozycja w tej klatce
 * @param {number} dt - czas między klatkami w sekundach
 * @returns {number} jednostki świata na sekundę (0, gdy dt nie jest dodatnie)
 */
export function movementSpeed(previous, current, dt) {
    if (!(dt > 0)) return 0;
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const dz = current.z - previous.z;
    return Math.hypot(dx, dy, dz) / dt;
}

/**
 * Wygładza wartość, żeby liczba na ekranie nie skakała co klatkę (średnia krocząca wykładnicza).
 * @param {number} previous - poprzednia wygładzona wartość
 * @param {number} next - nowa surowa wartość
 * @param {number} smoothing - 0..1; im bliżej 1, tym wolniej reaguje
 * @returns {number} nowa wygładzona wartość
 */
export function smoothValue(previous, next, smoothing) {
    return previous * smoothing + next * (1 - smoothing);
}

/**
 * Formatuje prędkość jako "Δ 0.42 u/s".
 * @param {number} speed - jednostki świata na sekundę
 * @returns {string}
 */
export function formatDelta(speed) {
    return `Δ ${speed.toFixed(DELTA_DECIMALS)} u/s`;
}

/**
 * Podpina klamry do elementu DOM: kontener z czterema rogami, współrzędnymi w prawym górnym rogu
 * oraz prędkością i paskiem postępu w lewym dolnym rogu. Zmienia DOM tylko przy zmianie.
 * @param {HTMLElement} element - kontener klamer (np. #lockBrackets)
 * @param {{coordinates: {textContent: string}, delta: {textContent: string}, progress: {style: object}}} parts
 *   coordinates: etykieta współrzędnych; delta: etykieta prędkości; progress: wypełnienie paska postępu
 * @returns {{show: function({visibility: string}, {x: number, y: number, size: number}|null, {coordinates: string, delta: string, progress: number}): void}}
 */
export function createLockBrackets(element, parts) {
    const last = { visibility: null, transform: null, size: null, coordinates: null, delta: null, progress: null };

    function write(key, value, apply) {
        if (value === last[key]) return;
        apply(value);
        last[key] = value;
    }

    return {
        /**
         * Wyświetla klamry w danym stanie i ramce razem z odczytami.
         * @param {{visibility: string}} state - wynik lockBracketsState()
         * @param {{x: number, y: number, size: number}|null} frame - wynik bracketFrame() albo null, gdy planeta jest poza kadrem
         * @param {{coordinates: string, delta: string, progress: number}} readout - teksty i postęp namierzania 0..1
         * @returns {void}
         */
        show(state, frame, readout) {
            const visibility = frame ? state.visibility : 'hidden';
            write('visibility', visibility, (v) => { element.dataset.state = v; });
            if (!frame || visibility === 'hidden') return;

            write('coordinates', readout.coordinates, (v) => { parts.coordinates.textContent = v; });
            write('delta', readout.delta, (v) => { parts.delta.textContent = v; });
            const progress = Math.min(Math.max(readout.progress, 0), 1).toFixed(3);
            write('progress', progress, (v) => { parts.progress.style.transform = `scaleX(${v})`; });

            write('transform', `translate(${frame.x.toFixed(1)}px, ${frame.y.toFixed(1)}px)`, (v) => { element.style.transform = v; });
            write('size', `${frame.size.toFixed(1)}px`, (v) => {
                element.style.width = v;
                element.style.height = v;
            });
        },
    };
}
