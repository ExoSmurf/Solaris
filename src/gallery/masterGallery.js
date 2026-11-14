import { paths } from '../config/settings.js';
import { planetsInfo } from '../info/planetData.js';
import { setupZoomPan } from '../info/zoomPan.js';
import { closeAllVisibleDialogs, openDialogWithHistory } from '../ui/dialogHistory.js';

/**
 * Galeria wszystkich zdjęć: siatka miniatur i podgląd jednego zdjęcia z zoomem.
 * @returns {void}
 */
export function initMasterGallery() {
    const images = planetsInfo
        .filter((planet) => planet.images.length > 0)
        .flatMap((planet) => planet.images.map((image) => paths.images + image + ".webp"));

    const masterDialog = document.getElementById("masterGalleryDialog");
    const grid = document.getElementById("masterGalleryGrid");
    const navi = document.getElementById("naviHoldersMaster");
    const viewer = document.getElementById("galleryImageDialog");
    const viewerImg = document.getElementById("galleryImageDialogImg");
    setupZoomPan(viewerImg);

    /**
     * Wypełnia siatkę miniaturami i otwiera galerię.
     * @returns {void}
     */
    function open() {
        closeAllVisibleDialogs();
        openDialogWithHistory("masterGalleryDialog");
        navi.style.display = "flex";
        grid.innerHTML = "";
        images.forEach((imagePath, idx) => {
            const img = document.createElement("img");
            img.src = imagePath;
            img.alt = `Gallery image ${idx + 1}`;
            img.loading = "lazy";
            img.draggable = false;
            img.classList.add("gallery-image");
            img.addEventListener("click", () => showImage(imagePath));
            grid.appendChild(img);
        });
    }

    /**
     * Pokazuje zdjęcie w podglądzie, dociągając wysoką rozdzielczość.
     * @param {string} imagePath
     * @returns {void}
     */
    function showImage(imagePath) {
        viewerImg.src = imagePath;
        closeAllVisibleDialogs(["masterGalleryDialog"]);
        openDialogWithHistory("galleryImageDialog");
        const highRes = new Image();
        highRes.src = imagePath.replace(".webp", "2.webp");
        highRes.onload = () => {
            viewerImg.src = highRes.src;
        };
    }

    document.getElementById("masterGallery").addEventListener("click", open);
    viewer.addEventListener("close", () => {
        viewerImg.src = "";
    });
    masterDialog.addEventListener("close", () => {
        navi.style.display = "none";
        grid.innerHTML = "";
    });
}
