import * as THREE from 'three';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { systems } from "./config/systems.js";
import { bodyInfo } from "./config/info.js";
import { paths, camera as cameraConfig, light as lightConfig, render as renderConfig, motion as motionConfig, hud as hudConfig, loading as loadingConfig, warp as warpConfig } from "./config/settings.js";
import { loadSolarSystem } from "./world/solarSystem.js";
import { framesBetween } from "./motion/motion.js";
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { createCameraRig, nextPlanetIndex } from './camera/cameraRig.js';
import { createWarpTransition, createWarpStars } from './camera/warpTransition.js';
import { cameraStatus, createCameraStatus } from './ui/cameraStatus.js';
import {
    bracketFrame,
    createLockBrackets,
    formatCoordinates,
    formatDelta,
    lockBracketsState,
    movementSpeed,
    screenRadius,
    searchCoordinates,
    searchSpread,
    smoothValue,
} from './ui/lockBrackets.js';
import { fitTextToWidth } from './ui/fitText.js';
import { createSlideArrow } from './ui/slideArrow.js';
import { closeDialog, isDialogVisible, openDialog, preventInstantEscape } from './ui/dialogs.js';
import { createScrambler } from './ui/scrambleText.js';
import { createTargetReticle, cursorAction, isClickGesture, pickOnScreen } from './ui/targetReticle.js';
import { createImagePreloader, planetImageUrls } from './ui/preloadImages.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.debug.checkShaderErrors = import.meta.env.DEV;
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = renderConfig.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;

renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap;

let scene = new THREE.Scene;
let camera = new THREE.PerspectiveCamera(
    cameraConfig.fov.default,
    window.innerWidth / window.innerHeight,
    cameraConfig.clip.near,
    cameraConfig.clip.far);

const START_POSITION = new THREE.Vector3(
    cameraConfig.position.start.x,
    cameraConfig.position.start.y,
    cameraConfig.position.start.z);
camera.position.copy(START_POSITION);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.autoRotate = true;
orbit.rotateSpeed = cameraConfig.orbit.rotateSpeed;
orbit.autoRotateSpeed = cameraConfig.orbit.autoRotateSpeed;
orbit.enableDamping = true;
orbit.dampingFactor = cameraConfig.orbit.dampingFactor;
orbit.enableZoom = false;
orbit.minDistance = cameraConfig.orbit.minDistance;
orbit.maxDistance = cameraConfig.orbit.maxDistance;

const renderScene = new RenderPass(scene, camera)
const composer = new EffectComposer(renderer)
composer.addPass(renderScene);

const bloomResolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
const bloomPass = new UnrealBloomPass(
    bloomResolution,
    renderConfig.bloom.strength,
    renderConfig.bloom.radius,
    renderConfig.bloom.threshold
)
composer.addPass(bloomPass)

function getStarfield({ numStars = 2500 } = {}) {
    function randomSpherePoint() {
        const radius = Math.random() * 25 + 35;
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        let x = radius * Math.sin(phi) * Math.cos(theta);
        let y = radius * Math.sin(phi) * Math.sin(theta);
        let z = radius * Math.cos(phi);

        return {
            pos: new THREE.Vector3(x, y, z),
            hue: 0.6,
            minDist: radius,
        };
    }
    const verts = [];
    const colors = [];
    const positions = [];
    let col;
    for (let i = 0; i < numStars; i += 1) {
        let p = randomSpherePoint();
        const { pos, hue } = p;
        positions.push(p);
        col = new THREE.Color().setHSL(hue, 0.2, Math.random());
        verts.push(pos.x, pos.y, pos.z);
        colors.push(col.r, col.g, col.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
        size: 0.2,
        vertexColors: true,
        map: new THREE.TextureLoader().load(
            "./textures/circle.webp"
        ),
    });
    const points = new THREE.Points(geo, mat);
    return points;
}
const starfield = getStarfield();
starfield.name = "starfield";
starfield.material.transparent = true;
scene.add(starfield)

const warp = createWarpTransition(warpConfig);
const warpStars = createWarpStars(warpConfig.stars);
scene.add(warpStars.object);
const warpShift = new THREE.Vector3();

let currentSolar = 1
let planetySun = []
let planetyBlackHole = []
let activeSystem = null
let renderLoopRunning = false
const SYSTEM_KEYS = { 1: 'sun', 2: 'blackhole' };

const systemCache = new Map();

/**
 * Ładuje układ raz i trzyma go w pamięci; kolejne wywołania zwracają ten sam układ.
 * Świeżo załadowany układ jest od razu w scenie.
 * @param {number} solarNo - numer układu (1: Słońce, 2: czarna dziura)
 * @returns {Promise<object>} układ z world/solarSystem.js
 */
async function prepareSystem(solarNo) {
    if (!systemCache.has(solarNo)) {
        const system = await loadSolarSystem(systems[SYSTEM_KEYS[solarNo]], { scene });
        system.solarNo = solarNo;
        system.warmed = false;
        systemCache.set(solarNo, system);
    }
    return systemCache.get(solarNo);
}

/**
 * Kompiluje shadery i wysyła tekstury układu na GPU, zanim zostanie pokazany.
 * @param {object} system - układ z prepareSystem
 * @returns {Promise<void>}
 */
async function warmSystem(system) {
    if (system.warmed) return;
    warpStars.object.visible = true;
    await renderer.compileAsync(scene, camera);
    warpStars.object.visible = false;
    await uploadTexturesGradually(system.root);
    system.warmed = true;
}

/**
 * Pokazuje układ: dodaje go do sceny, podpina pod kamerę i uruchamia pętlę animacji.
 * @param {number} solarNo - numer układu
 * @returns {Promise<void>}
 */
async function loadSystem(solarNo) {
    const system = await prepareSystem(solarNo);
    scene.add(system.root);
    if (solarNo == 1) planetySun = system.bodies;
    else planetyBlackHole = system.bodies;
    await warmSystem(system);
    activeSystem = system;
    cameraRig.setBodies(system.bodies);
    if (!renderLoopRunning) {
        renderLoopRunning = true;
        animate();
    }
}

/**
 * Start strony: pod ekranem ładowania przygotowuje najpierw drugi układ (jedna ukryta klatka
 * kompiluje wszystkie shadery, także cieni, i wysyła tekstury), odkłada go, a potem pokazuje pierwszy.
 * Dzięki temu przelot między układami nie musi niczego ładować ani kompilować.
 * @returns {Promise<void>}
 */
async function boot() {
    const background = await prepareSystem(2);
    planetyBlackHole = background.bodies;
    await warmSystem(background);
    render();
    scene.remove(background.root);
    await loadSystem(1);
}
boot().catch(console.error);

/**
 * Czeka na następną klatkę animacji.
 * @returns {Promise<number>}
 */
function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
}

/**
 * Wysyła tekstury modelu na GPU po jednej na klatkę, żeby nie robić tego naraz w pierwszej klatce
 * z nowym układem (to dawało widoczne przycięcie animacji).
 * @param {THREE.Object3D} root - model albo cały układ
 * @returns {Promise<void>}
 */
async function uploadTexturesGradually(root) {
    const textures = new Set();
    root.traverse((node) => {
        if (!node.isMesh) return;
        for (const value of Object.values(node.material)) {
            if (value?.isTexture) textures.add(value);
        }
    });
    for (const texture of textures) {
        renderer.initTexture(texture);
        await nextFrame();
    }
}

function systemReady() {
    return activeSystem !== null && activeSystem.solarNo === currentSolar;
}

let lastFrameTime = performance.now();

document.getElementById("container3D").appendChild(renderer.domElement);
function light() {
    const { color, ambientIntensity, offsetFromCenter: d, point } = lightConfig;
    const offsets = [[0, d, 0], [0, -d, 0], [d, 0, 0], [-d, 0, 0], [0, 0, d], [0, 0, -d]];
    for (const [x, y, z] of offsets) {
        const pointLight = new THREE.PointLight(color);
        pointLight.castShadow = true;
        pointLight.shadow.bias = point.shadow.bias;
        pointLight.shadow.normalBias = point.shadow.normalBias;
        pointLight.shadow.radius = point.shadow.radius;
        pointLight.shadow.mapSize.width = point.shadow.mapSize;
        pointLight.shadow.mapSize.height = point.shadow.mapSize;
        pointLight.shadow.camera.near = point.shadow.near;
        pointLight.shadow.camera.far = point.distance;
        pointLight.position.set(x, y, z);
        pointLight.distance = point.distance;
        pointLight.power = point.power;
        scene.add(pointLight);
    }
    scene.add(new THREE.AmbientLight(color, ambientIntensity));
}

light();

let planetNo = 0
let lowQualitySwitch = false

const cameraRig = createCameraRig({
    camera,
    controls: orbit,
    config: cameraConfig,
    onChange: syncCameraUi,
});

const statusDisplay = createCameraStatus(document.getElementById("cameraStatus"));
const bracketsElement = document.getElementById("lockBrackets");
const bracketsDisplay = createLockBrackets(bracketsElement, {
    coordinates: bracketsElement.querySelector(".bracket-label"),
    delta: bracketsElement.querySelector(".bracket-delta"),
    progress: bracketsElement.querySelector(".bracket-progress-fill"),
});
const scrambler = createScrambler();
const imagePreloader = createImagePreloader();
const hudPreviousPosition = new THREE.Vector3();
let hudPreviousTarget = null;
let hudSpeed = 0;
let lastSyncedMode = null;
let hudClock = 0;
const hudTargetPosition = new THREE.Vector3();
const hudProjected = new THREE.Vector3();

function updateHud(dt) {
    const body = activeBodies()[cameraRig.targetIndex];
    if (!body) return;
    camera.updateMatrixWorld();
    body.worldCenter(hudTargetPosition);

    if (hudPreviousTarget === body) {
        hudSpeed = smoothValue(hudSpeed, movementSpeed(hudPreviousPosition, hudTargetPosition, dt), hudConfig.delta.smoothing);
    } else {
        hudSpeed = 0;
        hudPreviousTarget = body;
    }
    hudPreviousPosition.copy(hudTargetPosition);

    statusDisplay.show(cameraStatus(cameraRig.mode, cameraRig.targetIndex));

    const bracketsState = lockBracketsState(
        cameraRig.mode,
        cameraRig.phaseProgress,
        cameraRig.refocusing,
        hudConfig.brackets.searchClosing,
    );
    hudClock += dt;
    const placement = bracketsState.visibility === 'hidden' ? null : bracketPlacement(body, bracketsState.closing);
    bracketsDisplay.show(bracketsState, placement?.frame ?? null, {
        coordinates: formatCoordinates(bracketCoordinates(bracketsState, body, placement)),
        delta: formatDelta(hudSpeed),
        progress: bracketsState.closing,
    });
}

const reticleElement = document.getElementById("targetReticle");
const reticle = createTargetReticle(
    reticleElement,
    { name: reticleElement.querySelector(".reticle-name") },
    createScrambler(),
    hudConfig.hover,
);
const pointer = { x: 0, y: 0, inside: false, down: null };
const hoverPosition = new THREE.Vector3();
const hoverProjected = new THREE.Vector3();
let hoveredIndex = -1;

renderer.domElement.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.inside = true;
});
renderer.domElement.addEventListener("pointerleave", () => {
    pointer.inside = false;
});
const MOUSE_BUTTON = { primary: 0, secondary: 2 };
renderer.domElement.addEventListener("pointerdown", (event) => {
    pointer.down = { x: event.clientX, y: event.clientY, button: event.button };
});
renderer.domElement.addEventListener("pointerup", (event) => {
    const clicked = isClickGesture(pointer.down, { x: event.clientX, y: event.clientY }, hudConfig.hover.clickTolerance);
    const button = pointer.down?.button;
    pointer.down = null;
    if (!clicked) return;
    if (button === MOUSE_BUTTON.primary) selectHoveredPlanet();
    else if (button === MOUSE_BUTTON.secondary) toggleZoomFromCursor();
});
renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());

/**
 * Czy można teraz celować kursorem w planety (nic się nie rusza, nie trwa przelot).
 * @returns {boolean}
 */
function canTargetWithCursor() {
    return systemReady() && !warp.active && !isSwitchingSolar && !cameraRig.isBusy();
}

/**
 * Szuka planety pod kursorem i ustawia na niej celownik podglądu (albo go chowa).
 * Obecnie śledzonej planety nie podświetla, bo kliknięcie w nią nic by nie zmieniło.
 * @returns {void}
 */
function updateHover() {
    camera.updateMatrixWorld();
    hoveredIndex = -1;
    const interactive = pointer.inside && canTargetWithCursor();
    if (interactive) hoveredIndex = pickOnScreen(pointer, hoverCandidates(), hudConfig.hover);
    showCursorAction(cursorAction(cameraRig.mode, hoveredIndex >= 0, interactive));
    if (hoveredIndex < 0) {
        reticle.hide();
        return;
    }
    const frame = hoverFrame(activeBodies()[hoveredIndex]);
    if (!frame) {
        reticle.hide();
        return;
    }
    reticle.hover(frame, planetsInfo[globalPlanetIndex(hoveredIndex)].name);
}

const CURSOR_STYLES = { target: "crosshair", "zoom-in": "zoom-in", "zoom-out": "zoom-out", none: "" };
const CURSOR_HINTS = { "zoom-in": "RMB // ZOOM IN", "zoom-out": "RMB // ZOOM OUT" };
const cursorHint = document.getElementById("cursorHint");
let shownCursorAction = null;

/**
 * Ustawia kursor nad sceną i podpowiedź przy nim (prawym przyciskiem można przybliżyć/oddalić zalockowaną planetę).
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
        cursorHint.style.transform = `translate(${pointer.x + hudConfig.hover.hintOffset}px, ${pointer.y + hudConfig.hover.hintOffset}px)`;
    }
}

/**
 * Planety, w które można wycelować: środki i promienie na ekranie, bez księżyców, obecnego celu i ciał za kamerą.
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
 * Środek i promień ciała na ekranie w pikselach.
 * @param {{mesh: THREE.Object3D, radius: number}} body - ciało układu
 * @returns {{center: {x: number, y: number}, radius: number}|null} null, gdy ciało jest poza kadrem
 */
function screenPlacement(body) {
    body.worldCenter(hoverPosition);
    hoverProjected.copy(hoverPosition).project(camera);
    if (hoverProjected.z < -1 || hoverProjected.z > 1) return null;
    return {
        center: {
            x: ((hoverProjected.x + 1) / 2) * window.innerWidth,
            y: ((1 - hoverProjected.y) / 2) * window.innerHeight,
        },
        radius: screenRadius(body.radius, camera.position.distanceTo(hoverPosition), camera.fov, window.innerHeight),
    };
}

/**
 * Ramka celownika wokół ciała na ekranie.
 * @param {{mesh: THREE.Object3D, radius: number}} body - ciało pod kursorem
 * @returns {{x: number, y: number, size: number}|null} null, gdy ciało jest poza kadrem
 */
function hoverFrame(body) {
    const placement = screenPlacement(body);
    if (!placement) return null;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    return bracketFrame(placement.center, placement.radius, viewport, 1, hudConfig.hover);
}

/**
 * Indeks planety we wspólnej liście planetsInfo (oba układy po kolei).
 * @param {number} index - indeks ciała w aktywnym układzie
 * @returns {number}
 */
function globalPlanetIndex(index) {
    return currentSolar == 1 ? index : index + planetySun.length;
}

/**
 * Wybiera planetę pod kursorem: kamera leci do niej tak jak po wybraniu z paska, celownik znika.
 * @returns {void}
 */
function selectHoveredPlanet() {
    if (hoveredIndex < 0 || !canTargetWithCursor()) return;
    if (!cameraRig.select(hoveredIndex)) return;
    reticle.hide();
    showCursorAction("none");
    syncCameraUi();
}

/**
 * Prawy przycisk myszy: przybliża zalockowaną planetę albo oddala, jeśli już jest przybliżona
 * (to samo co przełącznik Planet Focus).
 * @returns {void}
 */
function toggleZoomFromCursor() {
    if (!systemReady() || warp.active || isSwitchingSolar || cameraRig.isBusy()) return;
    if (cameraRig.setFocus(!cameraRig.isFocused())) syncCameraUi();
}

function bracketCoordinates(bracketsState, body, placement) {
    if (bracketsState.visibility !== 'searching' || !placement) return hudTargetPosition;
    const spread = searchSpread(placement.frame.size, body.radius, placement.pixelRadius);
    const tick = Math.floor(hudClock * hudConfig.brackets.searchJitterRate);
    return searchCoordinates(hudTargetPosition, spread, tick);
}

function bracketPlacement(body, closing) {
    hudProjected.copy(hudTargetPosition).project(camera);
    if (hudProjected.z < -1 || hudProjected.z > 1) return null;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const center = {
        x: ((hudProjected.x + 1) / 2) * viewport.width,
        y: ((1 - hudProjected.y) / 2) * viewport.height,
    };
    const distance = camera.position.distanceTo(hudTargetPosition);
    const pixelRadius = screenRadius(body.radius, distance, camera.fov, viewport.height);
    return { frame: bracketFrame(center, pixelRadius, viewport, closing, hudConfig.brackets), pixelRadius };
}

function preloadTargetImages() {
    imagePreloader.preload(paths.cardTextures);
    const planet = planetsInfo[planetInfoSize()];
    if (planet) imagePreloader.preload(planetImageUrls(planet.images, paths.images));
}

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

function fitInfoText() {
    for (const id of FITTED_INFO_IDS) {
        const element = document.getElementById(id);
        const pill = element.closest("#podZdjeciem > div");
        if (pill) fitTextToWidth(element, pill, hudConfig.fit);
    }
}

function infoTextElements() {
    return [document.getElementById("podZdjeciem"), document.getElementById("inspekcjaDane")];
}

function activeBodies() {
    return currentSolar == 1 ? planetySun : planetyBlackHole;
}

function next() {
    cameraRig.select(nextPlanetIndex(activeBodies(), cameraRig.targetIndex));
}

function solar() {
    cameraRig.showOverview();
}

function focus() {
    cameraRig.setFocus(document.getElementById("switch").checked);
    syncCameraUi();
}

function lowQuality() {
    lowQualitySwitch = document.getElementById("switch2").checked;
}

function syncCameraUi() {
    const busy = cameraRig.isBusy();
    const mode = cameraRig.mode;

    if (planetNo !== cameraRig.targetIndex) {
        planetNo = cameraRig.targetIndex;
        info();
    }

    document.getElementById("next").disabled = busy;
    document.getElementById("solar").disabled = busy;

    const focusSwitch = document.getElementById("switch");
    focusSwitch.disabled = busy || mode === 'overview';
    focusSwitch.checked = cameraRig.isFocused();

    if (mode === 'focusLock' && lastSyncedMode !== 'focusLock') preloadTargetImages();
    if (mode === 'focused') {
        if (lastSyncedMode !== 'focused') {
            showInfo();
            fitInfoText();
            scrambler.reveal(infoTextElements(), hudConfig.scramble.duration, hudConfig.scramble.delay);
        }
    } else {
        scrambler.cancel();
        hideInfo();
    }
    lastSyncedMode = mode;

    document.querySelectorAll(".planetBar-btn").forEach((btn) => btn.classList.toggle("disabled", busy));
    updatePlanetBarActive();
}

const buttons = [
    { id: "next", handler: next },
    { id: "solar", handler: solar },
    { id: "nextSolar", handler: nextSolar }
];

buttons.forEach(button => {
    const element = document.getElementById(button.id);
    element.addEventListener("click", function () {
        if (cameraRig.isBusy()) return;
        button.handler();
    });
});

document.getElementById("switch").addEventListener("change", focus)
document.getElementById("switch2").addEventListener("change", lowQuality)
document.getElementById("switch").checked = false;

const planetsInfo = [...systems.sun.bodies, ...systems.blackhole.bodies].map((body) => {
    const info = bodyInfo[body.id];
    return {
        name: info.name,
        informacje: info.text,
        id: info.code,
        informacjeDiam: info.diameter,
        informacjeMass: info.mass,
        informacjeRess: info.resources,
        informacjeOrbitalPeriod: info.orbitalPeriod,
        informacjeTemperature: info.temperature,
        informacjeAxialTilt: info.axialTilt,
        images: info.images ?? [],
        preview: info.preview,
    };
});

const nameElement = document.getElementById("name");
const infElement = document.getElementById("informacje")
const idElement = document.getElementById("id");
const infoDiam = document.getElementById("informacjeDiam");
const infoMass = document.getElementById("informacjeMass");
const infoRess = document.getElementById("informacjeRess");
const infoOrbital = document.getElementById("informacjeOrbitalPeriod");
const infoTemp = document.getElementById("informacjeTemperature");
const infoAxial = document.getElementById("informacjeAxialTilt");

const zdjeciaDiv = document.getElementById("zdjecia")
const rowClass = document.getElementById("row")

function planetInfoSize() {
    if (currentSolar == 1) return planetNo;
    else if (currentSolar == 2) return planetNo + planetySun.length;
}
function info() {
    const planet = planetsInfo[planetInfoSize()];
    removeDivs();
    if (planet) {
        nameElement.innerText = planet.name;
        infElement.innerText = planet.informacje
        idElement.innerText = planet.id;
        infoDiam.innerText = planet.informacjeDiam;
        infoMass.innerText = planet.informacjeMass;
        infoRess.innerHTML = planet.informacjeRess;
        infoOrbital.innerHTML = planet.informacjeOrbitalPeriod
        infoTemp.innerHTML = planet.informacjeTemperature
        infoAxial.innerHTML = planet.informacjeAxialTilt
        for (let i = 0; i < planet.images.length; i++) {
            const createDiv = document.createElement("div")
            const createImg = document.createElement("img")

            createImg.src = paths.images + planet.images[i] + ".webp"

            createDiv.classList.add("slides", "removable")
            if (i == 0) {
                createDiv.classList.add("wyswietlanie")
            }
            createImg.classList.add("zdjecia", "removable")
            createImg.draggable = false
            createImg.loading = "lazy"

            createDiv.appendChild(createImg)
            zdjeciaDiv.appendChild(createDiv)

            const createDivDialog = document.createElement("div")
            const createImgDialog = document.createElement("img")

            createImgDialog.src = paths.images + planet.images[i] + ".webp"

            createDivDialog.classList.add("column", "removable")

            createImgDialog.classList.add("demo", "cursor", "slide" + i, "removable")
            createImgDialog.draggable = false
            createImgDialog.loading = "lazy"
            createImgDialog.setAttribute("onclick", "showSlides(" + (i + 1) + ")")

            createDivDialog.appendChild(createImgDialog)
            rowClass.appendChild(createDivDialog)

            const slide = document.getElementsByClassName("slides")
            const dialog = document.getElementById("dialogee")
            const oldImg = dialog.querySelector("img#dialogImg");
            if (oldImg) oldImg.remove();
            const img = document.createElement("img");
            img.id = "dialogImg";
            img.draggable = false;
            dialog.prepend(img);

            slide[i].addEventListener('click', () => {
                openDialogWithHistory("dialogee");
                showSlides(i + 1);
            })
            setupDialogImgZoomPan(dialog.children[0]);
        }
    }
}

function setupDialogImgZoomPan(dialogImg) {
    dialogImg.dialogZoom = 1;
    dialogImg.panX = 0;
    dialogImg.panY = 0;

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    if (dialogImg._wheelHandler) dialogImg.removeEventListener("wheel", dialogImg._wheelHandler);
    if (dialogImg._mouseDownHandler) dialogImg.removeEventListener("mousedown", dialogImg._mouseDownHandler);

    dialogImg._wheelHandler = function (e) {
        dialogImg.style.transition = "transform 0.2s";
        e.preventDefault();
        const rect = dialogImg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        let oldZoom = dialogImg.dialogZoom;
        if (e.deltaY < 0) {
            dialogImg.dialogZoom = Math.min(dialogImg.dialogZoom + 0.1, 3);
        } else {
            dialogImg.dialogZoom = Math.max(dialogImg.dialogZoom - 0.1, 1);
        }
        dialogImg.panX -= mouseX * (dialogImg.dialogZoom - oldZoom) / dialogImg.dialogZoom;
        dialogImg.panY -= mouseY * (dialogImg.dialogZoom - oldZoom) / dialogImg.dialogZoom;

        updateDialogImgTransform();
    };
    dialogImg.addEventListener("wheel", dialogImg._wheelHandler);

    dialogImg._mouseDownHandler = function (e) {
        dialogImg.style.transition = "none";
        isDragging = true;
        dragStartX = e.clientX - dialogImg.panX;
        dragStartY = e.clientY - dialogImg.panY;
        dialogImg.style.cursor = "grabbing";

        if (window._dialogImgMoveHandler) window.removeEventListener("mousemove", window._dialogImgMoveHandler);
        if (window._dialogImgUpHandler) window.removeEventListener("mouseup", window._dialogImgUpHandler);

        window._dialogImgMoveHandler = function (e) {
            if (!isDragging) return;
            dialogImg.panX = e.clientX - dragStartX;
            dialogImg.panY = e.clientY - dragStartY;
            updateDialogImgTransform();
        };

        window._dialogImgUpHandler = function () {
            isDragging = false;
            dialogImg.style.cursor = "grab";
            window.removeEventListener("mousemove", window._dialogImgMoveHandler);
            window.removeEventListener("mouseup", window._dialogImgUpHandler);
        };

        window.addEventListener("mousemove", window._dialogImgMoveHandler);
        window.addEventListener("mouseup", window._dialogImgUpHandler);
    };
    dialogImg.addEventListener("mousedown", dialogImg._mouseDownHandler);

    dialogImg.addEventListener("touchstart", function (e) {
        if (e.touches.length !== 1) return;
        dialogImg.style.transition = "none";
        isDragging = true;
        dragStartX = e.touches[0].clientX - dialogImg.panX;
        dragStartY = e.touches[0].clientY - dialogImg.panY;
        dialogImg.style.cursor = "grabbing";
    }, { passive: false });

    window.addEventListener("touchmove", function (e) {
        if (!isDragging || e.touches.length !== 1) return;
        dialogImg.panX = e.touches[0].clientX - dragStartX;
        dialogImg.panY = e.touches[0].clientY - dragStartY;
        updateDialogImgTransform();
        e.preventDefault();
    }, { passive: false });

    window.addEventListener("touchend", function () {
        isDragging = false;
        dialogImg.style.cursor = "grab";
    });
    function updateDialogImgTransform() {
        const dialogRect = dialogImg.parentElement.getBoundingClientRect();
        const scaledWidth = dialogImg.naturalWidth * dialogImg.dialogZoom;
        const scaledHeight = dialogImg.naturalHeight * dialogImg.dialogZoom;

        let maxPanX = 0, maxPanY = 0;
        if (dialogImg.dialogZoom > 1) {
            maxPanX = (scaledWidth - dialogRect.width) / 2;
            maxPanY = (scaledHeight - dialogRect.height) / 2;
        }

        dialogImg.panX = Math.max(-maxPanX, Math.min(maxPanX, dialogImg.panX));
        dialogImg.panY = Math.max(-maxPanY, Math.min(maxPanY, dialogImg.panY));

        dialogImg.style.transform = `translate(-50%, -50%) translate(${dialogImg.panX}px, ${dialogImg.panY}px) scale(${dialogImg.dialogZoom})`;
    }

    dialogImg.style.transition = "transform 0.2s";

    dialogImg.parentElement.addEventListener("close", function () {
        dialogImg.style.transition = "transform 0.2s";
        dialogImg.dialogZoom = 1;
        dialogImg.panX = 0;
        dialogImg.panY = 0;
        updateDialogImgTransform();
    });

    updateDialogImgTransform();
}
const slideArrow = createSlideArrow(
    document.getElementById("arrowSelectArrow"),
    document.getElementById("row"),
    ".column.removable",
);
let slideNo = 1;
document.getElementById("dialogee").addEventListener("close", () => slideArrow.hide());

function showSlides(n) {
    const slides = document.getElementsByClassName("slides");
    if (slides.length === 0) return;
    slideNo = n > slides.length ? 1 : n < 1 ? slides.length : n;
    const shown = slideNo;

    for (const slide of slides) slide.classList.remove("wyswietlanie");
    const current = slides[slideNo - 1];
    current.classList.add("wyswietlanie");

    const dialogImg = document.getElementById("dialogImg");
    if (dialogImg) {
        const lowResSrc = current.children[0].src;
        dialogImg.src = lowResSrc;
        dialogImg.dialogZoom = 1;
        dialogImg.panX = 0;
        dialogImg.panY = 0;
        const highRes = new Image();
        highRes.src = lowResSrc.replace(".webp", "2.webp");
        highRes.onload = () => {
            if (slideNo === shown) dialogImg.src = highRes.src;
        };
    }

    slideArrow.show(slideNo - 1);
}

window.showSlides = showSlides;
window.currentSlide = showSlides;
window.nextImg = (n) => showSlides(slideNo + n);
window.prevImg = (n) => showSlides(slideNo - n);

function removeDivs() {
    const toRemove = Array.from(document.getElementsByClassName('removable'));
    for (let i = 0; i < toRemove.length; i++) {
        toRemove[i].remove()
    }
    slideArrow.hide();
    slideNo = 1;
    const dialogImg = document.getElementById("dialogImg");
    if (dialogImg) dialogImg.src = "";
}

function createPlanetBar() {
    const bar = document.getElementById("planetBar");
    bar.style.display = "flex";
    bar.innerHTML = "";

    let globalIndexes = [];
    if (currentSolar == 1) {
        for (let i = 0; i < planetySun.length; i++) {
            if (!planetySun[i].isMoon) globalIndexes.push(i);
        }
    } else {
        for (let i = 0; i < planetyBlackHole.length; i++) {
            if (!planetyBlackHole[i].isMoon) globalIndexes.push(i + planetySun.length);
        }
    }

    for (let btnIdx = 0; btnIdx < globalIndexes.length; btnIdx++) {
        const globalIdx = globalIndexes[btnIdx];
        const planet = planetsInfo[globalIdx];
        const previewIdx = globalIdx;

        const btn = document.createElement("button");
        btn.className = "planetBar-btn";
        if (globalIdx === planetNo) btn.classList.add("active");

        const img = document.createElement("img");
        img.src = paths.previews + (planet.preview ?? paths.defaultPreview) + ".webp";
        img.alt = "";
        img.style.marginRight = "8px";
        img.style.alignSelf = "center";
        img.draggable = false;
        btn.appendChild(img);

        const nameSpan = document.createElement("span");
        nameSpan.className = "planetBar-name";
        nameSpan.textContent = planet.name || "";
        btn.appendChild(nameSpan);

        btn.onclick = () => {
            if (cameraRig.isBusy()) return;
            goToPlanet(globalIdx);
        };
        bar.appendChild(btn);
    }
}
/**
 * Chowa dolną nawigację (Contact, pasek planet z napisem, Gallery) w dół albo wysuwa ją z powrotem,
 * animacją z CSS (klasa `stowed`).
 * @param {boolean} stowed - true: schowana, false: widoczna
 * @returns {void}
 */
function stowNavigation(stowed) {
    document.getElementById("navs").classList.toggle("stowed", stowed);
}

function goToPlanet(globalIdx) {
    const index = currentSolar == 1 ? globalIdx : globalIdx - planetySun.length;
    cameraRig.select(index, { fast: true });
}

function updatePlanetBarActive() {
    const bodies = activeBodies();
    const visible = bodies.map((_, i) => i).filter((i) => !bodies[i].isMoon);
    const activeIdx = visible.indexOf(cameraRig.targetIndex);
    document.querySelectorAll(".planetBar-btn").forEach((btn, i) => btn.classList.toggle("active", i === activeIdx));
}

const contact = document.getElementById("contact");
contact.addEventListener("click", () => {
    const contactDialog = document.getElementById("contactDialog");
    closeAllVisibleDialogs();
    openDialogWithHistory("contactDialog")
    const highResAvatar = new Image();
    highResAvatar.src = document.getElementById("avatar").src.replace(".webp", "2.webp");
    highResAvatar.onload = () => {
        console.log("High resolution avatar loaded successfully.");
        document.getElementById("avatar").src = highResAvatar.src;
    };
});

const masterGalleryImages = planetsInfo
    .filter(planet => Array.isArray(planet.images) && planet.images.length > 0)
    .flatMap(planet => planet.images.map(image => paths.images + image + '.webp'));

const masterGallery = document.getElementById("masterGallery");

masterGallery.addEventListener("click", () => {
    const masterGalleryDialog = document.getElementById("masterGalleryDialog");
    const masterGalleryGrid = masterGalleryDialog.querySelector("#masterGalleryGrid");
    const galleryImageDialog = document.getElementById("galleryImageDialog");
    const galleryImageDialogImg = document.getElementById("galleryImageDialogImg");
    const naviHolder = document.getElementById("naviHoldersMaster");

    closeAllVisibleDialogs();
    openDialogWithHistory("masterGalleryDialog");
    naviHolder.style.display = "flex";

    masterGalleryGrid.innerHTML = "";

    masterGalleryImages.forEach((imgPath, idx) => {
        const img = document.createElement("img");
        img.src = imgPath;
        img.alt = `Gallery image ${idx + 1}`;
        img.loading = "lazy";
        img.draggable = false
        img.classList.add("gallery-image");

        img.addEventListener("click", function () {
            galleryImageDialogImg.src = imgPath;
            closeAllVisibleDialogs(["masterGalleryDialog"]);
            openDialogWithHistory("galleryImageDialog");
            const highRes = new Image();
            highRes.src = imgPath.replace(".webp", "2.webp");
            highRes.onload = () => {
                galleryImageDialogImg.src = highRes.src;
            };
        });
        setupDialogImgZoomPan(galleryImageDialogImg);

        masterGalleryGrid.appendChild(img);
    });
});

let isHandlingPopstate = false;
function closeAllVisibleDialogs(idsToExclude = [], fromPopstate = false) {
    let anyClosed = false;
    document.querySelectorAll('dialog').forEach(dialog => {
        if (isDialogVisible(dialog) && !idsToExclude.includes(dialog.id)) {
            closeDialog(dialog);
            anyClosed = true;
        }
    });
    if (anyClosed && window.history.state && window.history.state.dialogOpen && !fromPopstate) {
        history.back();
    }
}

window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
        closeAllVisibleDialogs();
    }
});

window.addEventListener("popstate", function () {
    isHandlingPopstate = true;
    const anyOpen = Array.from(document.querySelectorAll('dialog')).some(
        dialog => getComputedStyle(dialog).display === "flex"
    );
    if (anyOpen) {
        closeAllVisibleDialogs([], true);
    }
    isHandlingPopstate = false;
});

function openDialogWithHistory(dialogId) {
    openDialog(document.getElementById(dialogId));
    history.pushState({ dialogOpen: true, dialogId }, "");
}

const closeDialogById = (id) => closeDialog(document.getElementById(id));
window.dialClose = () => closeDialogById("dialogee");
window.dialCloseContact = () => closeDialogById("contactDialog");
window.dialCloseGallery = () => closeDialogById("masterGalleryDialog");
window.dialCloseGalleryImg = () => closeDialogById("galleryImageDialog");

document.querySelectorAll("dialog").forEach(preventInstantEscape);

document.getElementById("dialogee").addEventListener("close", () => {
    const dialogImg = document.getElementById("dialogImg");
    if (dialogImg) dialogImg.src = "";
});

document.getElementById("galleryImageDialog").addEventListener("close", () => {
    document.getElementById("galleryImageDialogImg").src = "";
});

document.getElementById("masterGalleryDialog").addEventListener("close", () => {
    document.getElementById("naviHoldersMaster").style.display = "none";
    document.getElementById("masterGalleryGrid").innerHTML = "";
});

const INFO_PANEL_IDS = ["inspekcja", "inspekcjaDane", "container"];

function showInfo() {
    for (const id of INFO_PANEL_IDS) document.getElementById(id).style.display = "block";
}

function hideInfo() {
    for (const id of INFO_PANEL_IDS) document.getElementById(id).style.display = "none";
}
hideInfo()

let loadingCompleted = false
const vid = document.getElementById("loading");
const plate = document.getElementById("loadingPlane");
const loadingText = document.getElementById("loadingText");
const allLoaded = document.getElementById("allLoaded");

function playVideo() {
    if (vid) {
        vid.play()
    }
}
playVideo()
function checkPlanetsLoaded() {
    loadingCompleted = systemReady();
}
let opacityFall = false
vid.addEventListener('ended', () => {
    checkPlanetsLoaded();

    if (loadingCompleted) {
        if (vid) {
            opacityFall = true
            createPlanetBar();
            startFalldown();
            const firstBtn = document.getElementById("planetBar").querySelector(".planetBar-btn");
            firstBtn.classList.add("active");
            document.getElementById("planetBar").style.display = "flex";
            slideArrow.hide();
            document.getElementById("main").classList.add("slideIn")
        }
    }
    else {
        playVideo()
    }
})
function opacityFalldown() {
    if (vid.style.zIndex == -10) return
    vid.style.opacity = opacityVal + "%"
    plate.style.opacity = opacityVal + "%"
    loadingText.style.display = "none"
    allLoaded.style.display = "block"
    allLoaded.style.opacity = opacityVal + "%"
    if (vid.style.opacity > 0) {
        opacityVal -= speedFall
    }
    if (opacityVal <= 5) {
        vid.style.zIndex = -10;
        plate.style.zIndex = -10;
        opacityFall = false;
    }
}
let isSwitchingSolar = false;
function nextSolar() {
    if (isSwitchingSolar) return;
    isSwitchingSolar = true;
    if (cameraRig.setFocus(false, { then: startWarp })) {
        syncCameraUi();
        return;
    }
    startWarp();
}

/**
 * Chowa pasek planet i zaczyna przelot do drugiego układu (rozładowanie, ładowanie, przylot).
 * @returns {void}
 */
function startWarp() {
    slideArrow.hide();
    stowNavigation(true);
    warp.start({
        onCruise: () => {
            unloadCurrentSolar();
            loadNextSolar()
                .then(() => {
                    warp.arrive();
                    stowNavigation(false);
                })
                .catch(console.error);
        },
        onDone: () => {
            isSwitchingSolar = false;
            info();
            updatePlanetBarActive();
        },
    });
}

function unloadCurrentSolar() {
    if (activeSystem) scene.remove(activeSystem.root);
    activeSystem = null;
    removeDivs();
    const dialogImg = document.getElementById("dialogImg");
    if (dialogImg) dialogImg.src = "";
}

async function loadNextSolar() {
    currentSolar = currentSolar == 1 ? 2 : 1;
    removeDivs();
    await loadSystem(currentSolar);
    createPlanetBar();
}

let opacityVal = 100
let speedFall = 2.5

let falldownInterval = null;

let falldownHoldTimer = null;

function showAllLoaded() {
    loadingText.style.display = "none";
    allLoaded.style.display = "block";
    allLoaded.style.opacity = "100%";
}

function startFalldown() {
    if (falldownInterval) clearInterval(falldownInterval);
    clearTimeout(falldownHoldTimer);
    showAllLoaded();
    falldownHoldTimer = setTimeout(() => {
        falldownInterval = setInterval(() => {
            if (!opacityFall) {
                clearInterval(falldownInterval);
                return;
            }
            opacityFalldown();
        }, 1);
    }, loadingConfig.allLoadedHold * 1000);
}

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function animate(time = performance.now()) {
    if (isMobile()) {
        console.log("Mobile device detected, disabling animations.");
        return;
    }
    if (!systemReady() && !warp.active) {
        renderLoopRunning = false;
        return;
    }

    const frames = framesBetween(time - lastFrameTime, motionConfig.maxFrames, motionConfig.fps);
    const dt = frames / motionConfig.fps;
    lastFrameTime = time;

    if (systemReady()) {
        cameraRig.update(dt);
        updateHud(dt);
        activeSystem.update(frames);
    }
    updateHover();
    renderWithWarp(dt);

    requestAnimationFrame(animate);
}

/**
 * Renderuje klatkę z przesunięciem kamery i smugami gwiazd przelotu między układami.
 * Przesunięcie jest dodawane tylko na czas renderu, żeby nie mieszać w stanie kamery i orbity.
 * @param {number} dt - czas klatki w sekundach
 * @returns {void}
 */
function renderWithWarp(dt) {
    const { offset, speed, intensity } = warp.update(dt);
    warpShift.set(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar(offset);
    camera.position.add(warpShift);
    starfield.material.opacity = 1 - intensity;
    warpStars.update(dt, speed, intensity, camera);
    render();
    camera.position.sub(warpShift);
}

function render() {
    if (lowQualitySwitch == false) {
        composer.render();
    } else {
        renderer.setClearColor(0x000000);
        renderer.render(scene, camera);
    }
}
window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    bloomPass.setSize(window.innerWidth / 2, window.innerHeight / 2)
    composer.setSize(window.innerWidth, window.innerHeight);
});

if (new URLSearchParams(location.search).has('test')) {
    window.__solar = {
        get system() { return currentSolar; },
        get planet() { return cameraRig.targetIndex; },
        get fov() { return camera.fov; },
        get transitionComplete() { return !cameraRig.isBusy(); },
        get cameraMode() { return cameraRig.mode; },
        get warping() { return warp.active; },
        get loaded() {
            return systemReady();
        },
        scene,
        camera,
        renderer,
    };
}

