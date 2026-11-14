import { nextPlanetIndex } from '../camera/cameraRig.js';
import { hud } from '../config/settings.js';
import { activeBodies, state } from './state.js';

/**
 * Synchronizacja przycisków i przełączników z kamerą oraz ich obsługa.
 * @param {{cameraRig: object, scrambler: object, infoPanel: object, planetBar: object, solar: object}} deps
 * @returns {{sync: () => void, bindControls: () => void}}
 */
export function createCameraUi({ cameraRig, scrambler, infoPanel, planetBar, solar }) {
    const nextButton = document.getElementById("next");
    const solarButton = document.getElementById("solar");
    const focusSwitch = document.getElementById("switch");
    const lowQualitySwitch = document.getElementById("switch2");
    let lastSyncedMode = null;

    /**
     * Ustawia stan UI zgodnie z trybem kamery (blokady, panel informacji, pasek planet).
     * @returns {void}
     */
    function sync() {
        const busy = cameraRig.isBusy();
        const mode = cameraRig.mode;

        if (state.planetNo !== cameraRig.targetIndex) {
            state.planetNo = cameraRig.targetIndex;
            infoPanel.update();
        }

        nextButton.disabled = busy;
        solarButton.disabled = busy;
        focusSwitch.disabled = busy || mode === 'overview';
        focusSwitch.checked = cameraRig.isFocused();

        if (mode === 'focusLock' && lastSyncedMode !== 'focusLock') infoPanel.preload();
        if (mode === 'focused') {
            if (lastSyncedMode !== 'focused') {
                infoPanel.show();
                infoPanel.fit();
                scrambler.reveal(infoPanel.textElements, hud.scramble.duration, hud.scramble.delay);
            }
        } else {
            scrambler.cancel();
            infoPanel.hide();
        }
        lastSyncedMode = mode;

        document.querySelectorAll(".planetBar-btn").forEach((btn) => btn.classList.toggle("disabled", busy));
        planetBar.updateActive();
    }

    /**
     * Podpina przyciski Next, Solar, NextSolar, przełączniki Planet Focus i jakości.
     * @returns {void}
     */
    function bindControls() {
        const handlers = {
            next: () => cameraRig.select(nextPlanetIndex(activeBodies(), cameraRig.targetIndex)),
            solar: () => cameraRig.showOverview(),
            nextSolar: () => solar.nextSolar(),
        };
        for (const [id, handler] of Object.entries(handlers)) {
            document.getElementById(id).addEventListener("click", () => {
                if (cameraRig.isBusy()) return;
                handler();
            });
        }
        focusSwitch.addEventListener("change", () => {
            cameraRig.setFocus(focusSwitch.checked);
            sync();
        });
        lowQualitySwitch.addEventListener("change", () => {
            state.lowQuality = lowQualitySwitch.checked;
        });
        focusSwitch.checked = false;
    }

    return { sync, bindControls };
}
