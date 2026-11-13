/**
 * Wybiera tekst i widoczność statusu kamery na podstawie jej trybu.
 * @param {string} mode - tryb kamery z cameraRig
 * @param {number} targetIndex - indeks śledzonego ciała (0 = ciało centralne, przy locie do niego nic nie pokazujemy)
 * @returns {{text: string, visibility: 'visible'|'fading'|'hidden'}}
 *   visible: widoczny; fading: zanika (po przybliżeniu); hidden: ukryty od razu
 */
export function cameraStatus(mode, targetIndex) {
    if (mode === 'travel' && targetIndex !== 0) return { text: 'searching...', visibility: 'visible' };
    if (mode === 'focusLock' || mode === 'focusHold') return { text: 'locking in...', visibility: 'visible' };
    if (mode === 'focusZoom') return { text: 'zooming...', visibility: 'visible' };
    if (mode === 'focused') return { text: 'zooming...', visibility: 'fading' };
    return { text: '', visibility: 'hidden' };
}

/**
 * Podpina status kamery do elementu DOM. Zmienia tekst i atrybut `data-state` tylko wtedy, gdy się zmieniły.
 * Przy `hidden` tekst nie jest czyszczony od razu, żeby nie mignął pusty napis.
 * @param {HTMLElement} element - element statusu (np. #cameraStatus)
 * @returns {{show: function({text: string, visibility: string}): void}}
 */
export function createCameraStatus(element) {
    let lastText = null;
    let lastVisibility = null;

    return {
        /**
         * Wyświetla status.
         * @param {{text: string, visibility: 'visible'|'fading'|'hidden'}} status - wynik cameraStatus()
         * @returns {void}
         */
        show({ text, visibility }) {
            if (visibility !== 'hidden' && text !== lastText) {
                element.textContent = text;
                lastText = text;
            }
            if (visibility !== lastVisibility) {
                element.dataset.state = visibility;
                lastVisibility = visibility;
            }
        },
    };
}
