const GALACTIC = {
    a: 'ᔑ', b: 'ʖ', c: 'ᓵ', d: '↸', e: 'ᒷ', f: '⎓', g: '⊣', h: '⍑', i: '╎', j: '⋮', k: 'ꖌ', l: 'ꖎ', m: 'ᒲ',
    n: 'リ', o: '𝙹', p: '!¡', q: 'ᑑ', r: '∷', s: 'ᓭ', t: 'ℸ', u: '⚍', v: '⍊', w: '∴', x: '/', y: '||', z: '⨅',
};
const DIGIT_GLYPHS = ['⍑', 'ᓵ', 'ꖌ', '⊣', '∷', 'ᒲ', 'ᑑ', '⍊', '⨅', '↸'];
const ORDER_RANDOMNESS = 0.4;
const CHAR_CLASS = 'scramble-char';
const SCRAMBLED_CLASS = 'scrambled';
const FLOW_CLASS = 'scramble-flow';

/**
 * Zamienia jeden znak na jego odpowiednik w piśmie ze stołu do zaklinania (Standard Galactic Alphabet).
 * Litery i cyfry są zamieniane, spacje, interpunkcja i inne znaki zostają bez zmian.
 * @param {string} char - pojedynczy znak
 * @returns {string} znak (lub krótki ciąg) w piśmie galaktycznym
 */
export function toGalactic(char) {
    const lower = char.toLowerCase();
    if (GALACTIC[lower]) return GALACTIC[lower];
    if (char >= '0' && char <= '9') return DIGIT_GLYPHS[Number(char)];
    return char;
}

/**
 * Deterministyczna liczba z zakresu 0..1 dla danego numeru (ta sama wejściowa zawsze daje ten sam wynik).
 * @param {number} n - dowolna liczba całkowita
 * @returns {number} wartość 0..1
 */
function noise01(n) {
    const s = Math.sin(n * 78.233 + 1.7) * 43758.5453;
    return s - Math.floor(s);
}

/**
 * Kolejność odkrywania znaków: mniej więcej od lewej do prawej, z losowym rozrzutem.
 * @param {number} length - liczba znaków
 * @returns {number[]} permutacja indeksów 0..length-1
 */
export function revealOrder(length) {
    const indices = Array.from({ length }, (_, i) => i);
    const weight = (i) => (1 - ORDER_RANDOMNESS) * (i / Math.max(length, 1)) + ORDER_RANDOMNESS * noise01(i);
    return indices.sort((a, b) => weight(a) - weight(b));
}

/**
 * Ile znaków jest już odkrytych przy danym postępie.
 * @param {number} progress - postęp odkrywania 0..1 (przycinany)
 * @param {number} length - liczba znaków do odkrycia
 * @returns {number} liczba odkrytych znaków 0..length
 */
export function revealCount(progress, length) {
    const clamped = Math.min(Math.max(progress, 0), 1);
    return Math.floor(clamped * length);
}

/**
 * Zamienia węzeł tekstowy na ciąg spanów: każdy znak do zaszyfrowania dostaje własny span
 * z oryginalną literą (ona wyznacza układ) i znakiem galaktycznym w `data-glyph` (rysowanym nad nią przez CSS).
 * Spacje i interpunkcja zostają zwykłym tekstem, więc łamanie linii się nie zmienia.
 * @param {Text} node - węzeł tekstowy do podmiany
 * @returns {{wrapper: HTMLSpanElement, chars: HTMLSpanElement[]}} kontener wstawiony w miejsce węzła i spany znaków
 */
function wrapTextNode(node) {
    const document = node.ownerDocument;
    const wrapper = document.createElement('span');
    wrapper.className = 'scramble-run';
    const chars = [];
    let plain = '';

    const flushPlain = () => {
        if (!plain) return;
        wrapper.append(plain);
        plain = '';
    };

    for (const char of Array.from(node.data)) {
        const glyph = toGalactic(char);
        if (glyph === char) {
            plain += char;
            continue;
        }
        flushPlain();
        const span = document.createElement('span');
        span.className = `${CHAR_CLASS} ${SCRAMBLED_CLASS}`;
        span.dataset.glyph = glyph;
        span.textContent = char;
        wrapper.append(span);
        chars.push(span);
    }
    flushPlain();
    node.replaceWith(wrapper);
    return { wrapper, chars };
}

/**
 * Czy element układa dzieci jako osobne elementy flex/grid (wtedy każdy dodany span byłby osobnym elementem rzędu).
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isFlexOrGrid(element) {
    const display = element.ownerDocument.defaultView.getComputedStyle(element).display;
    return display.includes('flex') || display.includes('grid');
}

/**
 * Wkłada całą zawartość kontenera flex/grid do jednego blokowego spana. Odtwarza to anonimowy blok,
 * który przeglądarka sama tworzy wokół ciągu "tekst, <br>, tekst", więc <br> dalej łamie linie.
 * @param {HTMLElement} parent - kontener flex/grid z tekstem
 * @returns {HTMLSpanElement} wstawiony span (do późniejszego rozpakowania)
 */
function wrapFlowContent(parent) {
    const flow = parent.ownerDocument.createElement('span');
    flow.className = FLOW_CLASS;
    while (parent.firstChild) flow.append(parent.firstChild);
    parent.append(flow);
    return flow;
}

/**
 * Tworzy animację "odszyfrowania" tekstu w podanych elementach bez przesuwania układu strony:
 * oryginalne litery zostają na miejscu (niewidoczne), a znaki galaktyczne są rysowane nad nimi.
 * Nowe wywołanie przerywa poprzednie i od razu przywraca jego tekst.
 * @param {{now?: function(): number, requestFrame?: function(function): number, cancelFrame?: function(number): void}} [clock]
 *   zegar i planowanie klatek; domyślnie performance.now i requestAnimationFrame
 * @returns {{reveal: function(HTMLElement[], number): void, cancel: function(): void}}
 */
export function createScrambler({
    now = () => performance.now(),
    requestFrame = (callback) => requestAnimationFrame(callback),
    cancelFrame = (id) => cancelAnimationFrame(id),
} = {}) {
    let running = null;

    function finish() {
        if (!running) return;
        cancelFrame(running.frameId);
        for (const { wrapper, node } of running.runs) {
            if (wrapper.isConnected) wrapper.replaceWith(node);
        }
        for (const flow of running.flows) {
            if (flow.isConnected) flow.replaceWith(...flow.childNodes);
        }
        running = null;
    }

    function collectTextNodes(elements) {
        const nodes = [];
        for (const element of elements) {
            const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                if (node.data.trim()) nodes.push(node);
            }
        }
        return nodes;
    }

    return {
        /**
         * Pokazuje tekst elementów zaszyfrowany i odszyfrowuje go w czasie `durationSeconds`.
         * @param {HTMLElement[]} elements - elementy z tekstem (np. panel informacji o planecie)
         * @param {number} durationSeconds - czas odszyfrowania w sekundach
         * @returns {void}
         */
        reveal(elements, durationSeconds) {
            finish();
            const nodes = collectTextNodes(elements);
            const flexParents = [...new Set(nodes.map((node) => node.parentElement))].filter(isFlexOrGrid);
            const flows = flexParents.map(wrapFlowContent);
            const runs = nodes.map((node) => ({ node, ...wrapTextNode(node) }));
            const chars = runs.flatMap((run) => run.chars);
            if (chars.length === 0) {
                running = { runs, flows, frameId: null };
                finish();
                return;
            }
            const order = revealOrder(chars.length);
            const start = now();
            let revealed = 0;
            running = { runs, flows, frameId: null };

            const tick = () => {
                const progress = durationSeconds > 0 ? (now() - start) / (durationSeconds * 1000) : 1;
                if (progress >= 1) {
                    finish();
                    return;
                }
                const target = revealCount(progress, chars.length);
                for (; revealed < target; revealed++) chars[order[revealed]].classList.remove(SCRAMBLED_CLASS);
                running.frameId = requestFrame(tick);
            };
            tick();
        },

        /**
         * Przerywa animację i od razu przywraca oryginalny tekst.
         * @returns {void}
         */
        cancel: finish,
    };
}
