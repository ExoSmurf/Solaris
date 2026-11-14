import * as THREE from 'three';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { camera as cameraConfig, render as renderConfig } from '../config/settings.js';

/**
 * Tworzy renderer, scenę, kamerę, sterowanie orbitalne i łańcuch efektów (bloom).
 * @param {HTMLElement} container - element, do którego trafia canvas
 * @returns {{renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, orbit: OrbitControls, composer: EffectComposer, bloomPass: UnrealBloomPass}}
 */
export function createEngine(container) {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.debug.checkShaderErrors = import.meta.env.DEV;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = renderConfig.exposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        cameraConfig.fov.default,
        window.innerWidth / window.innerHeight,
        cameraConfig.clip.near,
        cameraConfig.clip.far);
    camera.position.set(cameraConfig.position.start.x, cameraConfig.position.start.y, cameraConfig.position.start.z);

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.autoRotate = true;
    orbit.rotateSpeed = cameraConfig.orbit.rotateSpeed;
    orbit.autoRotateSpeed = cameraConfig.orbit.autoRotateSpeed;
    orbit.enableDamping = true;
    orbit.dampingFactor = cameraConfig.orbit.dampingFactor;
    orbit.enableZoom = false;
    orbit.minDistance = cameraConfig.orbit.minDistance;
    orbit.maxDistance = cameraConfig.orbit.maxDistance;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        renderConfig.bloom.strength,
        renderConfig.bloom.radius,
        renderConfig.bloom.threshold,
    );
    composer.addPass(bloomPass);

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        bloomPass.setSize(window.innerWidth / 2, window.innerHeight / 2);
        composer.setSize(window.innerWidth, window.innerHeight);
    });

    return { renderer, scene, camera, orbit, composer, bloomPass };
}

/**
 * Renderuje klatkę: z efektami albo, w trybie niskiej jakości, bezpośrednio.
 * @param {ReturnType<typeof createEngine>} engine
 * @param {boolean} lowQuality
 * @returns {void}
 */
export function renderFrame(engine, lowQuality) {
    if (!lowQuality) {
        engine.composer.render();
    } else {
        engine.renderer.setClearColor(0x000000);
        engine.renderer.render(engine.scene, engine.camera);
    }
}
