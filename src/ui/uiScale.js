import { hud } from '../config/settings.js';

/** Rozmiar projektu, do którego skaluje się cały interfejs (ten sam układ w każdej rozdzielczości). */
export const DESIGN_WIDTH = 1666.67;
export const DESIGN_HEIGHT = 937.5;

/**
 * Współczynnik skali interfejsu: ile pikseli CSS ma jedna jednostka projektu.
 * Ta sama wartość co --u w base.css, więc HUD i CSS skalują się razem.
 * @returns {number}
 */
export function uiScale() {
    return Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);
}

/**
 * Konfiguracja HUD z wartościami w pikselach przeskalowanymi do aktualnej skali interfejsu.
 * @returns {{brackets: object, hover: object, fit: object}}
 */
export function scaledHud() {
    const s = uiScale();
    return {
        brackets: { ...hud.brackets, minSize: hud.brackets.minSize * s },
        hover: {
            ...hud.hover,
            minSize: hud.hover.minSize * s,
            minHitRadius: hud.hover.minHitRadius * s,
            clickTolerance: hud.hover.clickTolerance * s,
            hintOffset: hud.hover.hintOffset * s,
        },
        fit: { ...hud.fit, minSize: hud.fit.minSize * s },
    };
}
