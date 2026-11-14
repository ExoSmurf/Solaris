import { describe, it, expect } from 'vitest';
import legacy from './fixtures/legacy-main.json';
import { systems } from '../../src/config/systems.js';
import { bodyInfo } from '../../src/config/info.js';

const SUN_IDS = ['sun', 'venus', 'earth', 'moon', 'saturn', 'pluto'];
const BLACKHOLE_IDS = ['blackhole', 'pyrox', 'pyroxBlob1', 'pyroxBlob2', 'pyroxBlob3', 'pyroxBlob4', 'mirethul', 'aerolith', 'skarnis', 'neptune'];
const INFO_IDS = [...SUN_IDS, ...BLACKHOLE_IDS];

const LEGACY_PLANETA = {
    sun: 'sun', venus: 'Venus', earth: 'earth', moon: 'moon', saturn: 'saturn', pluto: 'pluto',
    blackhole: 'BlackHole', pyrox: 'pyrox', pyroxBlob1: 'pyroxBlob', pyroxBlob2: 'pyroxBlob2',
    pyroxBlob3: 'pyroxBlob3', pyroxBlob4: 'pyroxBlob4', mirethul: 'mirethul', aerolith: 'aerolith',
    skarnis: 'skarnis', neptune: 'neptune',
};

const LEGACY_SCALE = { blackhole: 4, aerolith: 2, skarnis: 4 };
const CAST_ONLY_SHADOW = new Set(['sun', 'blackhole']);
const LEGACY_PREVIEW_KEYS = ['sun', 'venus', 'earth', 'saturn', 'pluto', 'blackhole', 'pyrox', 'mirethul', 'aerolith', 'skarnis', 'neptune'];

const INFO_FIELD_MAP = {
    name: 'name',
    informacje: 'text',
    id: 'code',
    informacjeDiam: 'diameter',
    informacjeMass: 'mass',
    informacjeRess: 'resources',
    informacjeOrbitalPeriod: 'orbitalPeriod',
    informacjeTemperature: 'temperature',
    informacjeAxialTilt: 'axialTilt',
    images: 'images',
};

const axes = ['x', 'y', 'z'];
const orNull = (v) => (v === undefined ? null : v);

describe('migration: body counts and order', () => {
    it('sun system bodies match the legacy planetySun order', () => {
        expect(systems.sun.bodies.map((b) => b.id)).toEqual(SUN_IDS);
        expect(legacy.planetySun.map((e) => e.planeta)).toEqual(SUN_IDS.map((id) => LEGACY_PLANETA[id]));
    });

    it('black hole bodies match the legacy planetyBlackHole order', () => {
        expect(systems.blackhole.bodies.map((b) => b.id)).toEqual(BLACKHOLE_IDS);
        expect(legacy.planetyBlackHole.map((e) => e.planeta)).toEqual(BLACKHOLE_IDS.map((id) => LEGACY_PLANETA[id]));
    });

    it('info entries match legacy planetsInfo order (16 entries, Sun first, Neptune last)', () => {
        expect(legacy.planetsInfo).toHaveLength(16);
        expect(INFO_IDS.map((id) => bodyInfo[id].name)).toEqual(legacy.planetsInfo.map((e) => e.name));
    });
});

describe('migration: system bodies match legacy blok / blokObj', () => {
    const pairs = [
        ['sun', legacy.planetySun, systems.sun.bodies, SUN_IDS],
        ['blackhole', legacy.planetyBlackHole, systems.blackhole.bodies, BLACKHOLE_IDS],
    ];

    for (const [system, legacyList, bodies, ids] of pairs) {
        describe(system, () => {
            ids.forEach((id, i) => {
                const leg = legacyList[i];
                const body = bodies[i];

                it(`${id}: model path and legacy name`, () => {
                    expect(body.id).toBe(id);
                    expect(body.model).toBe(leg.src);
                    expect(LEGACY_PLANETA[id]).toBe(leg.planeta);
                });

                it(`${id}: mesh position and spin`, () => {
                    for (const axis of axes) {
                        expect(orNull(body.position?.[axis]), `position.${axis}`).toBe(leg.blok[axis] ?? null);
                    }
                    expect(body.spin).toBe(leg.blok.rotation);
                });

                it(`${id}: pivot (orbit) presence, speed and position`, () => {
                    if (leg.blokObj.rotation === null) {
                        expect(body.orbit).toBeUndefined();
                        return;
                    }
                    expect(body.orbit.speed).toBe(leg.blokObj.rotation);
                    for (const axis of axes) {
                        expect(orNull(body.orbit.position?.[axis]), `orbit.position.${axis}`).toBe(leg.blokObj[axis] ?? null);
                    }
                });

                it(`${id}: moon flag, scale and shadow`, () => {
                    expect(leg.isMoon).toBe(body.showInBar === false);
                    expect(body.scale).toBe(LEGACY_SCALE[id]);
                    expect(body.shadow).toBe(CAST_ONLY_SHADOW.has(id) ? 'cast' : undefined);
                });
            });
        });
    }

    it('parent links match the legacy scene graph (moon on earth, pyrox blobs on pyrox)', () => {
        expect(systems.sun.bodies.find((b) => b.id === 'moon').parent).toBe('earth');
        for (const id of ['pyroxBlob1', 'pyroxBlob2', 'pyroxBlob3', 'pyroxBlob4']) {
            expect(systems.blackhole.bodies.find((b) => b.id === id).parent).toBe('pyrox');
        }
    });
});

describe('migration: info matches legacy planetsInfo', () => {
    INFO_IDS.forEach((id, i) => {
        it(`${id}: all legacy fields carried over`, () => {
            const leg = legacy.planetsInfo[i];
            const info = bodyInfo[id];
            for (const [from, to] of Object.entries(INFO_FIELD_MAP)) {
                const expected = typeof leg[from] === 'string' ? leg[from].replace(/\u2019/g, "'") : leg[from];
                expect(info[to], `${id}.${to}`).toEqual(expected);
            }
        });

        it(`${id}: no extra fields beyond legacy ones and preview`, () => {
            const allowed = new Set([...Object.values(INFO_FIELD_MAP), 'preview']);
            for (const key of Object.keys(bodyInfo[id])) {
                expect(allowed.has(key), `${id} unexpected field ${key}`).toBe(true);
            }
        });

        it(`${id}: preview matches legacy lookup by lowercased name`, () => {
            const key = legacy.planetsInfo[i].name.toLowerCase();
            if (LEGACY_PREVIEW_KEYS.includes(key)) {
                expect(bodyInfo[id].preview).toBe(key);
            } else {
                expect(bodyInfo[id].preview).toBeUndefined();
            }
        });
    });
});
