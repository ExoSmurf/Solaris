const controllers = new WeakMap();
const views = new WeakMap();

/**
 * Ustawia transformację obrazu (zoom i przesunięcie), z ograniczeniem przesunięcia do krawędzi.
 * @param {HTMLImageElement} img
 * @returns {void}
 */
function applyTransform(img) {
    const view = views.get(img);
    const rect = img.parentElement.getBoundingClientRect();
    let maxPanX = 0;
    let maxPanY = 0;
    if (view.zoom > 1) {
        maxPanX = (img.naturalWidth * view.zoom - rect.width) / 2;
        maxPanY = (img.naturalHeight * view.zoom - rect.height) / 2;
    }
    view.panX = Math.max(-maxPanX, Math.min(maxPanX, view.panX));
    view.panY = Math.max(-maxPanY, Math.min(maxPanY, view.panY));
    img.style.transform = `translate(-50%, -50%) translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`;
}

/**
 * Podpina zoom kółkiem i przeciąganie (myszą i dotykiem) do obrazu w dialogu.
 * Ponowne wywołanie dla tego samego obrazu zastępuje poprzednie listenery.
 * @param {HTMLImageElement} img
 * @returns {void}
 */
export function setupZoomPan(img) {
    controllers.get(img)?.abort();
    const controller = new AbortController();
    controllers.set(img, controller);
    const { signal } = controller;
    const view = { zoom: 1, panX: 0, panY: 0 };
    views.set(img, view);
    let dragging = false;
    let startX = 0;
    let startY = 0;

    img.addEventListener("wheel", (event) => {
        img.style.transition = "transform 0.2s";
        event.preventDefault();
        const rect = img.getBoundingClientRect();
        const mouseX = event.clientX - rect.left - rect.width / 2;
        const mouseY = event.clientY - rect.top - rect.height / 2;
        const oldZoom = view.zoom;
        view.zoom = event.deltaY < 0 ? Math.min(view.zoom + 0.1, 3) : Math.max(view.zoom - 0.1, 1);
        view.panX -= mouseX * (view.zoom - oldZoom) / view.zoom;
        view.panY -= mouseY * (view.zoom - oldZoom) / view.zoom;
        applyTransform(img);
    }, { signal, passive: false });

    img.addEventListener("mousedown", (event) => {
        img.style.transition = "none";
        dragging = true;
        startX = event.clientX - view.panX;
        startY = event.clientY - view.panY;
        img.style.cursor = "grabbing";
    }, { signal });

    window.addEventListener("mousemove", (event) => {
        if (!dragging) return;
        view.panX = event.clientX - startX;
        view.panY = event.clientY - startY;
        applyTransform(img);
    }, { signal });

    window.addEventListener("mouseup", () => {
        if (!dragging) return;
        dragging = false;
        img.style.cursor = "grab";
    }, { signal });

    img.addEventListener("touchstart", (event) => {
        if (event.touches.length !== 1) return;
        img.style.transition = "none";
        dragging = true;
        startX = event.touches[0].clientX - view.panX;
        startY = event.touches[0].clientY - view.panY;
        img.style.cursor = "grabbing";
    }, { signal, passive: false });

    window.addEventListener("touchmove", (event) => {
        if (!dragging || event.touches.length !== 1) return;
        view.panX = event.touches[0].clientX - startX;
        view.panY = event.touches[0].clientY - startY;
        applyTransform(img);
        event.preventDefault();
    }, { signal, passive: false });

    window.addEventListener("touchend", () => {
        dragging = false;
        img.style.cursor = "grab";
    }, { signal });

    img.parentElement.addEventListener("close", () => {
        img.style.transition = "transform 0.2s";
        view.zoom = 1;
        view.panX = 0;
        view.panY = 0;
        applyTransform(img);
    }, { signal });

    img.style.transition = "transform 0.2s";
    applyTransform(img);
}

/**
 * Przywraca widok bez zoomu i przesunięcia (np. przy zmianie zdjęcia).
 * @param {HTMLImageElement} img
 * @returns {void}
 */
export function resetZoomPan(img) {
    const view = views.get(img);
    if (!view) return;
    view.zoom = 1;
    view.panX = 0;
    view.panY = 0;
    applyTransform(img);
}
