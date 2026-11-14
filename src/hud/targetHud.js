import * as THREE from 'three';
import { hud as hudConfig } from '../config/settings.js';
import { cameraStatus, createCameraStatus } from '../ui/cameraStatus.js';
import {
    bracketFrame,
    createLockBrackets,
    formatCoordinates,
    formatDelta,
    lockBracketsState,
    movementSpeed,
    searchCoordinates,
    searchSpread,
    smoothValue,
} from '../ui/lockBrackets.js';
import { scaledHud } from "../ui/uiScale.js";
import { projectToScreen } from '../scene/projection.js';
import { activeBodies } from '../app/state.js';

/**
 * Nakładka HUD: status kamery, ramka celu wokół śledzonej planety i prędkość namierzania.
 * @param {{camera: THREE.PerspectiveCamera, cameraRig: object}} deps
 * @returns {{update: (dt: number) => void}}
 */
export function createTargetHud({ camera, cameraRig, scene }) {
    const statusDisplay = createCameraStatus(document.getElementById("cameraStatus"));
    const bracketsElement = document.getElementById("lockBrackets");
    const bracketsDisplay = createLockBrackets(bracketsElement, {
        coordinates: bracketsElement.querySelector(".bracket-label"),
        delta: bracketsElement.querySelector(".bracket-delta"),
        progress: bracketsElement.querySelector(".bracket-progress-fill"),
    });

    const ringElement = document.getElementById("container");
    const arrowElement = document.getElementById("arrow");
    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xa259ff, transparent: true, opacity: 0.45, depthWrite: false });
    const orbitPosition = new THREE.Vector3();
    let orbitLine = null;
    let orbitBody = null;

    /**
     * Ślad orbity zablokowanej planety: okrąg o jej promieniu wokół Słońca. Ciała-księżyce go nie mają.
     * @param {object} body - śledzona planeta
     * @param {boolean} visible - czy pokazać ślad (tylko przy blokadzie)
     * @returns {void}
     */
    function syncOrbit(body, visible) {
        if (!visible || body.isMoon) {
            if (orbitLine) orbitLine.visible = false;
            return;
        }
        if (orbitBody !== body) {
            if (orbitLine) {
                scene.remove(orbitLine);
                orbitLine.geometry.dispose();
            }
            body.worldCenter(orbitPosition);
            const radius = Math.hypot(orbitPosition.x, orbitPosition.z);
            const points = [];
            for (let i = 0; i < 160; i++) {
                const angle = (i / 160) * Math.PI * 2;
                points.push(new THREE.Vector3(Math.cos(angle) * radius, orbitPosition.y, Math.sin(angle) * radius));
            }
            orbitLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), orbitMaterial);
            scene.add(orbitLine);
            orbitBody = body;
        }
        orbitLine.visible = true;
    }
    const previousPosition = new THREE.Vector3();
    const targetPosition = new THREE.Vector3();
    let previousTarget = null;
    let speed = 0;
    let clock = 0;

    /**
     * Ramka celu wokół ciała; null, gdy ciało jest poza kadrem.
     * @param {object} body
     * @param {number} closing - stopień domknięcia ramki (0..1)
     * @returns {{frame: object, pixelRadius: number}|null}
     */
    function bracketPlacement(body, closing) {
        const placement = projectToScreen(targetPosition, body.radius, camera);
        if (!placement) return null;
        const viewport = { width: window.innerWidth, height: window.innerHeight };
        return {
            frame: bracketFrame(placement.center, placement.radius, viewport, closing, scaledHud().brackets),
            pixelRadius: placement.radius,
        };
    }

    /**
     * Współrzędne pokazywane w ramce; podczas szukania drgają wokół celu.
     * @param {object} bracketsState
     * @param {object} body
     * @param {{frame: object, pixelRadius: number}|null} placement
     * @returns {THREE.Vector3}
     */
    function bracketCoordinates(bracketsState, body, placement) {
        if (bracketsState.visibility !== 'searching' || !placement) return targetPosition;
        const spread = searchSpread(placement.frame.size, body.radius, placement.pixelRadius);
        const tick = Math.floor(clock * hudConfig.brackets.searchJitterRate);
        return searchCoordinates(targetPosition, spread, tick);
    }

    /**
     * Ustawia pierścień ze strzałkami na środku planety, w rozmiarze jej zamkniętej ramki.
     * @param {object} body - śledzona planeta
     * @returns {void}
     */
    function placeRing(body) {
        const placement = projectToScreen(targetPosition, body.radius, camera);
        if (!placement) return;
        const viewport = { width: window.innerWidth, height: window.innerHeight };
        const frame = bracketFrame(placement.center, placement.radius, viewport, 1, scaledHud().brackets);
        ringElement.style.transform = `translate(${placement.center.x.toFixed(1)}px, ${placement.center.y.toFixed(1)}px)`;
        arrowElement.style.height = `${frame.size.toFixed(1)}px`;
    }

    /**
     * Aktualizuje HUD dla śledzonej planety; wołane co klatkę, gdy układ jest gotowy.
     * @param {number} dt - czas klatki w sekundach
     * @returns {void}
     */
    function update(dt) {
        const body = activeBodies()[cameraRig.targetIndex];
        if (!body) return;
        camera.updateMatrixWorld();
        body.worldCenter(targetPosition);
        placeRing(body);
        syncOrbit(body, cameraRig.mode === 'focused');

        if (previousTarget === body) {
            speed = smoothValue(speed, movementSpeed(previousPosition, targetPosition, dt), hudConfig.delta.smoothing);
        } else {
            speed = 0;
            previousTarget = body;
        }
        previousPosition.copy(targetPosition);

        statusDisplay.show(cameraStatus(cameraRig.mode, cameraRig.targetIndex));

        const bracketsState = lockBracketsState(
            cameraRig.mode,
            cameraRig.phaseProgress,
            cameraRig.refocusing,
            hudConfig.brackets.searchClosing,
        );
        clock += dt;
        const placement = bracketsState.visibility === 'hidden' ? null : bracketPlacement(body, bracketsState.closing);
        bracketsDisplay.show(bracketsState, placement?.frame ?? null, {
            coordinates: formatCoordinates(bracketCoordinates(bracketsState, body, placement)),
            delta: formatDelta(speed),
            progress: bracketsState.closing,
        });
    }

    return { update };
}
