import { defineConfig } from '@playwright/test';

const PORT = 5173;

export default defineConfig({
    testDir: 'tests/e2e',
    testMatch: '**/*.spec.js',
    timeout: 120_000,
    expect: { timeout: 15_000 },
    workers: 1,
    fullyParallel: false,
    reporter: [['list']],
    use: {
        baseURL: `http://localhost:${PORT}`,
        viewport: { width: 1600, height: 900 },
        trace: 'retain-on-failure',
        launchOptions: {
            args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
        },
    },
    webServer: {
        command: `npx vite --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: true,
        timeout: 60_000,
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
    ],
});
