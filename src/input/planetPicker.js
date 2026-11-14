import * as THREE from 'three';
import { hud as hudConfig } from '../config/settings.js';
import { createTargetReticle, cursorAction, isClickGesture, pickOnScreen } from '../ui/targetReticle.js';
import { createScrambler } from '../ui/scrambleText.js';
import { bracketFrame } from '../ui/lockBrackets.js';
import { scaledHud } from "../ui/uiScale.js";
import { projectToScreen } from '../scene/projection.js';
import { activeBodies, globalPlanetIndex, state, systemReady } from '../app/state.js';
import { planetsInfo } from '../info/planetData.js';

const CURSOR_STYLES = { target: "crosshair", "zoom-in": "zoom-in", "zoom-out": "zoom-out", none: "" };
const CURSOR_HINTS = { "zoom-in": "RMB // ZOOM IN", "zoom-out": "RMB // ZOOM OUT" };
const MOUSE_BUTTON = { primary: 0, secondary: 2 };

/**
 * Celowanie myszką w planety: podgląd celownikiem pod kursorem, klik LPM wybiera, PPM przybliża.
 * @param {{engine: object, cameraRig: object, warp: object, syncCameraUi: () => void}} deps
 * @returns {{update: () => void}}
 */
export function createPlanetPicker({ engine, cameraRig, warp, syncCameraUi, eggs }) {
    const { renderer, camera } = engine;
    const reticleElement = document.getElementById("targetReticle");
    const reticle = createTargetReticle(
        reticleElement,
        { name: reticleElement.querySelector(".reticle-name") },
        createScrambler(),
        hudConfig.hover,
    );
    const cursorHint = document.getElementById("cursorHint");
    const pointer = { x: 0, y: 0, inside: false, down: null };
    const hoverPosition = new THREE.Vector3();
    let hoveredIndex = -1;
    let shownCursorAction = null;

    /**
     * Czy można teraz celować kursorem (nic się nie rusza, nie trwa przelot).
     * @returns {boolean}
     */
    function canTarget() {
        return systemReady() && !warp.active && !state.isSwitchingSolar && !cameraRig.isBusy();
    }

    /**
     * Rzut ciała na ekran; null, gdy poza kadrem.
     * @param {object} body
     * @returns {{center: {x: number, y: number}, radius: number}|null}
     */
    function screenPlacement(body) {
        body.worldCenter(hoverPosition);
        return projectToScreen(hoverPosition, body.radius, camera);
    }

    /**
     * Planety, w które można wycelować: bez księżyców, obecnego celu i ciał poza kadrem.
     * @returns {{index: number, x: number, y: number, radius: number}[]}
     */
    function hoverCandidates() {
        const candidates = [];
        activeBodies().forEach((body, index) => {
            if (body.isMoon || index === cameraRig.targetIndex) return;
            const placement = screenPlacement(body);
            if (placement) candidates.push({ index, ...placement.center, radius: placement.radius });
        });
        return candidates;
    }

    /**
     * Ramka celownika wokół ciała na ekranie.
     * @param {object} body
     * @returns {object|null}
     */
    function hoverFrame(body) {
        const placement = screenPlacement(body);
        if (!placement) return null;
        const viewport = { width: window.innerWidth, height: window.innerHeight };
        return bracketFrame(placement.center, placement.radius, viewport, 1, scaledHud().hover);
    }

    /**
     * Ustawia kursor nad sceną i podpowiedź przy nim.
     * @param {'target'|'zoom-in'|'zoom-out'|'none'} action - wynik cursorAction()
     * @returns {void}
     */
    function showCursorAction(action) {
        if (action !== shownCursorAction) {
            shownCursorAction = action;
            renderer.domElement.style.cursor = CURSOR_STYLES[action];
            const hint = CURSOR_HINTS[action];
            if (hint) cursorHint.textContent = hint;
            cursorHint.dataset.state = hint ? "visible" : "hidden";
        }
        if (CURSOR_HINTS[action]) {
            cursorHint.style.transform = `translate(${pointer.x + scaledHud().hover.hintOffset}px, ${pointer.y + scaledHud().hover.hintOffset}px)`;
        }
    }

    /**
     * Szuka planety pod kursorem i ustawia na niej celownik podglądu (albo go chowa).
     * @returns {void}
     */
    function update() {
        camera.updateMatrixWorld();
        hoveredIndex = -1;
        const interactive = pointer.inside && canTarget();
        if (interactive) hoveredIndex = pickOnScreen(pointer, hoverCandidates(), scaledHud().hover);
        showCursorAction(cursorAction(cameraRig.mode, hoveredIndex >= 0, interactive));
        if (hoveredIndex < 0) {
            eggs.clearHover();
            reticle.hide();
            return;
        }
        const frame = hoverFrame(activeBodies()[hoveredIndex]);
        if (!frame) {
            reticle.hide();
            return;
        }
        reticle.hover(frame, eggs.labelFor(activeBodies()[hoveredIndex], planetsInfo[globalPlanetIndex(hoveredIndex)].name));
    }

    /**
     * LPM: kamera leci do planety pod kursorem, celownik znika.
     * @returns {void}
     */
    function selectHovered() {
        if (hoveredIndex < 0 || !canTarget()) return;
        if (!cameraRig.select(hoveredIndex)) return;
        reticle.hide();
        showCursorAction("none");
        syncCameraUi();
    }

    /**
     * PPM: przybliża zalockowaną planetę albo oddala (to samo co przełącznik Planet Focus).
     * @returns {void}
     */
    function toggleZoom() {
        if (!systemReady() || warp.active || state.isSwitchingSolar || cameraRig.isBusy()) return;
        if (cameraRig.setFocus(!cameraRig.isFocused())) syncCameraUi();
    }

    const canvas = renderer.domElement;
    canvas.addEventListener("pointermove", (event) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.inside = true;
    });
    canvas.addEventListener("pointerleave", () => {
        pointer.inside = false;
    });
    canvas.addEventListener("pointerdown", (event) => {
        pointer.down = { x: event.clientX, y: event.clientY, button: event.button };
    });
    canvas.addEventListener("pointerup", (event) => {
        const clicked = isClickGesture(pointer.down, { x: event.clientX, y: event.clientY }, scaledHud().hover.clickTolerance);
        const button = pointer.down?.button;
        pointer.down = null;
        if (!clicked) return;
        if (button === MOUSE_BUTTON.primary) {
            selectHovered();
        }
        else if (button === MOUSE_BUTTON.secondary) toggleZoom();
    });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    return { update };
}
