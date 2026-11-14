import * as THREE from 'three';
import { motion as motionConfig } from '../config/settings.js';
import { framesBetween } from '../motion/motion.js';
import { renderFrame } from '../scene/engine.js';
import { state, systemReady } from './state.js';

/**
 * Czy urządzenie jest mobilne (wtedy animacja jest wyłączona).
 * @returns {boolean}
 */
/**
 * Główna pętla animacji: kamera, HUD, ruch planet, celowanie i render z przelotem.
 * @param {object} deps
 * @returns {{ensureRunning: () => void}}
 */
/**
 * Czy urządzenie jest mobilne (wtedy animacja jest wyłączona).
 * @returns {boolean}
 */
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function createRenderLoop({ engine, cameraRig, hud, planetPicker, warp, warpStars, starfield }) {
    const vignette = document.getElementById('warpVignette');
    const warpShift = new THREE.Vector3();
    let lastFrameTime = performance.now();

    /**
     * Renderuje klatkę z przesunięciem kamery i smugami gwiazd przelotu.
     * Przesunięcie działa tylko na czas renderu, żeby nie mieszać w stanie kamery.
     * @param {number} dt - czas klatki w sekundach
     * @returns {void}
     */
    function renderWithWarp(dt) {
        const { offset, speed, intensity } = warp.update(dt);
        const { camera } = engine;
        warpShift.set(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar(offset);
        camera.position.add(warpShift);
        starfield.material.opacity = 1 - intensity;
        vignette.style.opacity = String(intensity);
        warpStars.update(dt, speed, intensity, camera);
        renderFrame(engine, state.lowQuality);
        camera.position.sub(warpShift);
    }

    /**
     * Jedna klatka pętli; sama się planuje dalej, dopóki jest układ albo przelot.
     * @param {number} [time]
     * @returns {void}
     */
    function animate(time = performance.now()) {
        if (isMobile()) return;
        if (!systemReady() && !warp.active) {
            state.renderLoopRunning = false;
            return;
        }

        const frames = framesBetween(time - lastFrameTime, motionConfig.maxFrames, motionConfig.fps);
        const dt = frames / motionConfig.fps;
        lastFrameTime = time;

        if (systemReady()) {
            cameraRig.update(dt);
            hud.update(dt);
            state.activeSystem.update(frames);
        }
        planetPicker.update();
        renderWithWarp(dt);

        requestAnimationFrame(animate);
    }

    /**
     * Uruchamia pętlę, jeśli jeszcze nie działa.
     * @returns {void}
     */
    function ensureRunning() {
        if (!state.renderLoopRunning) {
            state.renderLoopRunning = true;
            animate();
        }
    }

    return { ensureRunning };
}
