/**
 * Pozycja `top` strzałki (w pikselach względem kolumny miniatur), przy której jej środek wypada na środku miniatury.
 * @param {number} rowTop - górna krawędź kolumny miniatur na ekranie
 * @param {number} itemTop - górna krawędź wybranej miniatury na ekranie
 * @param {number} itemHeight - wysokość wybranej miniatury
 * @param {number} arrowHeight - wysokość strzałki (bez obrotu)
 * @returns {number} wartość `top` w pikselach
 */
export function arrowTop(rowTop, itemTop, itemHeight, arrowHeight) {
    return itemTop + itemHeight / 2 - rowTop - arrowHeight / 2;
}

/**
 * Steruje strzałką wskazującą wybraną miniaturę w podglądzie zdjęć.
 * Pozycję liczy tylko wtedy, gdy kolumna miniatur jest widoczna, i ustawia ją ponownie po załadowaniu każdej miniatury.
 * Pierwsze ustawienie po pokazaniu jest natychmiastowe, kolejne przejścia są animowane (przez transition z CSS).
 * @param {HTMLElement} arrow - strzałka (#arrowSelectArrow)
 * @param {HTMLElement} row - kolumna miniatur (#row)
 * @param {string} itemSelector - selektor miniatur w kolumnie (np. ".column.removable")
 * @returns {{show: function(number): void, hide: function(): void}}
 */
export function createSlideArrow(arrow, row, itemSelector) {
    let index = null;
    let placed = false;

    function isVisible() {
        return row.getClientRects().length > 0;
    }

    function place(animate) {
        if (index === null || !isVisible()) return;
        const item = row.querySelectorAll(itemSelector)[index];
        if (!item) return;

        arrow.style.display = 'block';
        if (!animate) arrow.style.transition = 'none';

        const rowRect = row.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        arrow.style.top = `${arrowTop(rowRect.top, itemRect.top, itemRect.height, arrow.offsetHeight)}px`;

        if (!animate) {
            void arrow.offsetHeight;
            arrow.style.transition = '';
        }
        placed = true;
    }

    row.addEventListener('load', () => place(false), true);
    window.addEventListener('resize', () => place(false));

    return {
        /**
         * Pokazuje strzałkę przy miniaturze o danym indeksie. Animuje tylko, gdy strzałka już stała na miejscu.
         * @param {number} itemIndex - indeks miniatury (od 0)
         * @returns {void}
         */
        show(itemIndex) {
            const animate = placed && isVisible() && arrow.style.display !== 'none';
            index = itemIndex;
            if (!isVisible()) placed = false;
            place(animate);
        },

        /**
         * Ukrywa strzałkę; następne pokazanie ustawi ją od razu, bez animacji.
         * @returns {void}
         */
        hide() {
            index = null;
            placed = false;
            arrow.style.display = 'none';
        },
    };
}
