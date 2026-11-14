import { paths } from '../config/settings.js';
import { activeBodies, globalPlanetIndex, state } from '../app/state.js';
import { planetsInfo } from '../info/planetData.js';

/**
 * Dolny pasek planet: przyciski z podglądem, aktywna planeta i chowanie nawigacji.
 * @param {{cameraRig: object}} deps
 * @returns {{build: () => void, updateActive: () => void, stow: (stowed: boolean) => void}}
 */
export function createPlanetBar({ cameraRig }) {
    const bar = document.getElementById("planetBar");

    /**
     * Przelot do planety o globalnym indeksie (szybki, bez pośrednich ujęć).
     * @param {number} globalIdx
     * @returns {void}
     */
    function goTo(globalIdx) {
        cameraRig.select(globalIdx - globalPlanetIndex(0), { fast: true });
    }

    /**
     * Buduje przyciski dla planet aktualnego układu (bez księżyców).
     * @returns {void}
     */
    function build() {
        bar.style.display = "flex";
        bar.innerHTML = "";
        activeBodies().forEach((body, index) => {
            if (body.isMoon) return;
            const globalIdx = globalPlanetIndex(index);
            const planet = planetsInfo[globalIdx];

            const btn = document.createElement("button");
            btn.className = "planetBar-btn";
            if (globalIdx === state.planetNo) btn.classList.add("active");

            const img = document.createElement("img");
            img.src = paths.previews + (planet.preview ?? paths.defaultPreview) + ".webp";
            img.alt = "";
            img.style.marginRight = "calc(8 * var(--u))";
            img.style.alignSelf = "center";
            img.draggable = false;
            btn.appendChild(img);

            const nameSpan = document.createElement("span");
            nameSpan.className = "planetBar-name";
            nameSpan.textContent = planet.name || "";
            btn.appendChild(nameSpan);

            btn.onclick = () => {
                if (cameraRig.isBusy()) return;
                goTo(globalIdx);
            };
            bar.appendChild(btn);
        });
    }

    /**
     * Zaznacza przycisk aktualnie śledzonej planety.
     * @returns {void}
     */
    function updateActive() {
        const bodies = activeBodies();
        const visible = bodies.map((_, i) => i).filter((i) => !bodies[i].isMoon);
        const activeIdx = visible.indexOf(cameraRig.targetIndex);
        document.querySelectorAll(".planetBar-btn").forEach((btn, i) => btn.classList.toggle("active", i === activeIdx));
    }

    /**
     * Chowa dolną nawigację w dół albo wysuwa ją z powrotem (klasa `stowed`, animacja w CSS).
     * @param {boolean} stowed
     * @returns {void}
     */
    function stow(stowed) {
        document.getElementById("navs").classList.toggle("stowed", stowed);
    }

    return { build, updateActive, stow };
}
