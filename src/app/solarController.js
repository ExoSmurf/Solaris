import { renderFrame } from '../scene/engine.js';
import { prepareSystem, warmSystem } from '../systems/systemLoader.js';
import { state } from './state.js';

/**
 * Ładowanie układów i przelot między nimi (Słońce ↔ czarna dziura).
 * @param {object} deps
 * @returns {{boot: () => Promise<void>, nextSolar: () => void}}
 */
export function createSolarController({ engine, warp, warpStars, cameraRig, slideshow, infoPanel, planetBar, syncCameraUi, ensureLoop }) {
    const warmDeps = { renderer: engine.renderer, scene: engine.scene, camera: engine.camera, warpStars };

    /**
     * Pokazuje układ: dodaje do sceny, podpina pod kamerę i uruchamia pętlę.
     * @param {number} solarNo
     * @returns {Promise<void>}
     */
    async function loadSystem(solarNo) {
        const system = await prepareSystem(solarNo, engine.scene);
        engine.scene.add(system.root);
        state.bodiesBySolar[solarNo] = system.bodies;
        await warmSystem(system, warmDeps);
        state.activeSystem = system;
        cameraRig.setBodies(system.bodies);
        ensureLoop();
    }

    /**
     * Start strony: pod ekranem ładowania przygotowuje drugi układ, odkłada go, potem pokazuje pierwszy.
     * @returns {Promise<void>}
     */
    async function boot() {
        const background = await prepareSystem(2, engine.scene);
        state.bodiesBySolar[2] = background.bodies;
        await warmSystem(background, warmDeps);
        renderFrame(engine, state.lowQuality);
        engine.scene.remove(background.root);
        await loadSystem(1);
    }

    /**
     * Zdejmuje aktualny układ ze sceny i czyści panel.
     * @returns {void}
     */
    function unloadCurrentSolar() {
        if (state.activeSystem) engine.scene.remove(state.activeSystem.root);
        state.activeSystem = null;
        infoPanel.clear();
    }

    /**
     * Przełącza numer układu i ładuje go.
     * @returns {Promise<void>}
     */
    async function loadNextSolar() {
        state.currentSolar = state.currentSolar == 1 ? 2 : 1;
        infoPanel.clear();
        await loadSystem(state.currentSolar);
        planetBar.build();
    }

    /**
     * Chowa pasek planet i zaczyna przelot do drugiego układu.
     * @returns {void}
     */
    function startWarp() {
        slideshow.hideArrow();
        planetBar.stow(true);
        warp.start({
            onCruise: () => {
                unloadCurrentSolar();
                loadNextSolar()
                    .then(() => {
                        warp.arrive();
                        planetBar.stow(false);
                    })
                    .catch(console.error);
            },
            onDone: () => {
                state.isSwitchingSolar = false;
                infoPanel.update();
                planetBar.updateActive();
            },
        });
    }

    /**
     * Przycisk przelotu: najpierw wyśrodkowuje kamerę na orbicie, potem startuje przelot.
     * @returns {void}
     */
    function nextSolar() {
        if (state.isSwitchingSolar) return;
        state.isSwitchingSolar = true;
        if (cameraRig.setFocus(false, { then: startWarp })) {
            syncCameraUi();
            return;
        }
        startWarp();
    }

    return { boot, nextSolar };
}
