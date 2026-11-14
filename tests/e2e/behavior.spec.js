import { test, expect } from '@playwright/test';
import { openApp, waitForIdle, waitForWarpDone, barNames, barButton } from './helpers.js';

const SUN_BAR = ['Sun', 'Venus', 'Earth', 'Saturn', 'Pluto'];
const BLACKHOLE_BAR = ['BlackHole', 'Pyrox', 'Mirethul', 'Aerolith', 'Skarnis', 'Neptune'];

test.beforeEach(async ({ page }) => {
    await openApp(page);
});

test('app loads into the sun system with the expected planet bar', async ({ page }) => {
    expect(await page.evaluate(() => window.__solar.system)).toBe(1);
    expect(await barNames(page)).toEqual(SUN_BAR);
});

test('Solar View button is enabled after loading and Planet Focus is off', async ({ page }) => {
    await expect(page.locator('#solar')).toBeEnabled();
    await expect(page.locator('#switch')).not.toBeChecked();
});

test('clicking a planet in the bar selects it and fills the info panel', async ({ page }) => {
    await barButton(page, 'Venus').click();
    await waitForIdle(page);

    expect(await page.evaluate(() => window.__solar.planet)).toBe(1);
    await expect(page.locator('#name')).toHaveText('Venus');
    await expect(page.locator('#id')).toHaveText('VE-57');
    await expect(page.locator('#informacjeDiam')).toHaveText('8,507 Blocks');
});

test('Earth info panel shows its data', async ({ page }) => {
    await barButton(page, 'Earth').click();
    await waitForIdle(page);

    await expect(page.locator('#name')).toHaveText('Earth');
    await expect(page.locator('#id')).toHaveText('ER-23');
    await expect(page.locator('#informacjeOrbitalPeriod')).toContainText('365.25 days');
});

test('Next Solar System switches to the black hole bar and back', async ({ page }) => {
    await page.locator('#nextSolar').click();
    await expect.poll(() => page.evaluate(() => window.__solar.system), { timeout: 60_000 }).toBe(2);
    await page.waitForFunction(() => document.querySelectorAll('.planetBar-btn').length > 0);
    await waitForIdle(page);
    expect(await barNames(page)).toEqual(BLACKHOLE_BAR);

    await waitForWarpDone(page);
    await waitForIdle(page);
    await page.locator('#nextSolar').click();
    await expect.poll(() => page.evaluate(() => window.__solar.system), { timeout: 60_000 }).toBe(1);
    await page.waitForFunction(() => document.querySelectorAll('.planetBar-btn').length > 0);
    await waitForIdle(page);
    expect(await barNames(page)).toEqual(SUN_BAR);
});

test('planet bar is locked while the camera is moving', async ({ page }) => {
    await barButton(page, 'Pluto').click();
    expect(await page.locator('.planetBar-btn.disabled').count()).toBeGreaterThan(0);
    await waitForIdle(page);
    expect(await page.locator('.planetBar-btn.disabled').count()).toBe(0);
});

test('Planet Focus switch zooms the camera in (fov drops below 45)', async ({ page }) => {
    await barButton(page, 'Venus').click();
    await waitForIdle(page);
    await page.locator('label[for="switch"]').click();
    await expect.poll(() => page.evaluate(() => window.__solar.fov), { timeout: 30_000 }).toBeLessThan(45);
});

test('Next walks the planets in order and skips the moon', async ({ page }) => {
    const visited = [];
    for (let i = 0; i < 3; i++) {
        await page.locator('#next').click();
        await waitForIdle(page);
        visited.push(await page.evaluate(() => window.__solar.planet));
    }
    expect(visited).toEqual([1, 2, 4]);
    expect(await page.evaluate(() => window.__solar.cameraMode)).toBe('follow');
});

test('focus shows the info panel and unfocus hides it again', async ({ page }) => {
    await barButton(page, 'Earth').click();
    await waitForIdle(page);
    await expect(page.locator('#inspekcja')).toBeHidden();

    await page.locator('label[for="switch"]').click();
    await waitForIdle(page);
    expect(await page.evaluate(() => window.__solar.cameraMode)).toBe('focused');
    await expect(page.locator('#inspekcja')).toBeVisible();
    await expect(page.locator('#switch')).toBeChecked();

    await page.locator('label[for="switch"]').click();
    await waitForIdle(page);
    expect(await page.evaluate(() => window.__solar.cameraMode)).toBe('follow');
    await expect(page.locator('#inspekcja')).toBeHidden();
    expect(await page.evaluate(() => window.__solar.fov)).toBeCloseTo(45);
});

test('camera status: searching -> locking in -> zooming -> fades out, nothing while zooming out', async ({ page }) => {
    await page.evaluate(() => {
        const element = document.getElementById('cameraStatus');
        window.__statusLog = [];
        const record = () => window.__statusLog.push(`${element.dataset.state}|${element.textContent}`);
        new MutationObserver(record).observe(element, { attributes: true, childList: true, characterData: true, subtree: true });
    });

    await barButton(page, 'Earth').click();
    await waitForIdle(page);
    await page.locator('label[for="switch"]').click();
    await waitForIdle(page);
    await expect(page.locator('#cameraStatus')).toHaveAttribute('data-state', 'fading');

    const log = await page.evaluate(() => window.__statusLog);
    const firstIndex = (pattern) => log.findIndex((entry) => pattern.test(entry));
    const searching = firstIndex(/^visible\|searching\.\.\.$/);
    const locking = firstIndex(/^visible\|locking in\.\.\.$/);
    const zooming = firstIndex(/^visible\|zooming\.\.\.$/);
    const fading = firstIndex(/^fading\|zooming\.\.\.$/);
    expect(searching, JSON.stringify(log)).toBeGreaterThanOrEqual(0);
    expect(locking, JSON.stringify(log)).toBeGreaterThan(searching);
    expect(zooming, JSON.stringify(log)).toBeGreaterThan(locking);
    expect(fading, JSON.stringify(log)).toBeGreaterThan(zooming);

    await page.locator('label[for="switch"]').click();
    await expect.poll(() => page.evaluate(() => window.__solar.cameraMode)).toBe('focusOut');
    await expect(page.locator('#cameraStatus')).toHaveAttribute('data-state', 'hidden');
    await waitForIdle(page);
    await expect(page.locator('#cameraStatus')).toHaveAttribute('data-state', 'hidden');
});

test('lock brackets close in on the planet, lock, then fade while zooming', async ({ page }) => {
    await barButton(page, 'Earth').click();
    await waitForIdle(page);
    await page.evaluate(() => {
        const element = document.getElementById('lockBrackets');
        const label = element.querySelector('.bracket-label');
        window.__bracketLog = [];
        window.__bracketLabels = [];
        const record = () => window.__bracketLog.push({ state: element.dataset.state, size: parseFloat(element.style.width) || null });
        new MutationObserver(record).observe(element, { attributes: true, attributeFilter: ['data-state', 'style'] });
        new MutationObserver(() => window.__bracketLabels.push(label.textContent)).observe(label, { childList: true, characterData: true, subtree: true });
    });

    await page.locator('label[for="switch"]').click();
    await waitForIdle(page);

    const log = await page.evaluate(() => window.__bracketLog);
    const states = log.map((entry) => entry.state).filter((state, i, all) => state !== all[i - 1]);
    expect(states, JSON.stringify(states)).toEqual(['closing', 'locked', 'fading', 'hidden']);

    const closingSizes = log.filter((entry) => entry.state === 'closing' && entry.size !== null).map((entry) => entry.size);
    expect(closingSizes.length).toBeGreaterThan(1);
    expect(closingSizes[closingSizes.length - 1]).toBeLessThan(closingSizes[0]);

    const lockedSize = log.filter((entry) => entry.size !== null && entry.state === 'locked').pop()?.size
        ?? closingSizes[closingSizes.length - 1];
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(lockedSize).toBeLessThan(viewportHeight / 2);

    const labels = await page.evaluate(() => window.__bracketLabels);
    expect(labels.length).toBeGreaterThan(0);
    for (const text of labels) expect(text).toMatch(/^\[-?\d+\.\d, -?\d+\.\d, -?\d+\.\d\]$/);
    await expect(page.locator('#cameraStatus')).not.toContainText('[');
});

test('Next while focused zooms out, flies to the next planet and zooms in on it', async ({ page }) => {
    await barButton(page, 'Earth').click();
    await waitForIdle(page);
    await page.locator('label[for="switch"]').click();
    await waitForIdle(page);
    expect(await page.evaluate(() => window.__solar.cameraMode)).toBe('focused');

    await page.locator('#next').click();
    await expect.poll(() => page.evaluate(() => window.__solar.cameraMode), { timeout: 30_000 }).toBe('focused');
    expect(await page.evaluate(() => window.__solar.planet)).toBe(4);
    await expect(page.locator('#name')).toHaveText('Saturn');
    await expect(page.locator('#inspekcja')).toBeVisible();
    expect(await page.evaluate(() => window.__solar.fov)).toBeCloseTo(10);
});

test('Solar View flies back to the orbit around the sun and locks Planet Focus', async ({ page }) => {
    await barButton(page, 'Saturn').click();
    await waitForIdle(page);
    await page.locator('#solar').click();
    await waitForIdle(page);
    expect(await page.evaluate(() => window.__solar.cameraMode)).toBe('overview');
    expect(await page.evaluate(() => window.__solar.planet)).toBe(0);
    await expect(page.locator('#switch')).toBeDisabled();
});

test('Gallery shows every image from all planets', async ({ page }) => {
    await page.locator('#masterGallery').click();
    await expect(page.locator('#masterGalleryDialog')).toBeVisible();
    await expect(page.locator('#masterGalleryGrid img')).toHaveCount(16);
});

test('Escape closes the gallery', async ({ page }) => {
    await page.locator('#masterGallery').click();
    await expect(page.locator('#masterGalleryDialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#masterGalleryDialog')).not.toBeVisible();
});

test('Contact opens its dialog and Escape closes it', async ({ page }) => {
    await page.locator('#contact').click();
    await expect(page.locator('#contactDialog')).toBeVisible();
    await expect(page.locator('#contactDialog #avatar')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#contactDialog')).not.toBeVisible();
});

test('Low Quality toggle switches on and keeps the canvas', async ({ page }) => {
    await page.locator('label[for="switch2"]').click();
    await expect(page.locator('#switch2')).toBeChecked();
    await expect(page.locator('#container3D canvas')).toBeVisible();
});
