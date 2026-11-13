export const systems = {
    sun: {
        name: 'Solar System',
        bodies: [
            { id: 'sun', model: '/models/sun/sun.gltf', position: { x: 0, y: 0, z: 0 }, spin: 0.01, shadow: 'cast' },
            { id: 'venus', model: '/models/Venus/Venus.gltf', position: { x: 3 }, spin: 0.01, orbit: { speed: 0.00035, position: { x: 0, y: 0 } } },
            { id: 'earth', model: '/models/earth/earth.gltf', position: { x: -9 }, spin: 0.01, orbit: { speed: 0.005, position: { x: 0 } } },
            { id: 'moon', model: '/models/moon/moon.gltf', parent: 'earth', position: { x: 1 }, spin: 0.02, orbit: { speed: -0.001, position: { x: 0, y: 0 } }, showInBar: false },
            { id: 'saturn', model: '/models/saturn/saturn.gltf', position: { x: 17 }, spin: 0.01, orbit: { speed: 0.0008, position: { x: 0, y: 0 } } },
            { id: 'pluto', model: '/models/pluto/pluto.gltf', position: { x: -24 }, spin: 0.01, orbit: { speed: 0.0005, position: { x: 0, y: 0 } } },
        ],
    },
    blackhole: {
        name: 'Black Hole System',
        bodies: [
            { id: 'blackhole', model: '/models/blackhole/blackhole.gltf', position: { x: 0, y: 0, z: 0 }, spin: 0.001, scale: 4, shadow: 'cast' },
            { id: 'pyrox', model: '/models/pyrox/pyrox.gltf', position: { z: -5 }, spin: 0.005, orbit: { speed: -0.001, position: { x: 0, y: 0 } } },
            { id: 'pyroxBlob1', model: '/models/pyrox/pyroxBlob.gltf', parent: 'pyrox', position: { x: 0.5 }, spin: 0.005, orbit: { speed: 0.001, position: { x: 0, y: 0 } }, showInBar: false },
            { id: 'pyroxBlob2', model: '/models/pyrox/pyroxBlob.gltf', parent: 'pyrox', position: { x: -0.6, z: -0.7 }, spin: 0.005, orbit: { speed: 0.001, position: { x: 0, y: 0 } }, showInBar: false },
            { id: 'pyroxBlob3', model: '/models/pyrox/pyroxBlob.gltf', parent: 'pyrox', position: { x: 0.6, z: -0.7 }, spin: 0.002, orbit: { speed: -0.0001, position: { x: 0, y: 0 } }, showInBar: false },
            { id: 'pyroxBlob4', model: '/models/pyrox/pyroxBlob.gltf', parent: 'pyrox', position: { x: 0.4, z: 0.8 }, spin: 0.001, orbit: { speed: 0.003, position: { x: 0, y: 0 } }, showInBar: false },
            { id: 'mirethul', model: '/models/Mirethul/Mirethul.gltf', position: { x: -8 }, spin: 0.003, orbit: { speed: 0.0001, position: { x: 0, y: 0 } } },
            { id: 'aerolith', model: '/models/Aerolith/aerolith.gltf', position: { x: 11 }, spin: 0.005, scale: 2, orbit: { speed: 0.0003, position: { x: 0, y: 0 } } },
            { id: 'skarnis', model: '/models/skarnis/skarnis.gltf', position: { z: 15 }, spin: 0, scale: 4, orbit: { speed: 0.001, position: { x: 0, y: 0 } } },
            { id: 'neptune', model: '/models/neptune/neptune.gltf', position: { y: 0, z: 19 }, spin: 0.007, orbit: { speed: 0.0002 } },
        ],
    },
};
