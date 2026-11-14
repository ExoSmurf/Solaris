import { loading as loadingConfig } from '../config/settings.js';

/**
 * Ekran ładowania: odtwarza film, a po zakończeniu (gdy układ gotowy) wygasza go i pokazuje UI.
 * @param {{isReady: () => boolean, onFinished: () => void}} deps
 * @returns {void}
 */
export function createLoadingScreen({ isReady, onFinished }) {
    const vid = document.getElementById("loading");
    const plate = document.getElementById("loadingPlane");
    const loadingText = document.getElementById("loadingText");
    const allLoaded = document.getElementById("allLoaded");
    let opacityVal = 100;
    const speedFall = 2.5;
    let opacityFall = false;
    let falldownInterval = null;
    let falldownHoldTimer = null;

    /**
     * Krok wygaszania ekranu ładowania.
     * @returns {void}
     */
    function fall() {
        if (vid.style.zIndex == -10) return;
        vid.style.opacity = opacityVal + "%";
        plate.style.opacity = opacityVal + "%";
        loadingText.style.display = "none";
        allLoaded.style.display = "block";
        allLoaded.style.opacity = opacityVal + "%";
        if (vid.style.opacity > 0) {
            opacityVal -= speedFall;
        }
        if (opacityVal <= 5) {
            vid.style.zIndex = -10;
            plate.style.zIndex = -10;
            opacityFall = false;
        }
    }

    /**
     * Startuje wygaszanie po chwili pokazania komunikatu „all loaded”.
     * @returns {void}
     */
    function startFalldown() {
        if (falldownInterval) clearInterval(falldownInterval);
        clearTimeout(falldownHoldTimer);
        loadingText.style.display = "none";
        allLoaded.style.display = "block";
        allLoaded.style.opacity = "100%";
        falldownHoldTimer = setTimeout(() => {
            falldownInterval = setInterval(() => {
                if (!opacityFall) {
                    clearInterval(falldownInterval);
                    return;
                }
                fall();
            }, 1);
        }, loadingConfig.allLoadedHold * 1000);
    }

    vid.addEventListener("ended", () => {
        if (!isReady()) {
            vid.play();
            return;
        }
        opacityFall = true;
        onFinished();
        startFalldown();
        setTimeout(() => log.remove(), 1200);
    });
    const log = document.createElement("p");
    log.id = "bootLog";
    document.body.appendChild(log);
    const bootLines = ["> INIT CORE", "> LOAD SOLAR MODEL", "> CALIBRATE RADAR", "> SYSTEM ONLINE"];
    let bootIndex = 0;
    const typeBootLine = () => {
        if (bootIndex >= bootLines.length || !log.isConnected) return;
        log.textContent += (log.textContent ? "\n" : "") + bootLines[bootIndex++];
        setTimeout(typeBootLine, 450);
    };
    typeBootLine();
    vid.play();
}
