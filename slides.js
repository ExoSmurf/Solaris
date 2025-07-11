const dialog = document.getElementById("dialogee");
const arrow = document.getElementById("arrowSelectArrow");
let slideNo = 1

arrow.style.display = "none";

showSlides(slideNo)
function nextImg(n) {
    showSlides(slideNo += n);
}

function prevImg(n) {
    showSlides(slideNo -= n);
}

function currentSlide(n) {
    showSlides(slideNo = n)
}

function showSlides(n) {
    let i, slides = document.getElementsByClassName("slides");
    if (n > slides.length) {
        slideNo = 1;
    }
    if (n < 1) {
        slideNo = slides.length;
    }
    for (i = 0; i < slides.length; i++) {
        slides[i].classList.remove("wyswietlanie");
    }
    slides[slideNo - 1].classList.add("wyswietlanie");

    const lowResSrc = slides[slideNo - 1].children[0].src;
    dialog.children[0].src = lowResSrc;

    const highRes = new Image();
    highRes.src = lowResSrc.replace(".webp", "2.webp");
    highRes.onload = () => {
        dialog.children[0].src = highRes.src;
    };

    const row = document.getElementById("row");
    const columns = row.querySelectorAll(".column.removable");
    const sidebarColumn = columns[slideNo - 1];


    if (dialog.children[0]) {
        if (dialog.children[0]) {
            dialog.children[0].style.transform = "translate(-50%, -50%) scale(1)";
            dialog.children[0].dialogZoom = 1;
            dialog.children[0].panX = 0;
            dialog.children[0].panY = 0;
        }
    }
    if (sidebarColumn && arrow) {
        arrow.style.display = "block";

        const rowRect = row.getBoundingClientRect();
        const colRect = sidebarColumn.getBoundingClientRect();

        const center = (colRect.top + colRect.height / 2) - rowRect.top;

        arrow.style.top = `${center - arrow.offsetHeight / 2}px`;
    }
}
function dialClose() {
    arrow.style.display = "none";
    dialog.close();
    dialog.style.display = "none"
    dialogZoom = 1;
    panX = 0;
    panY = 0;
    updateDialogImgTransform();
}

function dialCloseContact() {
    const dialogContact = document.getElementById("contactDialog");
    dialogContact.close();
    dialogContact.style.display = "none";
}

function dialCloseGallery() {
    const dialogGallery = document.getElementById("masterGalleryDialog");
    const naviHolder = document.getElementById("naviHoldersMaster");

    dialogGallery.close();
    dialogGallery.style.display = "none";
    naviHolder.style.display = "none";
    const galleryGrid = dialogGallery.querySelector("#masterGalleryGrid");
    if (galleryGrid) {
        galleryGrid.innerHTML = "";
    }
}

function dialCloseGalleryImg() {
    const dialogGalleryImg = document.getElementById("galleryImageDialog");

    dialogGalleryImg.close();
    dialogGalleryImg.style.display = "none";

    const img = dialogGalleryImg.querySelector("#galleryImageDialogImg");
    if (img) {
        img.src = "";
    }
    dialogZoom = 1;
    panX = 0;
    panY = 0;
    updateDialogImgTransform();
}