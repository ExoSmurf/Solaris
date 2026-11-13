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
            mapSize: 1024,
            bias: -0.002,
            normalBias: 0.02,
            radius: 3,
            near: 0.5,
        },
    },
};

export const render = {
    exposure: 1.5,
    maxPixelRatio: 1.5,
    bloom: {
        strength: 1,
        radius: 1,
        threshold: 0.4,
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
        searchClosing: 0.35,
        searchJitterRate: 6,
    },
    hover: {
        padding: 1.6,
        minSize: 40,
        startScale: 1,
        clickTolerance: 6,
        minHitRadius: 28,
        hitScale: 1.6,
        hintOffset: 18,
        scrambleDuration: 0.35,
        scrambleDelay: 0.25,
    },
    delta: {
        smoothing: 0.85,
    },
    scramble: {
        duration: 0.8,
        delay: 0.15,
    },
    fit: {
        minSize: 8,
        padding: 6,
    },
};

export const loading = {
    allLoadedHold: 0.8,
};

export const warp = {
    distance: 60,
    accelerateDuration: 1.2,
    decelerateDuration: 1.8,
    minCruiseDuration: 0.6,
    stars: {
        count: 500,
        nearDepth: 6,
        farDepth: 70,
        screenMargin: 1.2,
        streakDuration: 0.05,
        hue: 0.6,
        saturation: 0.2,
    },
};

export const paths = {
    cardTextures: ['/textures/name.webp', '/textures/diam.webp', '/textures/ress.webp', '/textures/bulk.webp'],
    images: '/textures/images/',
    previews: '/textures/images/previews/',
    defaultPreview: 'default',
};
