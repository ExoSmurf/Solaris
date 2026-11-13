export const camera = {
    fov: {
        default: 45,
        max: 45,
        min: 10,
        focusLimit: 20,
    },
    position: {
        start: { x: 20, y: 20, z: 20 },
        min: 5,
        max: 40,
    },
    orbit: {
        minDistance: 5,
        maxDistance: 40,
        rotateSpeed: 0.1,
        autoRotateSpeed: 0.5,
    },
    zoomStep: 0.5,
    fly: {
        speed: 0.0005,
        barSpeed: 0.009,
    },
};

export const light = {
    color: 0xfffed1,
    ambientIntensity: 0.1,
    offsetFromCenter: 2,
    point: {
        intensity: 1,
        distance: 30,
        shadow: {
            mapSize: 100,
            bias: -0.01,
        },
    },
};

export const render = {
    exposure: 1.5,
    maxPixelRatio: 1.5,
    bloom: {
        strength: 1,
        radius: 1,
        threshold: 0.2,
    },
};

export const paths = {
    images: '/textures/images/',
    previews: '/textures/images/previews/',
    defaultPreview: 'default',
};
