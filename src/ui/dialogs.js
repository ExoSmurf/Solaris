const CLOSING_CLASS = 'closing';
const CLOSE_FALLBACK_MS = 400;

const pendingCloses = new WeakMap();

/**
 * Czy użytkownik prosi system o ograniczenie animacji.
 * @returns {boolean}
 */
function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Czy dialog jest otwarty i nie jest właśnie w trakcie zamykania.
 * @param {HTMLDialogElement} dialog
 * @returns {boolean}
 */
export function isDialogVisible(dialog) {
    return dialog.open && !pendingCloses.has(dialog);
}

/**
 * Otwiera dialog jako modalny. Jeśli dialog właśnie znika, przerywa zanikanie zamiast otwierać go od nowa.
 * @param {HTMLDialogElement} dialog
 * @returns {void}
 */
export function openDialog(dialog) {
    const pending = pendingCloses.get(dialog);
    if (pending) pending.cancel();
    else if (!dialog.open) dialog.showModal();
    dialog.style.display = 'flex';
}

/**
 * Zamyka dialog z animacją zanikania (klasa `closing` w CSS), a `close()` wywołuje dopiero po jej końcu,
 * więc zdarzenie `close` (i sprzątanie podpięte pod nie) przychodzi po animacji.
 * Przy `prefers-reduced-motion` zamyka od razu. Ponowne wywołanie w trakcie zanikania nic nie robi.
 * @param {HTMLDialogElement} dialog
 * @returns {void}
 */
export function closeDialog(dialog) {
    if (!dialog.open || pendingCloses.has(dialog)) return;

    const finish = () => {
        cleanup();
        dialog.style.display = 'none';
        dialog.close();
    };
    const onAnimationEnd = (event) => {
        if (event.target === dialog) finish();
    };
    const timer = setTimeout(finish, CLOSE_FALLBACK_MS);
    const cleanup = () => {
        clearTimeout(timer);
        dialog.removeEventListener('animationend', onAnimationEnd);
        dialog.classList.remove(CLOSING_CLASS);
        pendingCloses.delete(dialog);
    };

    if (prefersReducedMotion()) {
        finish();
        return;
    }

    pendingCloses.set(dialog, { cancel: cleanup });
    dialog.classList.add(CLOSING_CLASS);
    dialog.addEventListener('animationend', onAnimationEnd);
}

/**
 * Blokuje natychmiastowe zamknięcie dialogu klawiszem Escape przez przeglądarkę,
 * żeby zamknięciem (z animacją) zajęła się aplikacja.
 * @param {HTMLDialogElement} dialog
 * @returns {void}
 */
export function preventInstantEscape(dialog) {
    dialog.addEventListener('cancel', (event) => event.preventDefault());
}
