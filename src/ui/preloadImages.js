/**
 * Tworzy preloader zdjęć, który ładuje każdy adres tylko raz, żeby przeglądarka miała je w cache,
 * zanim zostaną pokazane.
 * @param {function(string): unknown} [load] - funkcja ładująca jeden adres; domyślnie tworzy `new Image()`
 * @returns {{preload: function(string[]): number}}
 */
export function createImagePreloader(load = defaultLoad) {
    const requested = new Set();

    return {
        /**
         * Zaczyna ładować zdjęcia, których jeszcze nie ładowano.
         * @param {string[]} urls - adresy zdjęć
         * @returns {number} ile nowych adresów zaczęto ładować
         */
        preload(urls) {
            let started = 0;
            for (const url of urls) {
                if (!url || requested.has(url)) continue;
                requested.add(url);
                load(url);
                started++;
            }
            return started;
        },
    };
}

/**
 * Domyślne ładowanie: tworzy obrazek poza stroną, co wystarczy, żeby przeglądarka go pobrała i zapisała w cache.
 * @param {string} url - adres zdjęcia
 * @returns {HTMLImageElement}
 */
function defaultLoad(url) {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    return image;
}

/**
 * Adresy zdjęć planety: wersja zwykła (.webp) i wysokiej rozdzielczości (2.webp), w tej kolejności.
 * @param {string[]} images - nazwy zdjęć z config/info.js
 * @param {string} basePath - katalog zdjęć (paths.images)
 * @returns {string[]}
 */
export function planetImageUrls(images, basePath) {
    return (images ?? []).flatMap((name) => [`${basePath}${name}.webp`, `${basePath}${name}2.webp`]);
}
