import { camera as cameraConfig, warp as warpConfig } from './config/settings.js';
import { createEngine } from './scene/engine.js';
import { addLights } from './scene/lighting.js';
import { createStarfield } from './scene/starfield.js';
import { createWarpTransition, createWarpStars } from './camera/warpTransition.js';
import { createCameraRig } from './camera/cameraRig.js';
import { createScrambler } from './ui/scrambleText.js';
import { createImagePreloader } from './ui/preloadImages.js';
import { createTargetHud } from './hud/targetHud.js';
import { createPlanetPicker } from './input/planetPicker.js';
import { createSlideshow } from './info/slideshow.js';
import { createInfoPanel } from './info/infoPanel.js';
import { createPlanetBar } from './navigation/planetBar.js';
import { createSolarController } from './app/solarController.js';
import { createCameraUi } from './app/cameraUi.js';
import { createRenderLoop } from './app/loop.js';
import { createLoadingScreen } from './loading/loadingScreen.js';
import { bindActions } from './ui/actions.js';
import { closeDialogById, initDialogHistory } from './ui/dialogHistory.js';
import { initMasterGallery } from './gallery/masterGallery.js';
import { initContact } from './ui/contact.js';
import { state, systemReady } from './app/state.js';

const engine = createEngine(document.getElementById("container3D"));
const { scene, camera, orbit } = engine;
addLights(scene);
const starfield = createStarfield();
scene.add(starfield);
const warp = createWarpTransition(warpConfig);
const warpStars = createWarpStars(warpConfig.stars);
scene.add(warpStars.object);

let ui = null;
const cameraRig = createCameraRig({
    camera,
    controls: orbit,
    config: cameraConfig,
    onChange: () => ui?.sync(),
});

const hud = createTargetHud({ camera, cameraRig });
const scrambler = createScrambler();
const slideshow = createSlideshow();
const infoPanel = createInfoPanel({ slideshow, imagePreloader: createImagePreloader() });
const planetBar = createPlanetBar({ cameraRig });
const picker = createPlanetPicker({ engine, cameraRig, warp, syncCameraUi: () => ui.sync() });
const loop = createRenderLoop({ engine, cameraRig, hud, planetPicker: picker, warp, warpStars, starfield });
const solar = createSolarController({
    engine,
    warp,
    warpStars,
    cameraRig,
    slideshow,
    infoPanel,
    planetBar,
    syncCameraUi: () => ui.sync(),
    ensureLoop: loop.ensureRunning,
});
ui = createCameraUi({
    cameraRig,
    scrambler,
    infoPanel,
    planetBar,
    solar,
});
ui.bindControls();
infoPanel.hide();

initDialogHistory();
initMasterGallery();
initContact();
bindActions({
    "slide-next": () => slideshow.step(1),
    "slide-prev": () => slideshow.step(-1),
    "dialog-close": () => closeDialogById("dialogee"),
    "contact-close": () => closeDialogById("contactDialog"),
    "gallery-close": () => closeDialogById("masterGalleryDialog"),
    "gallery-image-close": () => closeDialogById("galleryImageDialog"),
});

createLoadingScreen({
    isReady: systemReady,
    onFinished: () => {
        planetBar.build();
        document.querySelector("#planetBar .planetBar-btn")?.classList.add("active");
        slideshow.hideArrow();
        document.getElementById("main").classList.add("slideIn");
    },
});

solar.boot().catch(console.error);

if (new URLSearchParams(location.search).has('test')) {
    window.__solar = {
        get system() { return state.currentSolar; },
        get planet() { return cameraRig.targetIndex; },
        get fov() { return camera.fov; },
        get transitionComplete() { return !cameraRig.isBusy(); },
        get cameraMode() { return cameraRig.mode; },
        get warping() { return warp.active; },
        get loaded() { return systemReady(); },
        scene,
        camera,
        renderer: engine.renderer,
    };
}
