/**
 * Podpina przyciski z atrybutem `data-action` przez jedną delegację na dokumencie
 * (zamiast inline `onclick` w HTML).
 * @param {Record<string, (element: HTMLElement) => void>} handlers - nazwa akcji → funkcja
 * @returns {void}
 */
export function bindActions(handlers) {
    document.addEventListener("click", (event) => {
        const element = event.target.closest("[data-action]");
        if (!element) return;
        const handler = handlers[element.dataset.action];
        if (handler) handler(element);
    });
}
