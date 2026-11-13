export const camera = {
    clip: {
        near: 1,
        far: 10000,
    },
    fov: {
        default: 45,
        lock: 20,
        min: 10,
    },
    position: {
        start: { x: 20, y: 20, z: 20 },
    },
    orbit: {
        dampingFactor: 1,
        minDistance: 5,
        maxDistance: 40,
        rotateSpeed: 0.1,
        autoRotateSpeed: 0.5,
    },
    fly: {
        duration: 1.4,
        barDuration: 1,
    },
    focus: {
        lockDuration: 0.55,
        holdDuration: 0.6,
        zoomDuration: 0.3,
        outDuration: 1,
        wobble: {
            amplitude: 0.04,
            frequency: 14,
        },
    },
};

export const light = {
    color: 0xfffed1,
    ambientIntensity: 0.1,
    offsetFromCenter: 2,
    point: {
        power: 120,
        distance: 100,
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

export const motion = {
    fps: 60,
    maxFrames: 6,
};

export const hud = {
    brackets: {
        padding: 1.15,
        minSize: 28,
        startScale: 1,
    },
    delta: {
        smoothing: 0.85,
    },
    scramble: {
        duration: 0.8,
    },
};

export const paths = {
    images: '/textures/images/',
    previews: '/textures/images/previews/',
    defaultPreview: 'default',
};
