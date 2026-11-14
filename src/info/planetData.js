import { systems } from '../config/systems.js';
import { bodyInfo } from '../config/info.js';

/**
 * Dane wszystkich planet obu układów w jednej liście (najpierw Słońce, potem czarna dziura).
 * Indeks w tej liście to globalPlanetIndex() z app/state.js.
 */
export const planetsInfo = [...systems.sun.bodies, ...systems.blackhole.bodies].map((body) => {
    const info = bodyInfo[body.id];
    return {
        name: info.name,
        informacje: info.text,
        id: info.code,
        informacjeDiam: info.diameter,
        informacjeMass: info.mass,
        informacjeRess: info.resources,
        informacjeOrbitalPeriod: info.orbitalPeriod,
        informacjeTemperature: info.temperature,
        informacjeAxialTilt: info.axialTilt,
        images: info.images ?? [],
        preview: info.preview,
    };
});
