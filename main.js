import * as THREE from 'three';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// import './slides.js';

const renderer = new THREE.WebGLRenderer({}); //tlo alpha na true zeby tlo widac bylo przed zaladowaniem
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1.5;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true

const DEFAULT_EXPOSURE = 1.5;
const BLACKHOLE_EXPOSURE = 1;

let mouseX, mouseY
let lightPower = 50;
const BLACKHOLE_LIGHT_POWER = 20;

let scene = new THREE.Scene;

let camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
let cameraOldPos
let orbit = new OrbitControls(camera, renderer.domElement);
const speed = 0.1
camera.position.set(20, 20, 20);

function orbitSettings() {
    if (orbit) orbit.dispose(); orbit = null;
    orbit = new OrbitControls(camera, renderer.domElement);
    orbit.rotateSpeed = speed;
    orbit.enableDamping = true;
    orbit.dampingFactor = 1;
    orbit.enableZoom = false;
    orbit.autoRotate = true;
    orbit.autoRotateSpeed = 0.5;
    orbit.minDistance = 10
    orbit.maxDistance = 45
    cameraOldPos = camera.position
    return cameraOldPos
}
orbitSettings()
function cameraPosCheck() {
    cameraOldPos = camera.position
    return cameraOldPos
}

let orbitZoom = new TrackballControls(camera, renderer.domElement);
orbitZoom.noRotate = true;
orbitZoom.noPan = true;
orbitZoom.noZoom = false;
orbitZoom.zoomSpeed = 1;
// const GravitationalLensingShader = {
//     uniforms: {
//         "tDiffuse": { value: null },
//         "strength": { value: 0.4 },
//         "center": { value: new THREE.Vector2(0, 0) },
//         "radius": { value: 0.5 }
//     },
//     vertexShader: `
//         varying vec2 vUv;
//         void main() {
//             vUv = uv;
//             gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
//         }
//     `,
//     fragmentShader: `
//         uniform sampler2D tDiffuse;
//         uniform float strength;
//         uniform vec2 center;
//         uniform float radius;
//         varying vec2 vUv;
//         void main() {
//             vec2 uv = vUv;
//             vec2 toCenter = uv - center;
//             float dist = length(toCenter);
//             float effect = 1.0;
//             if(dist < radius) {
//                 float curve = strength * pow((radius - dist) / radius, 2.0);
//                 effect += curve;
//             }
//             uv = center + toCenter * effect;
//             gl_FragColor = texture2D(tDiffuse, uv);
//         }
//     `
// };

// const lensingPass = new ShaderPass(GravitationalLensingShader);

// const renderScene = new RenderPass(scene, camera)
// const composer = new EffectComposer(renderer)
// composer.addPass(renderScene);

// const bloomResolution = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);
// const bloomPass = new UnrealBloomPass(
//     bloomResolution,
//     1,
//     1,
//     0.2
// )
// composer.addPass(bloomPass)

// const bloomComposer = new EffectComposer(renderer);
// bloomComposer.addPass(renderScene);
// bloomComposer.addPass(bloomPass);

// const outputPass = new OutputPass();
// bloomComposer.addPass(outputPass);

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

document.addEventListener('mousemove', onDocumentMouseMove);



function getStarfield({ numStars = 1000 } = {}) {
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
            "./textures/circle.png"
        ),
    });
    const points = new THREE.Points(geo, mat);
    return points;
}
const starfield = getStarfield();
starfield.name = "starfield";
scene.add(starfield)


let sun, earth, earthObj, saturn, jupiterObj, Venus, caresObj, moon, moonObj
let planetLoadedCount = 0

const loadingManager = new THREE.LoadingManager();

loadingManager.onProgress = function (url, loaded, total) { }
let currentSolar = 1
const loader = new GLTFLoader(loadingManager);

const planetySun = [
    {
        planeta: "sun", src: "/models/sun/sun.gltf",
        blok: { kostka: null, x: 0, y: 0, z: 0, rotation: 0.01 },
        blokObj: { kostka: null, x: null, y: null, z: null, rotation: null },
        isMoon: false
    },
    {
        planeta: "Venus", src: "/models/Venus/Venus.gltf",
        blok: { kostka: null, x: 3, y: null, z: null, rotation: 0.01 },
        blokObj: { kostka: null, x: 0, y: 0, z: null, rotation: 0.00035 },
        isMoon: false
    },
    {
        planeta: "earth", src: "/models/earth/earth.gltf",
        blok: { kostka: null, x: -9, y: null, z: null, rotation: 0.01 },
        blokObj: { kostka: null, x: 0, y: null, z: null, rotation: 0.005 },
        isMoon: false,
    },
    {
        planeta: "moon", src: "/models/moon/moon.gltf",
        blok: { kostka: null, x: 1, y: null, z: null, rotation: 0.02 },
        blokObj: { kostka: null, x: 0, y: 0, z: null, rotation: -0.001 },
        isMoon: true
    },
    {
        planeta: "saturn", src: "/models/saturn/saturn.gltf",
        blok: { kostka: null, x: 17, y: null, z: null, rotation: 0.01 },
        blokObj: { kostka: null, x: 0, y: 0, z: null, rotation: 0.0008 },
        isMoon: false
    },
    {
        planeta: "pluto", src: "/models/pluto/pluto.gltf",
        blok: { kostka: null, x: -24, y: null, z: null, rotation: 0.01 },
        blokObj: { kostka: null, x: 0, y: 0, z: null, rotation: 0.0005 },
        isMoon: false
    }

]
let oneTimeTicket = true;
function loadSunSolar() {
    planetySun.forEach((el, i) => {

        if (el.planeta == "sun") {

            loader.load(
                el.src,
                function (gltf) {
                    sun = gltf.scene;
                    scene.add(sun);
                    el.blok.kostka = sun;
                    planetLoadedCount++
                    sun.castShadow = true
                    sun.traverse(n => {
                        if (n.isMesh) {
                            n.castShadow = true;
                            if (n.material.map) n.material.map.anisotropy = 0;
                        }
                    });
                    if (planetLoadedCount == planetySun.length && oneTimeTicket == true) {
                        planetySun[2].blok.kostka.add(planetySun[3].blokObj.kostka)
                        animate()
                        oneTimeTicket = false;
                    }
                },
                function (xhr) {

                    console.log((xhr.loaded / xhr.total * 100) + '% loaded: ' + el.planeta);

                },
                function (error) {
                    console.error(error);
                }
            );
        }
        else if (checkSolar() <= i + 1) {
            loader.load(
                el.src,
                function (gltf) {
                    let kostka = gltf.scene
                    let kostkaObj = new THREE.Object3D()
                    kostkaObj.add(kostka);
                    scene.add(kostkaObj);
                    el.blok.kostka = kostka
                    el.blokObj.kostka = kostkaObj
                    planetLoadedCount++
                    kostka.traverse(n => {
                        if (n.isMesh) {
                            n.castShadow = true;
                            n.receiveShadow = true;
                            if (n.material.map) n.material.map.anisotropy = 0;
                        }
                    });
                    if (planetLoadedCount == planetySun.length && oneTimeTicket == true) {
                        planetySun[2].blok.kostka.add(planetySun[3].blokObj.kostka)
                        animate()
                        oneTimeTicket = false;
                    }

                },
                function (xhr) {

                    console.log((xhr.loaded / xhr.total * 100) + '% loaded: ' + el.planeta);

                },
                function (error) {
                    console.error(error);
                }

            );
        }
        else {
            loader.load(
                el.src,
                function (gltf) {
                    let kostka = gltf.scene
                    let kostkaObj = new THREE.Object3D()
                    kostkaObj.add(kostka);
                    scene.add(kostkaObj);
                    el.blok.kostka = kostka
                    el.blokObj.kostka = kostkaObj
                    kostka.traverse(n => {
                        if (n.isMesh) {
                            n.castShadow = true;
                            n.receiveShadow = true;
                            if (n.material.map) n.material.map.anisotropy = 0;
                        }
                    });
                    planetLoadedCount++

                    if (planetLoadedCount == planetySun.length && oneTimeTicket == true) {
                        planetySun[2].blok.kostka.add(planetySun[3].blokObj.kostka)
                        animate()
                        oneTimeTicket = false;
                    }
                },
                function (xhr) {

                    console.log((xhr.loaded / xhr.total * 100) + '% loaded: ' + el.planeta);

                },
                function (error) {
                    console.error(error);
                }

            );
        }

    });

}
loadSunSolar()

const planetyBlackHole = [
    {
        planeta: "BlackHole", src: "/models/blackhole/blackhole.gltf",
        blok: { kostka: null, x: 0, y: 0, z: 0, rotation: 0.001 },
        blokObj: { kostka: null, x: null, y: null, z: null, rotation: null },
        isMoon: false
    },
    {
        planeta: "pyrox", src: "/models/pyrox/pyroxBlob.gltf",
        blok: { kostka: null, x: null, y: null, z: -5, rotation: 0.005 },
        blokObj: { kostka: null, x: 0, y: 0, z: null, rotation: -0.001 },
        isMoon: false
    },
    {
        planeta: "pyroxBlob", src: "/models/pyrox/pyroxBlob.gltf",
        blok: { kostka: null, x: 0.5, y: null, z: null, rotation: 0.005 },
        blokObj: { kostka: null, x: 0, y: 0, z: null, rotation: 0.001 },
        isMoon: true
    },
    {
        planeta: "pyroxBlob2", src: "/models/pyrox/pyroxBlob.gltf",
        blok: { kostka: null, x: -0.6, y: null, z: -0.7, rotation: 0.005 },
        blokObj: { kostka: null, x: 0, y: 0, z: null, rotation: 0.001 },
        isMoon: true
    },
    {
        planeta: "pyroxBlob3", src: "/models/pyrox/pyroxBlob.gltf",
        blok: { kostka: null, x: 0.6, y: null, z: -0.7, rotation: 0.002 },
        blokObj: { kostka: null, x: 0, y: 0, z: null, rotation: -0.0001 },
        isMoon: true
    },
    {
        planeta: "pyroxBlob4", src: "/models/pyrox/pyroxBlob.gltf",
        blok: { kostka: null, x: 0.4, y: null, z: 0.8, rotation: 0.001 },
        blokObj: { kostka: null, x: 0, y: 0, z: null, rotation: 0.003 },
        isMoon: true
    },
    {
        planeta: "mirethul", src: "/models/Mirethul/Mirethul.gltf",
        blok: { kostka: null, x: -8, y: null, z: null, rotation: 0.003 },
        blokObj: { kostka: null, x: 0, y: 0, z: null, rotation: 0.0001 },
        isMoon: false
    },
    {
        planeta: "aerolith", src: "/models/Aerolith/aerolith.gltf",
        blok: { kostka: null, x: 11, y: null, z: null, rotation: 0.005 },
        blokObj: { kostka: null, x: 0, y: 0, z: null, rotation: 0.0003 },
        isMoon: false
    },
    {
        planeta: "skarnis", src: "/models/skarnis/skarnis.gltf",
        blok: { kostka: null, x: null, y: null, z: 15, rotation: 0 },
        blokObj: { kostka: null, x: 0, y: 0, z: null, rotation: 0.001 },
        isMoon: false
    },
    {
        planeta: "neptune", src: "/models/neptune/neptune.gltf",
        blok: { kostka: null, x: null, y: 0, z: 19, rotation: 0.007 },
        blokObj: { kostka: null, x: null, y: null, z: null, rotation: 0.0002 },
        isMoon: false
    }

]
let hole;
let planetBlackHoleLoadedCount = 0
function loadBlackHoleSolar() {
    if (!hole) {
        hole = new THREE.Object3D();
    }
    planetyBlackHole.forEach((el, i) => {
        if (el.planeta == "BlackHole") {
            loader.load(
                el.src,
                function (gltf) {
                    hole = gltf.scene;
                    scene.add(hole);
                    el.blok.kostka = hole;
                    hole.castShadow = true
                    hole.scale.set(4, 4, 4)
                    hole.traverse(n => {
                        if (n.isMesh) {
                            n.castShadow = true;
                            if (n.material.map) n.material.map.anisotropy = 0;
                        }
                    });
                    planetBlackHoleLoadedCount++
                    if (planetBlackHoleLoadedCount == planetyBlackHole.length && oneTimeTicket == true) {

                        animate()
                        oneTimeTicket = false;
                    }
                },
                function (xhr) {

                    console.log((xhr.loaded / xhr.total * 100) + '% loaded: ' + el.planeta);

                },
                function (error) {
                    console.error(error);
                }

            );
        } else {
            loader.load(
                el.src,
                function (gltf) {
                    let kostka = gltf.scene
                    let kostkaObj = new THREE.Object3D()
                    kostkaObj.add(kostka);
                    scene.add(kostkaObj);
                    el.blok.kostka = kostka
                    el.blokObj.kostka = kostkaObj
                    kostka.traverse(n => {
                        if (n.isMesh) {
                            n.castShadow = true;
                            n.receiveShadow = true;
                            if (n.material.map) n.material.map.anisotropy = 0;
                        }
                    });
                    if (el.planeta == "aerolith") el.blok.kostka.scale.set(2, 2, 2)
                    if (el.planeta == "skarnis") el.blok.kostka.scale.set(4, 4, 4)
                    planetBlackHoleLoadedCount++
                    if (planetBlackHoleLoadedCount == planetyBlackHole.length && oneTimeTicket == true) {
                        animate();
                        oneTimeTicket = false;
                    }

                },
                function (xhr) {

                    console.log((xhr.loaded / xhr.total * 100) + '% loaded: ' + el.planeta);

                },
                function (error) {
                    console.log(`Error loading ${el.planeta}:`, error);

                    console.error(error);
                }

            );
        }
    });
}


document.getElementById("container3D").appendChild(renderer.domElement);
// const axesHelper = new THREE.AxesHelper(100000);
// scene.add(axesHelper)

function light() {
    let lightPower = 50

    const pointLightY = new THREE.PointLight(0xFFFED1, 1, 20);
    pointLightY.castShadow = false
    pointLightY.shadow.bias = -0.01;
    pointLightY.position.set(0, 2, 0);
    pointLightY.shadow.mapSize.width = 100;
    pointLightY.shadow.mapSize.height = 100;
    pointLightY.power = lightPower
    scene.add(pointLightY);

    const pointLightY2 = new THREE.PointLight(0xFFFED1, 1, 20);
    pointLightY2.castShadow = false
    pointLightY2.shadow.bias = -0.01;
    pointLightY2.shadow.mapSize.width = 100;
    pointLightY2.shadow.mapSize.height = 100;
    pointLightY2.position.set(0, -2, 0);
    pointLightY2.power = lightPower
    scene.add(pointLightY2);

    const pointLightX = new THREE.PointLight(0xFFFED1, 1, 20);
    pointLightX.castShadow = true
    pointLightX.shadow.bias = -0.01;
    pointLightX.shadow.mapSize.width = 100;
    pointLightX.shadow.mapSize.height = 100;
    pointLightX.position.set(2, 0, 0)
    pointLightX.power = lightPower
    scene.add(pointLightX)

    const pointLightX2 = new THREE.PointLight(0xFFFED1, 1, 20);
    pointLightX2.castShadow = true
    pointLightX2.shadow.bias = -0.01;
    pointLightX2.shadow.mapSize.width = 100;
    pointLightX2.shadow.mapSize.height = 100;
    pointLightX2.position.set(-2, 0, 0)
    pointLightX2.power = lightPower
    scene.add(pointLightX2)


    const pointLightZ = new THREE.PointLight(0xFFFED1, 1, 20);
    pointLightZ.castShadow = true
    pointLightZ.shadow.bias = -0.01;
    pointLightZ.shadow.mapSize.width = 100;
    pointLightZ.shadow.mapSize.height = 100;
    pointLightZ.position.set(0, 0, 2)
    pointLightZ.power = lightPower
    scene.add(pointLightZ)

    const pointLightZ2 = new THREE.PointLight(0xFFFED1, 1, 20);
    pointLightZ2.castShadow = true
    pointLightZ2.shadow.bias = -0.01;
    pointLightZ2.shadow.mapSize.width = 100;
    pointLightZ2.shadow.mapSize.height = 100;
    pointLightZ2.position.set(0, 0, -2)
    pointLightZ2.power = lightPower
    scene.add(pointLightZ2)

    const ambientLight = new THREE.AmbientLight(0xFFFED1, 0.3);
    scene.add(ambientLight);
}

let prawda = true, focusCheck = true, nastepne = false
let solarCheck = 1, nextCheck = 0, solarReset = 0, planetNo = 0
let planetyPrevPos, prev, transitionRestart


function checkSolar() {
    if (currentSolar == 1) return planetySun.length
    else if (currentSolar == 2) return planetyBlackHole.length
}

function next() {
    removeDivs()
    cameraFallback(cameraOldPos)
    transitionRestart = false
    orbitOnce = 0
    if (solarCheck == 1) {
        planetNo = 1
        prev = 0
    }
    if (nastepne == true && camera.fov == 45 && solarCheck == 0) {
        planetNo += 1
        focusCheck = true
        focusFalsePositive = 0
        prev = planetNo - 1

        if (planetNo == checkSolar()) {
            planetNo = 1
            prev = checkSolar() - 1
            solarReset = 1
        }
    }
    else if (nastepne == false) {
        focusCheck = true
    }
    solarCheck = 0
    document.getElementById("switch").checked = false
    if (camera.fov == 10) {
        nextCheck = 1
    }
    document.getElementById("solar").disabled = false

}
function solar() {
    transitionRestartCamera = false
    transitionRestart = false
    focusCheck = true
    solarCheck = 1
    prev = planetNo
    transitionPercentCamera = 0
    planetNo = 0
    focusFalsePositive = 0;
    inspectFalsePositive = 0;
    solarReset = 0
    orbitOnce = 0

    removeDivs()
    orbitSettings()
    hideInfo()

    document.getElementById("switch").checked = false
    document.getElementById("solar").disabled = true

}


let focusFalsePositive = 0
function focus() {
    cameraPosCheck()
    focusFalsePositive += 1
    if (solarCheck == 1) {
        focusFalsePositive = 0
    }
    if (focusFalsePositive == 1) {
        focusCheck = false
    }
    if (focusFalsePositive == 2) {
        focusCheck = true
        focusFalsePositive = 0
    }
    // info()
}
let inspectFalsePositive = 0
let lowQualitySwitch = false

function lowQuality() {
    if (document.getElementById("switch2").checked) {
        lowQualitySwitch = true
    }
    else if (document.getElementById("switch2").checked == false) {
        lowQualitySwitch = false
    }
}

const buttons = [
    { id: "next", handler: next },
    { id: "solar", handler: solar },
    { id: "nextSolar", handler: nextSolar }
];

buttons.forEach(button => {
    const element = document.getElementById(button.id);
    element.addEventListener("click", button.handler);
});

document.getElementById("switch").addEventListener("change", focus)
document.getElementById("switch2").addEventListener("change", lowQuality)
document.getElementById("switch").checked = false;
document.getElementById("solar").disabled = true;

const planetsInfo = [
    {
        name: "Sun",
        images: []
    },
    {
        name: "Venus",
        informacje: "Planet Venus is a rugged, orange-hued world known for its vast Gravel Wastes and Granite Highlands. The Gravel Wastes are expansive, unstable areas filled with gravel, creating a challenging terrain with frequent collapses.These biomes are ideal for gathering flint but are hazardous to navigate. The Granite Highlands feature towering granite cliffs and plateaus, offering an abundance of granite and occasional iron and copper veins embedded in the rock. The thin atmosphere casts a dusty haze over the landscape, giving the planet a unique, eerie appearance that adds to the adventurous exploration and resource-gathering experience.",
        id: "VE-57",
        informacjeDiam: "8,507 Blocks",
        informacjeMass: "760,200 kBl",
        informacjeRess: "Gold,<br>Sand,<br>&nbsp;Lumicite*",
        informacjeOrbitalPeriod: "Orbital Period:<br>462 Days",
        informacjeTemperature: "Temperature:<br>352°C / 665.6°F",
        informacjeAxialTilt: "Axial Tilt:<br>3°",
        images: ["cares", "caresOther", "mesa", "mesas", "mesass"]
    },
    {
        name: "Earth",
        informacje: "Planet Earth is a mysterious, cube-shaped planet orbiting a distant star. Its surface is a patchwork of biomes, from dense forests to vast deserts, each teeming with blocky life. The planet's core is a giant, pulsating redstone crystal, believed to power the strange gravity that keeps everything in its place. Rich in resources like iron, gold, and diamonds, Minecraft Earth is a miner's paradise. The planet's atmosphere is thick with pixelated clouds, and the sky shifts colors in a mesmerizing, digital pattern. Rumors suggest ancient structures and hidden treasures lie deep underground, waiting to be discovered.",
        id: "ER-23",
        informacjeDiam: "9,120 Blocks",
        informacjeMass: "921,090 kBl",
        informacjeRess: "Diamonds,<br>Soils,<br>&nbsp;Velvetvine*,<br>Redstone ",
        informacjeOrbitalPeriod: "Orbital Period:<br>365.25 days",
        informacjeTemperature: "Temperature:<br>15°C / 59°F",
        informacjeAxialTilt: "Axial Tilt: <br>23.5°",
        images: ["preview", "1kx1khonor2", "323", "Tython", "def", "orax", "explo", "key"]

    },
    {
        name: "Moon"

    },
    {
        name: "Saturn",
        informacje: "SA-42, commonly known as Saturn, is a mesmerizing gas giant, renowned for its stunning rings of ice and rock that encircle the planet in a beautiful display. The upper atmosphere of Saturn is a dynamic, swirling mass of yellow, orange, and brown clouds, where floating islands of solid matter drift amidst the gaseous layers. Despite its harsh and turbulent environment, Saturn is rich in rare and valuable resources. Explorers can find Hydrocrystals floating within the atmosphere, Gasblossom plants glowing in the upper layers, and Etherium Ore embedded in the drifting islands. The planet’s frequent storms charge Stormstone with immense energy, while Ring Ice harvested from the rings is sought after for advanced crafting. Saturn’s unique environment offers a wealth of exotic materials, making it a challenging yet rewarding destination for adventurers.",
        id: "SA-42",
        informacjeDiam: "83,192 Blocks",
        informacjeMass: "12,291,630 kBl",
        informacjeRess: "&nbsp;Ring Ice*,<br>Terracota,<br>Gases,<br>&nbsp;Hydrocrystals",
        informacjeOrbitalPeriod: "Orbital Period:<br10,756 days",
        informacjeTemperature: "Temperature:<br>-178°C / -288.4",
        informacjeAxialTilt: "Axial Tilt: <br>26.7°",
        images: []
    },
    {
        name: "Pluto",
        informacje: "PL-09, commonly known as Pluto, is a remote and desolate dwarf planet, drifting at the edge of the solar system with a wide, elliptical orbit that spans centuries. Its frozen surface is a landscape of jagged ice cliffs, steep dirt hills, and deep impact craters, all shrouded in a dim, bluish twilight. Despite its isolation and extreme cold, Pluto harbors rare and valuable materials beneath its icy crust. Explorers can find Froststone, a unique mineral that glows faintly in the dark, and Ice Crystals, which are essential for crafting advanced tools and equipment. The planet's surface is also rich in Frozen Gas deposits, which can be harvested for fuel and energy. The harsh conditions and sparse resources make PL-09 a challenging yet intriguing destination for adventurers seeking to uncover its secrets.",
        id: "PL-09",
        informacjeDiam: "7,370 Blocks",
        informacjeMass: "1,310,000 kBl",
        informacjeRess: "&nbsp;Froststone*,<br>&nbsp;Ice Crystals*,<br>Frozen Gas,<br>Stones",
        informacjeOrbitalPeriod: "Orbital Period:<br>732 days",
        informacjeTemperature: "Temperature:<br>-223°C / -369.4",
        informacjeAxialTilt: "Axial Tilt: <br>12.5°",
        images: ["cany"]
    },
    {
        name: "BlackHole",
        images: []
    },
    {
        name: "Pyrox",
        informacje: "Planet Pyrox is a desolate, rocky world characterized by its harsh, volcanic landscape and extreme temperatures. The surface is dotted with active volcanoes, molten lava rivers, and jagged rock formations. The atmosphere is thin and filled with ash, creating a dim, reddish haze that obscures the sky. Despite its inhospitable environment, Pyrox is rich in valuable resources such as Pyroxium Ore, a rare mineral used in advanced technology and crafting. The planet's extreme conditions make it a challenging but rewarding destination for resource gathering and exploration.",
        id: "PY-01",
        informacjeDiam: "6,371 Blocks",
        informacjeMass: "1,090,230 kBl",
        informacjeRess: "&nbsp;Pyroxium Ore*,<br>Basalt,<br>Obsidian",
        informacjeOrbitalPeriod: "Orbital Period:<br>102 days",
        informacjeTemperature: "Temperature:<br>300°C / 572°F",
        informacjeAxialTilt: "Axial Tilt: <br>23.5°",
        images: ["Nether", "volcano"]
    },
    {
        name: "Pyrox Blob",
        images: []
    },
    {
        name: "Pyrox Blob",
        images: []
    },
    {
        name: "Pyrox Blob",
        images: []
    },
    {
        name: "Pyrox Blob",
        images: []
    },
    {
        name: "Mirethul",
        informacje: "Planet Mirethul is a mysterious, swampy world characterized by its dense, fog-laden atmosphere and treacherous terrain. The surface is covered in vast marshlands, with stagnant pools of murky water and thick vegetation that obscures visibility. Mirethul's unique ecosystem is home to a variety of strange and exotic creatures, adapted to the planet's harsh conditions. The atmosphere is rich in Mirethium Gas, a valuable resource used in advanced technology and crafting. Despite its inhospitable environment, Mirethul offers opportunities for exploration and resource gathering for those brave enough to navigate its dangers.",
        id: "MI-22",
        informacjeDiam: "5,001 Blocks",
        informacjeMass: "820,070 kBl",
        informacjeRess: "&nbsp;Mirethium Gas*,<br>Swamp Soil,<br>Marshwood",
        informacjeOrbitalPeriod: "Orbital Period:<br>729 days",
        informacjeTemperature: "Temperature:<br>25°C / 77°F",
        informacjeAxialTilt: "Axial Tilt: <br>15°",
        images: []
    },
    {
        name: "Aerolith",
        informacje: "Planet Aerolith is a floating, gaseous world characterized by its ethereal atmosphere and unique, cloud-like terrain. The surface is composed of dense clouds and gaseous formations that shift and change shape, creating a surreal and ever-changing landscape. Aerolith's atmosphere is rich in Aerolithium Gas, valuable to some, scary to the rest gas that allows user to shapeshift. The planet's low gravity allows for the formation of floating islands made of solidified gas, which can be explored for rare minerals and resources. Despite its inhospitable environment, Aerolith offers opportunities for exploration and resource gathering for those willing to brave its challenges.",
        id: "AE-33",
        informacjeDiam: "19,502 Blocks",
        informacjeMass: "600,000 kBl",
        informacjeRess: "&nbsp;Aerolithium Gas*,<br>Cloudstone,<br>Gaseous Crystals",
        informacjeOrbitalPeriod: "Orbital Period:<br>365 days",
        informacjeTemperature: "Temperature:<br>-10°C / 14°F",
        informacjeAxialTilt: "Axial Tilt: <br>10°",
        images: []
    },
    {
        name: "Skarnis",
        informacje: "Planet Skarnis is a rocky, mountainous world characterized by its rugged terrain and harsh climate. The surface is dominated by towering mountains, deep valleys, and rocky outcrops, creating a challenging environment for exploration. Skarnis is rich in valuable minerals and ores, including Skarnite, a rare resource used in spaceship technology. The planet's atmosphere is thin and cold, with frequent storms that can make navigation difficult. The far backside of the planet is perpetually shadowed, creating a frigid and inhospitable environment. Despite its inhospitable conditions, Skarnis offers opportunities for resource gathering and adventure for those willing to brave its challenges.",
        id: "SK-44",
        informacjeDiam: "29,345 Blocks",
        informacjeMass: "1,234,567 kBl",
        informacjeRess: "&nbsp;Skarnite*,<br>Rocky Soil,<br>Mountain Crystals",
        informacjeOrbitalPeriod: "Orbital Period:<br>400 days",
        informacjeTemperature: "Temperature:<br>5°C / 41°F",
        informacjeAxialTilt: "Axial Tilt: <br>20°",
        images: []
    },
    {
        name: "Neptune",
        informacje: "Planet Neptune is a distant, icy world characterized by its frigid temperatures and vast frozen landscapes. The surface is covered in thick layers of ice and snow, with towering ice formations and deep crevasses. Neptune's atmosphere is thin and cold, with strong winds that whip across the surface. Neptune is rich in valuable resources such as Ice Crystals. The planet's unique environment might soon be researchable, so far the atmospheric pressure is higher than deepest oceans of earth.",
        id: "NE-55",
        informacjeDiam: "7,021 Blocks",
        informacjeMass: "1,500,000 kBl",
        informacjeRess: "&nbsp;Ice Crystals*,<br>Frozen Soil,<br>Snowy Rocks",
        informacjeOrbitalPeriod: "Orbital Period:<br>165 years",
        informacjeTemperature: "Temperature:<br>-214°C / -353°F",
        informacjeAxialTilt: "Axial Tilt: <br>28°",
        images: []
    }
];

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

            createImg.src = "/textures/images/" + planet.images[i] + ".webp"

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

            createImgDialog.src = "/textures/images/" + planet.images[i] + ".webp"

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

            slide[i].addEventListener('click', () => {
                dialog.showModal();
                dialog.style.display = "flex";
                dialog.children[0].src = slide[i].children[0].src;
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

        // Remove any previous move/up listeners
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

    // Reset on close
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

    if (planetsInfo[planetNo - 1]) {
        for (let i = 0; i < toRemove.length; i++) {

            toRemove[i].remove()
        }
    }
    document.getElementById("arrowSelectArrow").style.display = "none";
}



const planetPreviewMap = {
    sun: "/textures/images/previews/sun.webp",
    venus: "/textures/images/previews/venus.webp",
    earth: "/textures/images/previews/earth.webp",
    saturn: "/textures/images/previews/saturn.webp",
    pluto: "/textures/images/previews/pluto.webp",
    blackhole: "/textures/images/previews/blackhole.webp",
    pyrox: "/textures/images/previews/pyrox.webp",
    mirethul: "/textures/images/previews/mirethul.webp",
    aerolith: "/textures/images/previews/aerolith.webp",
    skarnis: "/textures/images/previews/skarnis.webp",
    neptune: "/textures/images/previews/neptune.webp",
};
let planetBarActivation = false;
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
        const planetKey = (planet.planeta || planet.name || "").toLowerCase();
        img.src = planetPreviewMap[planetKey] || "/textures/images/previews/default.webp";
        img.alt = planet.name || planet.planeta || "Planet";
        img.style.marginRight = "8px";
        img.style.alignSelf = "center";
        btn.appendChild(img);

        const nameSpan = document.createElement("span");
        nameSpan.className = "planetBar-name";
        nameSpan.textContent = planet.planeta || planet.name || "";
        btn.appendChild(nameSpan);

        btn.onclick = () => {
            document.querySelectorAll(".planetBar-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
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

function goToPlanet(newIndex) {
    solarCheck = 0;
    prev = planetNo;
    planetNo = currentSolar == 1 ? newIndex : newIndex - planetySun.length;
    transitionRestart = false;
    transitionPercent = 0;
    planetBarActivation = true;
}

const contact = document.getElementById("contact");
contact.addEventListener("click", () => {
    const contactDialog = document.getElementById("contactDialog");
    contactDialog.showModal();
    contactDialog.style.display = "flex";
    const highResAvatar = new Image();
    highResAvatar.src = document.getElementById("avatar").src.replace(".webp", "2.webp");
    highResAvatar.onload = () => {
        console.log("High resolution avatar loaded successfully.");
        document.getElementById("avatar").src = highResAvatar.src;
    };
});

const masterGalleryImages = planetsInfo
    .filter(planet => Array.isArray(planet.images) && planet.images.length > 0)
    .flatMap(planet => planet.images.map(image => '/textures/images/' + image + '.webp'));
console.log("Master Gallery Images:", masterGalleryImages);

const masterGallery = document.getElementById("masterGallery");

masterGallery.addEventListener("click", () => {
    const masterGalleryDialog = document.getElementById("masterGalleryDialog");
    const masterGalleryGrid = masterGalleryDialog.querySelector("#masterGalleryGrid");
    const galleryImageDialog = document.getElementById("galleryImageDialog");
    const galleryImageDialogImg = document.getElementById("galleryImageDialogImg");
    const naviHolder = document.getElementById("naviHoldersMaster");


    masterGalleryDialog.showModal();
    masterGalleryDialog.style.display = "flex";
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
        img.classList.add("gallery-image");

        img.addEventListener("click", function () {
            galleryImageDialogImg.src = imgPath;
            galleryImageDialog.showModal();
            galleryImageDialog.style.display = "flex";
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

let transitionComplete = false

function cameraMoveNegative(val) {
    if (transitionComplete) {
        if (camera.fov >= 20) {
            camera.fov -= val
            document.getElementById("switch").checked = true;
        }
        else if (camera.fov >= 10 && camera.fov < 20) {
            cameraRampUp += 0.07
            if (cameraRampUp >= 1) {
                camera.fov -= userCameraMoveSpeed
            }

        }
        if (camera.fov <= 10) {
            info()
            document.getElementById("inspekcja").style.display = "block";
            document.getElementById("container").style.display = "block";
            document.getElementById("inspekcjaDane").style.display = "block";
            cameraRampUp = 0
            camera.fov = 10
        }
        if (planetNo == checkSolar() - 1) {
            solarReset = 1
        }
        console.log("cameraMoveNegative", camera.fov, val);
    }

}
function cameraMovePositive(val) {
    camera.fov += val

    if (camera.fov > 20) {
        // info()
        // console.log("asds");

        document.getElementById("inspekcja").style.display = "none";
        document.getElementById("inspekcjaDane").style.display = "none";
        document.getElementById("container").style.display = "none";

        inspectFalsePositive = 0
    }
    console.log("cameraMovePositive", camera.fov, val);
}

function cameraSettings(lookat) {
    // camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 1, 10000)
    cameraFallback(cameraOldPos)
    camera.lookAt(lookat)
    if (camera.fov == 10) {

    }

}

function hideInfo() {
    document.getElementById("inspekcja").style.display = "none";
    document.getElementById("inspekcjaDane").style.display = "none";
    document.getElementById("container").style.display = "none";
}
hideInfo()
let transitionSpeed = 0.005
let transitionPercent = 0

prev = 0
function cameraTransition(planetyPos) {
    if (checkPlanetaryState()[prev]) {
        planetyPrevPos = checkPlanetaryState()[prev].blok.kostka.getWorldPosition(new THREE.Vector3());
    } else {
        planetyPrevPos = planetyPos;
    }
    let transition = new THREE.Vector3().lerpVectors(planetyPrevPos, planetyPos, transitionPercent)
    if (transitionPercent < 1 && transitionRestart == false) {
        transitionPercent += transitionSpeed + 0.005
        transitionSpeed = transitionSpeed + 0.005
        document.getElementById("next").disabled = true;
        if (transitionPercent > 0.4) {
            transitionSpeed = transitionSpeed - 0.0155
        }
        if (transitionSpeed <= 0) {
            transitionSpeed = 0.05
        }
        transitionComplete = false
        camera.lookAt(transition)
    }
    else {
        transitionPercent = 0
        transitionSpeed = 0.001
        transitionRestart = true
        transitionComplete = true
        planetBarActivation = false
        orbitConfirm = 1
        document.getElementById("next").disabled = false;
        camera.lookAt(planetyPos)

    }
    return transitionComplete
}

let transitionPercentCamera = 0
let transitionSpeedCamera = 0.001
let transitionRestartCamera = false

function cameraFallback(cameraOldPos) {
    let cameraFixed = new THREE.Vector3(20, 20, 20)
    let transitionCamera = new THREE.Vector3().lerpVectors(cameraOldPos, cameraFixed, transitionPercentCamera)
    if (transitionPercentCamera < 1 && transitionRestartCamera == false) {
        transitionPercentCamera += transitionSpeedCamera
        transitionSpeedCamera = transitionSpeedCamera + 0.00005
        camera.position.set(transitionCamera.x, transitionCamera.y, transitionCamera.z)
    }
    else {
        transitionPercentCamera = 0
        transitionSpeedCamera = 0.001
        transitionRestartCamera = true
        camera.position.set(20, 20, 20)

    }

}
function earthAdd() {
    planetySun[2].blok.kostka.add(planetySun[3].blokObj.kostka)
    troll = 0
}
let pyroxAdded = false
function pyroxAdd() {
    const pyrox = planetyBlackHole.find(el => el.planeta === "pyrox");
    const pyroxBlobs = planetyBlackHole.filter(el => el.planeta && el.planeta.startsWith("pyroxBlob"));
    if (pyrox && pyroxBlobs.length) {
        pyroxBlobs.forEach(blob => {
            pyrox.blok.kostka.add(blob.blokObj.kostka);
        });
    }
    pyroxAdded = true;
}

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
    if (currentSolar == 1) {
        loadingCompleted = planetLoadedCount >= planetySun.length;
    } else if (currentSolar == 2) {
        loadingCompleted = planetBlackHoleLoadedCount >= planetyBlackHole.length;
    } else {
        loadingCompleted = false;
    }
}
let opacityFall = false
vid.addEventListener('ended', () => {
    checkPlanetsLoaded();

    if (loadingCompleted) {
        if (vid) {
            opacityFall = true
            rumpup = false
            if (currentSolar == 1) earthAdd();
            if (currentSolar == 2) {
                pyroxAdd();
                renderer.toneMappingExposure = BLACKHOLE_EXPOSURE;

                scene.traverse(obj => {
                    if (obj.isLight) obj.power = BLACKHOLE_LIGHT_POWER;
                });
            }
            transitionRestartCamera = false
            transitionRestart = false
            focusCheck = true
            solarCheck = 1
            prev = planetNo
            transitionPercentCamera = 0
            planetNo = 0
            focusFalsePositive = 0;
            inspectFalsePositive = 0;
            solarReset = 0
            orbitOnce = 0
            createPlanetBar();
            light();
            startFalldown();
            orbitSettings();
            const firstBtn = document.getElementById("planetBar").querySelector(".planetBar-btn");
            firstBtn.classList.add("active");
            document.getElementById("planetBar").style.display = "flex";
            document.getElementById("arrowSelectArrow").style.display = "none";
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
        opacityVal -= 7
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
            loadNextSolar(() => {
                startTransitionIn();
                isSwitchingSolar = false;
            });
        });
    });
}
function startTransitionOut(callback) {
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
    unloadedCount = 0;
    clearScene()
    const totalToUnload = checkPlanetaryState().length;
    callback();
}

function loadNextSolar(callback) {
    oneTimeTicket = true;
    if (currentSolar == 1) {
        currentSolar = 2;
        planetLoadedCount = 0;
        planetBlackHoleLoadedCount = 0;
        removeDivs();
        delPlanetBar();
        loadBlackHoleSolar();

        function checkLoaded() {
            console.log("len:" + scene.children.length);
            if (planetBlackHoleLoadedCount >= planetyBlackHole.length) {
                callback();
            } else {
                setTimeout(checkLoaded, 20);
            }
        }
        checkLoaded();
    } else {
        currentSolar = 1;
        planetLoadedCount = 0;
        planetBlackHoleLoadedCount = 0;
        troll = 1;
        removeDivs();
        delPlanetBar();
        loadSunSolar();

        function checkLoaded() {
            console.log("len:" + scene.children.length);
            if (planetLoadedCount >= planetySun.length) {
                callback();
            } else {
                setTimeout(checkLoaded, 20);
            }
        }
        checkLoaded();
    }
}

function startTransitionIn() {
    opacityFall = true;
    startFalldown();
    createPlanetBar();
    light();
    scene.traverse(obj => {
        if (obj.isLight) obj.castShadow = false;
    });
    orbitSettings();
    // ...other UI setup...
}

let unloadedCount = 0

function unloadModels(model) {
    // Remove from parent if needed
    if (model.parent) model.parent.remove(model);
    scene.remove(model);

    model.traverse((child) => {
        if (child.isMesh) {
            // Dispose geometry
            if (child.geometry) child.geometry.dispose();

            // Dispose textures
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        if (mat.map) mat.map.dispose();
                        if (mat.lightMap) mat.lightMap.dispose();
                        if (mat.bumpMap) mat.bumpMap.dispose();
                        if (mat.normalMap) mat.normalMap.dispose();
                        if (mat.aoMap) mat.aoMap.dispose();
                        if (mat.emissiveMap) mat.emissiveMap.dispose();
                        if (mat.specularMap) mat.specularMap.dispose();
                        mat.dispose();
                    });
                } else {
                    if (child.material.map) child.material.map.dispose();
                    if (child.material.lightMap) child.material.lightMap.dispose();
                    if (child.material.bumpMap) child.material.bumpMap.dispose();
                    if (child.material.normalMap) child.material.normalMap.dispose();
                    if (child.material.aoMap) child.material.aoMap.dispose();
                    if (child.material.emissiveMap) child.material.emissiveMap.dispose();
                    if (child.material.specularMap) child.material.specularMap.dispose();
                    child.material.dispose();
                }
            }
        }
    });

    // Remove references from your planet data
    for (const planet of [...planetySun, ...planetyBlackHole]) {
        if (planet.blok.kostka === model) planet.blok.kostka = null;
        if (planet.blokObj.kostka === model) planet.blokObj.kostka = null;
    }

    unloadedCount++;
}

function clearScene() {
    for (let i = scene.children.length - 1; i >= 0; i--) {
        const obj = scene.children[i];
        // Skip starfield by name
        if (obj.name === "starfield") continue;

        scene.remove(obj);
        // Dispose geometry/material if mesh
        if (obj.isMesh) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(mat => mat.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        }
    }
}
let opacityVal = 100

function opacityRumpup() {
    vid.style.opacity = opacityVal + "%"
    plate.style.opacity = opacityVal + "%"
    loadingText.style.display = "block"
    allLoaded.style.display = "none"
    allLoaded.style.opacity = opacityVal + "%"
    if (vid.style.opacity >= 1.5) {
        rumpup = false
        planetLoadedCount = planetLoadedCount - unloadedCount;
    }
    if (vid.style.opacity <= 1.5) {
        opacityVal += 7
    }
    if (opacityVal >= 5) {
        vid.style.zIndex = 10;
        plate.style.zIndex = 10;
        nextSolar();

    }
}

let cameraRampUp = 0, troll = 1, orbitOnce = 0, orbitConfirm = 0, wasSolarCheckZero = false
const target = orbit.target;
const userCameraMoveSpeed = 1.5
function checkPlanetaryState() {
    if (currentSolar == 1) {
        return planetySun
    } else if (currentSolar == 2) {
        return planetyBlackHole
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
    }, 4);
}

function animate() {

    if (currentSolar == 1 && planetLoadedCount < planetySun.length) return;
    if (currentSolar == 2 && planetBlackHoleLoadedCount < planetyBlackHole.length) return;

    oneTimeTicket = false
    if (planetySun[2].blok.kostka != null && planetySun[3].blokObj.kostka != null && troll == 1) earthAdd()
    if (planetyBlackHole[2].blok.kostka != null && planetyBlackHole[3].blokObj.kostka != null && pyroxAdded == false) pyroxAdd()
    cameraPosCheck()
    camera.updateProjectionMatrix()



    orbitZoom.target.set(target.x, target.y, target.z)
    orbitZoom.update();

    if (checkPlanetaryState()[planetNo] && checkPlanetaryState()[planetNo].isMoon == true) { planetNo++; }

    let planetyPos = checkPlanetaryState()[planetNo].blok.kostka.getWorldPosition(new THREE.Vector3());

    if (planetBarActivation) cameraTransition(planetyPos)

    if (currentSolar == 2 && camera.fov <= 20) {
        scene.traverse(obj => {
            if (obj.isLight) obj.castShadow = false;
        });
        renderer.shadowMap.enabled = false;
    }
    camera.lookAt(planetyPos)
    if (solarCheck == 0) {
        if (!wasSolarCheckZero) {
            document.getElementById("blocked").style.display = "none";
            wasSolarCheckZero = true;
        }

        if (!focusCheck && camera.fov > 10 && nextCheck == 0) { // zoomowanie kamery na planete
            if (camera.fov < 10) {
                camera.fov = 10
            }
            if (focusFalsePositive == 2) {
                focusFalsePositive = 0
                camera.fov = 45
            }
            prev = planetNo - 1
            if (prev < 0) {
                prev = 0
            }
            cameraTransition(planetyPos);
            if (transitionComplete) {
                // cameraSettings(planetyPos);
                cameraMoveNegative(userCameraMoveSpeed)
            }
        }
        if (focusCheck && camera.fov >= 10 && camera.fov <= 45) { // oddalnie kamery po PlanetFocus
            cameraMovePositive(userCameraMoveSpeed)

            camera.lookAt(planetyPos)
            if (planetNo == 0) {
                orbit.update();
                // prev = 4
            }

            if (camera.fov > 45) {
                camera.fov = 45
                nastepne = true
                orbitConfirm = 0
                if (prev == null) {
                    prev = planetNo - 1
                }
                cameraTransition(planetyPos)
            }

        }
    }
    else if (solarCheck == 1 && camera.fov >= 10 || camera.fov < 45 && planetNo == 0) { // oddalanie kamery jak jest fov < 45 na słońcu
        wasSolarCheckZero = false;
        if (focusCheck && camera.fov < 45) cameraMovePositive(userCameraMoveSpeed)

        if (camera.fov < 45) {
            cameraSettings(planetyPos)
        }
        if (camera.fov >= 45) {
            camera.fov = 45
            if (transitionComplete) {
                if (orbitOnce == 0) {
                    orbitConfirm = 1
                    orbitSettings()
                    orbitOnce = 1
                }
                orbit.update()

            }

        }
    }
    if (nextCheck == 1) { // oddalanie kamery i zmiana targetu jak przyblizona i klikniete next
        cameraMovePositive(userCameraMoveSpeed)
        hideInfo()
        cameraSettings(planetyPos)
        if (camera.fov >= 45) {
            camera.fov = 45
            if (planetNo == checkSolar() - 1) {
                planetNo = 1
            } else {
                planetNo += 1
            }
            nextCheck = 0
        }
    }
    if (solarCheck == 1) {
        document.getElementById("switch").checked = false;
        document.getElementById("blocked").style.display = "block";
        cameraTransition(planetyPos)
    }
    if (solarCheck == 1 && planetNo == 0 && focusCheck == true && focusFalsePositive == 0 && camera.fov == 45) {
        if (transitionComplete) {
            orbit.update()

        }
        else {
            cameraTransition(planetyPos)
        }
    }
    if (orbitConfirm == 0) {
        cameraFallback(cameraOldPos)
    }
    if (sun && currentSolar == 1) {

        planetySun.forEach(el => {

            if (el.blok.x != null) el.blok.kostka.position.x = el.blok.x
            if (el.blok.y != null) el.blok.kostka.position.y = el.blok.y
            if (el.blok.z != null) el.blok.kostka.position.z = el.blok.z
            if (el.blok.rotation != null) el.blok.kostka.rotation.y += el.blok.rotation
            if (el.planeta == 'sun' || el.planeta == 'BlackHole') return
            if (el.blokObj.kostka.position.x != null) el.blokObj.kostka.position.x = el.blokObj.x
            if (el.blokObj.kostka.position.y != null) el.blokObj.kostka.position.y = el.blokObj.y
            if (el.blokObj.kostka.position.z != null) el.blokObj.kostka.position.z = el.blokObj.z
            if (el.blokObj.kostka.rotation.y != null) el.blokObj.kostka.rotation.y += el.blokObj.rotation
            if (el.planeta == 'earth') {

                const moon = planetySun.filter((element) => element.planeta == 'moon')[0].blok.kostka
                const moonObj = planetySun.filter((element) => element.planeta == 'moon')[0].blokObj.kostka

                if (el.blok.kostka.rotation.x > 0.5) prawda = false
                else if (el.blok.kostka.rotation.x < -0.5) prawda = true
                if (!prawda) {
                    el.blok.kostka.rotation.x -= 0.002
                    moon.rotation.x -= 0.01

                }
                else {
                    el.blok.kostka.rotation.x += 0.002
                    moon.rotation.y += 0.01
                }
                moonObj.position.z += 0.5

            }
            if (el.planeta == 'saturn') {

                if (el.blok.kostka.rotation.x > 0.7) prawda = false
                else if (el.blok.kostka.rotation.x < -0.7) prawda = true
                if (!prawda) el.blok.kostka.rotation.x += 0.002
                else el.blok.kostka.rotation.x -= 0.002
            }

        });
    }

    if (hole && currentSolar == 2) {
        planetyBlackHole.forEach(el => {
            if (el.blok.x != null) el.blok.kostka.position.x = el.blok.x
            if (el.blok.y != null) el.blok.kostka.position.y = el.blok.y
            if (el.blok.z != null) el.blok.kostka.position.z = el.blok.z
            if (el.blok.rotation != null) el.blok.kostka.rotation.y += el.blok.rotation
            if (el.planeta == 'BlackHole') return
            if (el.blokObj.kostka.position.x != null) el.blokObj.kostka.position.x = el.blokObj.x
            if (el.blokObj.kostka.position.y != null) el.blokObj.kostka.position.y = el.blokObj.y
            if (el.blokObj.kostka.position.z != null) el.blokObj.kostka.position.z = el.blokObj.z
            if (el.blokObj.kostka.rotation.y != null) el.blokObj.kostka.rotation.y += el.blokObj.rotation
            // Animate all pyroxBlob planets
            const pyrox = planetyBlackHole.find(element => element.planeta === 'pyrox');
            const pyroxBlobs = planetyBlackHole.filter(element => element.planeta && element.planeta.startsWith('pyroxBlob'));

            if (pyrox) {
                pyroxBlobs.forEach(blob => {
                    const pyroxBlob = blob.blok.kostka;
                    const pyroxObj = blob.blokObj.kostka;

                    if (pyrox.blok.kostka.rotation.x > 0.5) prawda = false;
                    else if (pyrox.blok.kostka.rotation.x < -0.5) prawda = true;
                    if (!prawda) {
                        pyrox.blok.kostka.rotation.x -= 0.0001;
                        pyroxBlob.rotation.x -= 0.001;
                    } else {
                        pyrox.blok.kostka.rotation.x += 0.0001;
                    }
                });
            }
        });
    }

    if (lowQualitySwitch == false) {
        // composer.render();
        renderer.render(scene, camera);
    } else {
        renderer.setClearColor(0x000000);
        renderer.render(scene, camera);
    }
    requestAnimationFrame(animate);
}
function onDocumentMouseMove(event) {

    mouseX = (event.clientX - windowHalfX) / 200;
    mouseY = (event.clientY - windowHalfY) / 90;

}


window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // bloomPass.setSize(window.innerWidth / 2, window.innerHeight / 2)
    // composer.setSize(window.innerWidth, window.innerHeight);
});


