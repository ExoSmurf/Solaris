import { closeAllVisibleDialogs, openDialogWithHistory } from './dialogHistory.js';

/**
 * Przycisk kontaktu: otwiera dialog i dociąga wysoką rozdzielczość awatara.
 * @returns {void}
 */
export function initContact() {
    document.getElementById("contact").addEventListener("click", () => {
        closeAllVisibleDialogs();
        openDialogWithHistory("contactDialog");
        const avatar = document.getElementById("avatar");
        const highResAvatar = new Image();
        highResAvatar.src = avatar.src.replace(".webp", "2.webp");
        highResAvatar.onload = () => {
            avatar.src = highResAvatar.src;
        };
    });
}
