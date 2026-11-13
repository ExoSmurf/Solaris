/**
 * Wybiera ciało pod kursorem na ekranie: trafienie liczy się w promieniu większym niż sama planeta
 * (promień ciała × hitScale, ale nie mniej niż minHitRadius), a z kilku trafionych wygrywa najbliższe kursorowi.
 * @param {{x: number, y: number}} pointer - pozycja kursora w pikselach
 * @param {{index: number, x: number, y: number, radius: number}[]} candidates - środki i promienie ciał na ekranie w pikselach
 * @param {{minHitRadius: number, hitScale: number}} config - `hud.hover` z config/settings.js
 * @returns {number} indeks ciała albo -1, gdy kursor nie jest przy żadnym
 */
export function pickOnScreen(pointer, candidates, config) {
    let best = -1;
    let bestDistance = Infinity;
    for (const { index, x, y, radius } of candidates) {
        const distance = Math.hypot(pointer.x - x, pointer.y - y);
        const reach = Math.max(radius * config.hitScale, config.minHitRadius);
        if (distance <= reach && distance < bestDistance) {
            best = index;
            bestDistance = distance;
        }
    }
    return best;
}

/**
 * Co kursor może teraz zrobić: wycelować w planetę, przybliżyć albo oddalić zalockowaną planetę, albo nic.
 * @param {string} cameraMode - tryb kamery (cameraRig.mode)
 * @param {boolean} hovering - czy kursor jest nad planetą, którą można wybrać
 * @param {boolean} interactive - czy można teraz używać kursora (nic się nie rusza, nie trwa przelot)
 * @returns {'target'|'zoom-in'|'zoom-out'|'none'}
 */
export function cursorAction(cameraMode, hovering, interactive) {
    if (!interactive) return 'none';
    if (hovering) return 'target';
    if (cameraMode === 'follow') return 'zoom-in';
    if (cameraMode === 'focused') return 'zoom-out';
    return 'none';
}

/**
 * Czy naciśnięcie i puszczenie przycisku to kliknięcie, a nie przeciągnięcie (obrót kamery).
 * @param {{x: number, y: number}|null} down - pozycja kursora przy naciśnięciu
 * @param {{x: number, y: number}} up - pozycja kursora przy puszczeniu
 * @param {number} tolerance - największe przesunięcie w pikselach, które dalej jest kliknięciem
 * @returns {boolean}
 */
export function isClickGesture(down, up, tolerance) {
    if (!down) return false;
    return Math.hypot(up.x - down.x, up.y - down.y) <= tolerance;
}

/**
 * Tworzy celownik podglądu: ramka wokół planety pod kursorem z nazwą.
 * Stan trafia do `data-state` (hidden / hover); wygląd i animacje są w CSS.
 * @param {HTMLElement} element - kontener celownika (#targetReticle)
 * @param {{name: HTMLElement}} parts - element na nazwę planety
 * @param {{reveal: function(HTMLElement[], number, number): void, cancel: function(): void}} scrambler - "odszyfrowanie" nazwy
 * @param {{scrambleDuration: number, scrambleDelay: number}} config - czas odszyfrowania nazwy i opóźnienie startu w sekundach
 * @returns {{hover: function, hide: function}}
 *   hover(frame, name): pokazuje celownik w ramce z bracketFrame(); hide(): chowa
 */
export function createTargetReticle(element, parts, scrambler, config) {
    let state = 'hidden';
    let label = null;

    function setState(next) {
        if (state === next) return;
        state = next;
        element.dataset.state = next;
    }

    return {
        hover(frame, name) {
            element.style.transform = `translate(${frame.x.toFixed(1)}px, ${frame.y.toFixed(1)}px)`;
            element.style.width = `${frame.size.toFixed(1)}px`;
            element.style.height = `${frame.size.toFixed(1)}px`;
            if (name !== label) {
                label = name;
                parts.name.textContent = name;
                scrambler.reveal([parts.name], config.scrambleDuration, config.scrambleDelay);
            }
            setState('hover');
        },

        hide() {
            if (state !== 'hover') return;
            label = null;
            scrambler.cancel();
            setState('hidden');
        },
    };
}
