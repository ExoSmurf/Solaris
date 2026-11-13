import * as THREE from 'three';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { systems } from "./config/systems.js";
import { bodyInfo } from "./config/info.js";
import { paths, camera as cameraConfig, light as lightConfig, render as renderConfig, motion as motionConfig, hud as hudConfig } from "./config/settings.js";
import { loadSolarSystem } from "./world/solarSystem.js";
import { framesBetween } from "./motion/motion.js";
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';
import { createCameraRig, nextPlanetIndex } from './camera/cameraRig.js';
import { cameraStatus, createCameraStatus } from './ui/cameraStatus.js';
import { bracketFrame, createLockBrackets, formatCoordinates, formatDelta, lockBracketsState, movementSpeed, screenRadius, smoothValue } from './ui/lockBrackets.js';
import { createScrambler } from './ui/scrambleText.js';
import { createImagePreloader, planetImageUrls } from './ui/preloadImages.js';


// import './slides.js';

const renderer = new THREE.WebGLRenderer({ antialias: true }); //tlo alpha na true zeby tlo widac bylo przed zaladowaniem
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = renderConfig.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;

renderer.shadowMap.enabled = true


let mouseX, mouseY

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

const bloomComposer = new EffectComposer(renderer);
bloomComposer.addPass(renderScene);
bloomComposer.addPass(bloomPass);

const outputPass = new OutputPass();
bloomComposer.addPass(outputPass);

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

document.addEventListener('mousemove', onDocumentMouseMove);


function getStarfield({ numStars = 200 } = {}) {
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
scene.add(starfield)


let currentSolar = 1
let planetySun = []
let planetyBlackHole = []
let activeSystem = null
let renderLoopRunning = false
const SYSTEM_KEYS = { 1: 'sun', 2: 'blackhole' };

async function loadSystem(solarNo) {
    const system = await loadSolarSystem(systems[SYSTEM_KEYS[solarNo]], { scene });
    system.solarNo = solarNo;
    if (solarNo == 1) planetySun = system.bodies;
    else planetyBlackHole = system.bodies;
    activeSystem = system;
    cameraRig.setBodies(system.bodies);
    if (!renderLoopRunning) {
        renderLoopRunning = true;
        animate();
    }
}
loadSystem(1).catch(console.error);

function systemReady() {
    return activeSystem !== null && activeSystem.solarNo === currentSolar;
}

let lastFrameTime = performance.now();

document.getElementById("container3D").appendChild(renderer.domElement);
// const axesHelper = new THREE.AxesHelper(100000);
// scene.add(axesHelper)
function light() {
    const { color, ambientIntensity, offsetFromCenter: d, point } = lightConfig;
    const offsets = [[0, d, 0], [0, -d, 0], [d, 0, 0], [-d, 0, 0], [0, 0, d], [0, 0, -d]];
    for (const [x, y, z] of offsets) {
        const pointLight = new THREE.PointLight(color);
        pointLight.castShadow = true;
        pointLight.shadow.bias = point.shadow.bias;
        pointLight.shadow.mapSize.width = point.shadow.mapSize;
        pointLight.shadow.mapSize.height = point.shadow.mapSize;
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
const hudTargetPosition = new THREE.Vector3();
const hudProjected = new THREE.Vector3();

function updateHud(dt) {
    const body = activeBodies()[cameraRig.targetIndex];
    if (!body) return;
    body.mesh.getWorldPosition(hudTargetPosition);

    if (hudPreviousTarget === body) {
        hudSpeed = smoothValue(hudSpeed, movementSpeed(hudPreviousPosition, hudTargetPosition, dt), hudConfig.delta.smoothing);
    } else {
        hudSpeed = 0;
        hudPreviousTarget = body;
    }
    hudPreviousPosition.copy(hudTargetPosition);

    statusDisplay.show(cameraStatus(cameraRig.mode, cameraRig.targetIndex));

    const bracketsState = lockBracketsState(cameraRig.mode, cameraRig.phaseProgress);
    const frame = bracketsState.visibility === 'hidden' ? null : bracketFrameFor(body, bracketsState.closing);
    bracketsDisplay.show(bracketsState, frame, {
        coordinates: formatCoordinates(hudTargetPosition),
        delta: formatDelta(hudSpeed),
        progress: bracketsState.closing,
    });
}

function bracketFrameFor(body, closing) {
    hudProjected.copy(hudTargetPosition).project(camera);
    if (hudProjected.z < -1 || hudProjected.z > 1) return null;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const center = {
        x: ((hudProjected.x + 1) / 2) * viewport.width,
        y: ((1 - hudProjected.y) / 2) * viewport.height,
    };
    const distance = camera.position.distanceTo(hudTargetPosition);
    const radius = screenRadius(body.radius, distance, camera.fov, viewport.height);
    return bracketFrame(center, radius, viewport, closing, hudConfig.brackets);
}

function preloadTargetImages() {
    const planet = planetsInfo[planetInfoSize()];
    if (planet) imagePreloader.preload(planetImageUrls(planet.images, paths.images));
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
            scrambler.reveal(infoTextElements(), hudConfig.scramble.duration);
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
            // createDiv.id = "removable"
            if (i == 0) {
                createDiv.classList.add("wyswietlanie")
            }
            createImg.classList.add("zdjecia", "removable")
            // createImg.id = "removable"
            createImg.draggable = false
            createImg.loading = "lazy"

            createDiv.appendChild(createImg)
            zdjeciaDiv.appendChild(createDiv)

            const createDivDialog = document.createElement("div")
            const createImgDialog = document.createElement("img")

            createImgDialog.src = paths.images + planet.images[i] + ".webp"

            createDivDialog.classList.add("column", "removable")
            // createDivDialog.id = "removable"

            createImgDialog.classList.add("demo", "cursor", "slide" + i, "removable")
            // createImgDialog.id = "removable"
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
                dialog.children[0].src = slide[i].children[0].src;
                console.log("Setting dialog image src:", slide[i].children[0].src);
                const highRes = new Image();
                highRes.src = slide[i].children[0].src.replace(".webp", "2.webp");
                highRes.onload = () => {
                    dialog.children[0].src = highRes.src;
                };
            })
            setupDialogImgZoomPan(dialog.children[0]);
        }
    }
}


//img musi byc na srodku by default
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
function removeDivs() {
    const toRemove = Array.from(document.getElementsByClassName('removable'));
    for (let i = 0; i < toRemove.length; i++) {
        toRemove[i].remove()
    }
    if (document.getElementById("arrowSelectArrow")) document.getElementById("arrowSelectArrow").style.display = "none";
    document.getElementById("arrowSelectArrow").style.top = "50%";
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
        img.alt = planet.name || "Planet";
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
function delPlanetBar() {
    const bar = document.getElementById("planetBar");
    bar.innerHTML = "";
    bar.style.display = "none";
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
        img.style.width = "100%";
        img.style.height = "auto";
        img.style.cursor = "pointer";
        img.style.borderRadius = "8px";
        img.style.boxShadow = "0 2px 8px #000";
        img.loading = "lazy";
        img.draggable = false
        img.style.userSelect = "none";
        img.style.webkitUserSelect = "none";
        img.style.mozUserSelect = "none";
        img.style.msUserSelect = "none";
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
        if (getComputedStyle(dialog).display === "flex" && !idsToExclude.includes(dialog.id)) {
            dialog.style.display = "none";
            dialog.close();
            anyClosed = true;
            console.log(`Closing dialog: ${dialog.id}`);
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
        closeAllVisibleDialogs([], true); // Pass true to prevent history.back()
    }
    isHandlingPopstate = false;
});

function openDialogWithHistory(dialogId) {
    const dialog = document.getElementById(dialogId);
    dialog.showModal();
    dialog.style.display = "flex";
    history.pushState({ dialogOpen: true, dialogId }, "");
}

const INFO_PANEL_IDS = ["inspekcja", "inspekcjaDane", "container"];

function showInfo() {
    for (const id of INFO_PANEL_IDS) document.getElementById(id).style.display = "block";
}

function hideInfo() {
    for (const id of INFO_PANEL_IDS) document.getElementById(id).style.display = "none";
}
hideInfo()

let loadingCompleted = false
let val = 100
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
            rumpup = false
            if (!resetingWithButton) {
                createPlanetBar();
                startFalldown();
            }
            const firstBtn = document.getElementById("planetBar").querySelector(".planetBar-btn");
            firstBtn.classList.add("active");
            document.getElementById("planetBar").style.display = "flex";
            if (document.getElementById("arrowSelectArrow")) document.getElementById("arrowSelectArrow").style.display = "none";
            document.getElementById("arrowSelectArrow").style.top = "50%";
            document.getElementById("main").classList.add("slideIn")
        }
    }
    else {
        playVideo()
    }
})
function opacityFalldown() {
    if (vid.style.zIndex == -10) return // sprawdzanie czy opacityFall jest aktywne
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
let rumpup = false
// function nextSolar() {
//     oneTimeTicket = true
//     if (vid.style.opacity < 1.5) {
//         rumpup = true
//         document.getElementById("planetBar").style.display = "none";
//         solarCheck = 1;
//         loadingCompleted = false
//         playVideo();
//         startRumpup();
//     }
//     if (vid.style.opacity >= 1.5) {
//         cameraMovePositive(userCameraMoveSpeed)
//         checkPlanetaryState().forEach(planeta => {
//             if (planeta.blok.kostka) unloadModels(planeta.blok.kostka);

//             if (planeta.blokObj.kostka) unloadModels(planeta.blokObj.kostka);
//         });
//         if (currentSolar == 1) {
//             currentSolar = 2;
//             planetLoadedCount = 0;
//             planetBlackHoleLoadedCount = 0;
//             removeDivs();
//             delPlanetBar();
//             startFalldown();
//             loadBlackHoleSolar();
//             console.log(scene.children.length);
//             console.log("Loading Black Hole Solar");

//         }
//         else if (currentSolar == 2) {
//             currentSolar = 1;
//             planetLoadedCount = 0;
//             planetBlackHoleLoadedCount = 0;
//             troll = 1
//             removeDivs()
//             delPlanetBar();
//             startFalldown();
//             loadSunSolar();
//             console.log(scene.children.length);
//             console.log("Loading Sun Solar");
//         }
//     }
// }

let isSwitchingSolar = false;
function nextSolar() {
    if (isSwitchingSolar) return;
    isSwitchingSolar = true;
    startTransitionOut(() => {
        unloadCurrentSolar(() => {
            document.getElementById("arrowSelectArrow").style.display = "none";
            document.getElementById("arrowSelectArrow").style.top = "50%";
            loadNextSolar(() => {
                startTransitionIn();
                isSwitchingSolar = false;
                // const images = document.getElementById("dialogee").querySelectorAll("img");
                // images.forEach(img => img.remove())
                updatePlanetBarActive();
            });
        });
    });
}
let resetingWithButton = false;
function startTransitionOut(callback) {
    resetingWithButton = true;
    rumpup = true;
    playVideo();
    startRumpup();
    function checkOpacity() {
        if (parseFloat(vid.style.opacity) >= 1.5) {
            callback();
        } else {
            setTimeout(checkOpacity, 20);
        }
    }
    checkOpacity();

}

function unloadCurrentSolar(callback) {
    speedFall = 3;
    if (activeSystem) activeSystem.unload();
    activeSystem = null;
    removeDivs();
    const dialogImg = document.getElementById("dialogImg");
    if (dialogImg) dialogImg.src = "";
    callback();
}

async function loadNextSolar(callback) {
    currentSolar = currentSolar == 1 ? 2 : 1;
    removeDivs();
    delPlanetBar();
    await loadSystem(currentSolar);
    createPlanetBar();
    callback();
}

function startTransitionIn() {
    opacityFall = true;
    startFalldown();
    // scene.traverse(obj => {
    //     if (obj.isLight) obj.castShadow = false;
    // });
    info();
}

let opacityVal = 100
let speedFall = 2.5
function opacityRumpup() {
    vid.style.opacity = opacityVal + "%"
    plate.style.opacity = opacityVal + "%"
    loadingText.style.display = "block"
    allLoaded.style.display = "none"
    allLoaded.style.opacity = opacityVal + "%"
    if (vid.style.opacity >= 1.5) {
        rumpup = false
    }
    if (vid.style.opacity <= 1.5) {
        opacityVal += speedFall
    }
    if (opacityVal >= 5) {
        vid.style.zIndex = 10;
        plate.style.zIndex = 10;
        nextSolar();

    }
}

let falldownInterval = null;
let rumpupInterval = null;

function startFalldown() {
    if (falldownInterval) clearInterval(falldownInterval);
    falldownInterval = setInterval(() => {
        if (!opacityFall) {
            clearInterval(falldownInterval);
            return;
        }
        opacityFalldown();
    }, 1); // ~60fps
}

function startRumpup() {
    if (rumpupInterval) clearInterval(rumpupInterval);
    rumpupInterval = setInterval(() => {
        if (!rumpup) {
            clearInterval(rumpupInterval);
            return;
        }
        opacityRumpup();
    }, 2);
}

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function animate(time = performance.now()) {
    if (isMobile()) {
        console.log("Mobile device detected, disabling animations.");
        return;
    }
    if (!systemReady()) {
        renderLoopRunning = false;
        return;
    }

    const frames = framesBetween(time - lastFrameTime, motionConfig.maxFrames, motionConfig.fps);
    lastFrameTime = time;

    cameraRig.update(frames / motionConfig.fps);
    updateHud(frames / motionConfig.fps);
    activeSystem.update(frames);
    render();

    requestAnimationFrame(animate);
}

function render() {
    if (lowQualitySwitch == false) {
        composer.render();
    } else {
        renderer.setClearColor(0x000000);
        renderer.render(scene, camera);
    }
}
function onDocumentMouseMove(event) {

    mouseX = (event.clientX - windowHalfX) / 200;
    mouseY = (event.clientY - windowHalfY) / 90;

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
        get loaded() {
            return systemReady();
        },
    };
}


