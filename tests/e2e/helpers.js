export const SEEDED_RANDOM = () => {
    let seed = 1;
    Math.random = () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

export async function openApp(page) {
    await page.addInitScript(SEEDED_RANDOM);
    await page.goto('/?test');
    await page.waitForFunction(
        () => window.__solar && window.__solar.loaded && document.querySelectorAll('.planetBar-btn').length > 0,
    );
    await waitForIdle(page);
}

export async function waitForIdle(page) {
    await page.waitForFunction(
        () => document.querySelectorAll('.planetBar-btn.disabled').length === 0 && window.__solar.transitionComplete,
        null,
        { timeout: 60_000 },
    );
}

export async function waitForWarpDone(page) {
    await page.waitForFunction(() => window.__solar.warping === false, null, { timeout: 60_000 });
}

export async function waitForOverlayGone(page) {
    await page.waitForFunction(() => document.getElementById('loading').style.zIndex === '-10', null, { timeout: 60_000 });
}

export function barNames(page) {
    return page.locator('.planetBar-btn .planetBar-name').allTextContents();
}

export function barButton(page, name) {
    return page.locator('.planetBar-btn', { has: page.locator('.planetBar-name', { hasText: new RegExp(`^${name}$`) }) });
}
