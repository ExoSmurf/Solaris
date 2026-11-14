import { closeDialog, isDialogVisible, openDialog, preventInstantEscape } from './dialogs.js';

/**
 * Zamyka wszystkie widoczne dialogi oprócz wymienionych. Gdy coś się zamknęło z własnej inicjatywy,
 * cofa też wpis w historii przeglądarki (żeby Wstecz nie zamykał dwa razy).
 * @param {string[]} [idsToExclude]
 * @param {boolean} [fromPopstate] - true, gdy wywołane przez przycisk Wstecz
 * @returns {void}
 */
export function closeAllVisibleDialogs(idsToExclude = [], fromPopstate = false) {
    let anyClosed = false;
    document.querySelectorAll('dialog').forEach((dialog) => {
        if (isDialogVisible(dialog) && !idsToExclude.includes(dialog.id)) {
            closeDialog(dialog);
            anyClosed = true;
        }
    });
    if (anyClosed && window.history.state && window.history.state.dialogOpen && !fromPopstate) {
        history.back();
    }
}

/**
 * Otwiera dialog i zapisuje to w historii, żeby przycisk Wstecz go zamykał.
 * @param {string} dialogId
 * @returns {void}
 */
export function openDialogWithHistory(dialogId) {
    openDialog(document.getElementById(dialogId));
    history.pushState({ dialogOpen: true, dialogId }, "");
}

/**
 * Zamyka dialog o podanym id.
 * @param {string} id
 * @returns {void}
 */
export function closeDialogById(id) {
    closeDialog(document.getElementById(id));
}

/**
 * Podpina obsługę Escape i przycisku Wstecz do zamykania dialogów.
 * @returns {void}
 */
export function initDialogHistory() {
    document.querySelectorAll("dialog").forEach(preventInstantEscape);
    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeAllVisibleDialogs();
    });
    window.addEventListener("popstate", () => closeAllVisibleDialogs([], true));
}
