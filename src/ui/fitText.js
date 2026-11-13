/**
 * Szuka największego rozmiaru czcionki, przy którym tekst się mieści (co `step` pikseli, od największego).
 * @param {function(number): boolean} fits - sprawdza, czy tekst mieści się przy danym rozmiarze w pikselach
 * @param {number} maxSize - rozmiar startowy (zwykle rozmiar z CSS)
 * @param {number} minSize - najmniejszy dopuszczalny rozmiar
 * @param {number} [step=1] - krok zmniejszania w pikselach
 * @returns {number} największy pasujący rozmiar albo `minSize`, gdy nic nie pasuje
 */
export function fitFontSize(fits, maxSize, minSize, step = 1) {
    for (let size = maxSize; size > minSize; size -= step) {
        if (fits(size)) return size;
    }
    return minSize;
}

/**
 * Zmniejsza czcionkę elementu tak, żeby jego tekst nie wychodził poza szerokość kontenera.
 * Najpierw przywraca rozmiar z CSS, więc krótszy tekst po zmianie planety znowu dostanie pełny rozmiar.
 * Działa tylko na widocznym elemencie (ukryty ma szerokość 0 i jest pomijany).
 * @param {HTMLElement} element - element z tekstem
 * @param {HTMLElement} container - element, w którym tekst ma się zmieścić
 * @param {{minSize: number, padding: number}} options - minimalny rozmiar i zapas od krawędzi w pikselach
 * @returns {void}
 */
export function fitTextToWidth(element, container, { minSize, padding }) {
    element.style.fontSize = '';
    const available = container.clientWidth - padding * 2;
    if (available <= 0) return;
    const textWidth = () => Math.max(element.scrollWidth, element.getBoundingClientRect().width);
    const cssSize = parseFloat(getComputedStyle(element).fontSize);
    if (textWidth() <= available) return;
    const size = fitFontSize((candidate) => {
        element.style.fontSize = `${candidate}px`;
        return textWidth() <= available;
    }, cssSize, minSize);
    element.style.fontSize = `${size}px`;
}
