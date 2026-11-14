import { createSlideArrow } from '../ui/slideArrow.js';
import { resetZoomPan } from './zoomPan.js';

/**
 * Pokaz zdjęć planety w dialogu: strzałki, miniatury i zamykanie.
 * @returns {{show: (n: number) => void, step: (delta: number) => void, reset: () => void, hideArrow: () => void}}
 */
export function createSlideshow() {
    const dialogImg = document.getElementById("dialogImg");
    const slideArrow = createSlideArrow(
        document.getElementById("arrowSelectArrow"),
        document.getElementById("row"),
        ".column.removable",
    );
    let slideNo = 1;

    /**
     * Pokazuje zdjęcie o numerze n (zawijając na krańcach).
     * @param {number} n - numer od 1
     * @returns {void}
     */
    function show(n) {
        const slides = document.getElementsByClassName("slides");
        if (slides.length === 0) return;
        slideNo = n > slides.length ? 1 : n < 1 ? slides.length : n;
        const shown = slideNo;

        for (const slide of slides) slide.classList.remove("wyswietlanie");
        slides[slideNo - 1].classList.add("wyswietlanie");

        const lowResSrc = slides[slideNo - 1].children[0].src;
        dialogImg.src = lowResSrc;
        resetZoomPan(dialogImg);
        const highRes = new Image();
        highRes.src = lowResSrc.replace(".webp", "2.webp");
        highRes.onload = () => {
            if (slideNo === shown) dialogImg.src = highRes.src;
        };
        slideArrow.show(slideNo - 1);
    }

    /**
     * Przechodzi o delta zdjęć w przód lub w tył.
     * @param {number} delta
     * @returns {void}
     */
    function step(delta) {
        show(slideNo + delta);
    }

    /**
     * Czyści pokaz: chowa strzałkę i obraz, wraca do pierwszego zdjęcia.
     * @returns {void}
     */
    function reset() {
        slideArrow.hide();
        slideNo = 1;
        dialogImg.src = "";
    }

    document.getElementById("dialogee").addEventListener("close", reset);

    return { show, step, reset, hideArrow: () => slideArrow.hide() };
}
