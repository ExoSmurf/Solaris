import { hud as hudConfig, paths } from '../config/settings.js';
import { scaledHud } from "../ui/uiScale.js";
import { fitTextToWidth } from '../ui/fitText.js';
import { planetImageUrls } from '../ui/preloadImages.js';
import { openDialogWithHistory } from '../ui/dialogHistory.js';
import { globalPlanetIndex, state } from '../app/state.js';
import { planetsInfo } from './planetData.js';
import { setupZoomPan } from './zoomPan.js';

const FITTED_INFO_IDS = [
    "name",
    "id",
    "informacjeDiam",
    "informacjeMass",
    "informacjeRess",
    "informacjeOrbitalPeriod",
    "informacjeTemperature",
    "informacjeAxialTilt",
];
const INFO_PANEL_IDS = ["inspekcja", "inspekcjaDane", "container"];

/**
 * Panel informacji o wybranej planecie: tekst, parametry, zdjęcia i miniatury w dialogu.
 * @param {{slideshow: object, imagePreloader: object}} deps
 * @returns {object} sterowanie panelem
 */
export function createInfoPanel({ slideshow, imagePreloader }) {
    const el = (id) => document.getElementById(id);
    const zdjeciaDiv = el("zdjecia");
    const rowDiv = el("row");
    setupZoomPan(el("dialogImg"));

    /**
     * Usuwa wygenerowane zdjęcia i miniatury oraz czyści pokaz.
     * @returns {void}
     */
    function clear() {
        for (const node of Array.from(document.getElementsByClassName('removable'))) node.remove();
        slideshow.reset();
    }

    /**
     * Wypełnia panel danymi aktualnie wybranej planety.
     * @returns {void}
     */
    function update() {
        clear();
        const planet = planetsInfo[globalPlanetIndex(state.planetNo)];
        if (!planet) return;
        el("name").innerText = planet.name;
        el("informacje").innerText = planet.informacje;
        el("id").innerText = planet.id;
        el("informacjeDiam").innerText = planet.informacjeDiam;
        el("informacjeMass").innerText = planet.informacjeMass;
        el("informacjeRess").innerHTML = planet.informacjeRess;
        el("informacjeOrbitalPeriod").innerHTML = planet.informacjeOrbitalPeriod;
        el("informacjeTemperature").innerHTML = planet.informacjeTemperature;
        el("informacjeAxialTilt").innerHTML = planet.informacjeAxialTilt;

        planet.images.forEach((image, i) => {
            const src = paths.images + image + ".webp";

            const slideDiv = document.createElement("div");
            slideDiv.classList.add("slides", "removable");
            if (i === 0) slideDiv.classList.add("wyswietlanie");
            const slideImg = document.createElement("img");
            slideImg.src = src;
            slideImg.classList.add("zdjecia", "removable");
            slideImg.draggable = false;
            slideImg.loading = "lazy";
            slideDiv.appendChild(slideImg);
            zdjeciaDiv.appendChild(slideDiv);
            slideDiv.addEventListener("click", () => {
                openDialogWithHistory("dialogee");
                slideshow.show(i + 1);
            });

            const thumbDiv = document.createElement("div");
            thumbDiv.classList.add("column", "removable");
            const thumbImg = document.createElement("img");
            thumbImg.src = src;
            thumbImg.classList.add("demo", "cursor", "slide" + i, "removable");
            thumbImg.draggable = false;
            thumbImg.loading = "lazy";
            thumbImg.addEventListener("click", () => slideshow.show(i + 1));
            thumbDiv.appendChild(thumbImg);
            rowDiv.appendChild(thumbDiv);
        });
    }

    /**
     * Wczytuje z wyprzedzeniem zdjęcia wybranej planety (i karty parametrów).
     * @returns {void}
     */
    function preload() {
        imagePreloader.preload(paths.cardTextures);
        const planet = planetsInfo[globalPlanetIndex(state.planetNo)];
        if (planet) imagePreloader.preload(planetImageUrls(planet.images, paths.images));
    }

    /**
     * Dopasowuje rozmiar tekstu parametrów do szerokości kafelków.
     * @returns {void}
     */
    function fit() {
        for (const id of FITTED_INFO_IDS) {
            const element = el(id);
            const pill = element.closest("#podZdjeciem > div");
            if (pill) fitTextToWidth(element, pill, scaledHud().fit);
        }
    }

    /**
     * Pokazuje panel informacji.
     * @returns {void}
     */
    function show() {
        for (const id of INFO_PANEL_IDS) el(id).style.display = "block";
    }

    /**
     * Chowa panel informacji.
     * @returns {void}
     */
    function hide() {
        for (const id of INFO_PANEL_IDS) el(id).style.display = "none";
    }

    return {
        update,
        clear,
        preload,
        fit,
        show,
        hide,
        textElements: [el("podZdjeciem"), el("inspekcjaDane")],
    };
}
