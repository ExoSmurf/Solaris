import { systems } from '../config/systems.js';

const PLUTO_DWELL_MS = 5000;
const PLUTO_LABEL = 'STILL A PLANET TO US';
const ALL_SCANNED_LABEL = 'ALL SYSTEMS SCANNED';

const planetIds = [...systems.sun.bodies, ...systems.blackhole.bodies]
    .filter((body) => body.showInBar !== false)
    .map((body) => body.id);

/**
 * Easter eggi: 7 kliknięć w Słońce, dłuższe najechanie na Plutona i odwiedzenie wszystkich planet.
 * @param {{starfield: THREE.Points}} deps
 * @returns {object} metody wołane z picker'a i panelu kamery
 */
export function createEasterEggs({ starfield }) {
    const toast = document.getElementById('eggToast');
    const visited = new Set();
    let scannedAll = false;
    let hoveredBody = null;
    let hoverSince = 0;

    /**
     * Krótki komunikat na ekranie.
     * @param {string} text
     * @returns {void}
     */
    function showToast(text) {
        toast.textContent = text;
        toast.dataset.state = 'visible';
        clearTimeout(showToast.timer);
        showToast.timer = setTimeout(() => {
            toast.dataset.state = 'hidden';
        }, 2600);
    }

    return {
        /**
         * Etykieta celownika: dla Plutona po dłuższym najechaniu zmienia się w hasło.
         * @param {object|null} body - ciało pod kursorem
         * @param {string} name - zwykła nazwa planety
         * @returns {string}
         */
        labelFor(body, name) {
            if (body?.id !== 'pluto') return name;
            const now = performance.now();
            if (hoveredBody !== body) {
                hoveredBody = body;
                hoverSince = now;
            }
            return now - hoverSince >= PLUTO_DWELL_MS ? PLUTO_LABEL : name;
        },

        /**
         * Kursor opuścił planetę.
         * @returns {void}
         */
        clearHover() {
            hoveredBody = null;
        },

        /**
         * Zapisuje odwiedzoną planetę; po wszystkich planetach pokazuje komunikat i błysk gwiazd.
         * @param {object|null} body
         * @returns {void}
         */
        visit(body) {
            if (!body || body.isMoon || scannedAll) return;
            visited.add(body.id);
            if (visited.size < planetIds.length) return;
            scannedAll = true;
            showToast(ALL_SCANNED_LABEL);
            const material = starfield.material;
            const base = material.size;
            material.size = base * 2.2;
            setTimeout(() => {
                material.size = base;
            }, 1200);
        },
    };
}

