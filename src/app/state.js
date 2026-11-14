/**
 * Stan współdzielony między modułami: który układ jest pokazany i co jest załadowane.
 */
export const state = {
    currentSolar: 1,
    planetNo: 0,
    lowQuality: false,
    activeSystem: null,
    isSwitchingSolar: false,
    renderLoopRunning: false,
    bodiesBySolar: { 1: [], 2: [] },
};

/**
 * Ciała aktualnie pokazanego układu.
 * @returns {object[]}
 */
export function activeBodies() {
    return state.bodiesBySolar[state.currentSolar];
}

/**
 * Czy pokazany układ jest gotowy (załadowany i zgodny z wybranym numerem).
 * @returns {boolean}
 */
export function systemReady() {
    return state.activeSystem !== null && state.activeSystem.solarNo === state.currentSolar;
}

/**
 * Indeks planety we wspólnej liście planetsInfo (oba układy po kolei).
 * @param {number} index - indeks ciała w aktywnym układzie
 * @returns {number}
 */
export function globalPlanetIndex(index) {
    return state.currentSolar == 1 ? index : index + state.bodiesBySolar[1].length;
}
