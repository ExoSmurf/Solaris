import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
    base: './',
    esbuild: command === 'build'
        ? { pure: ['console.log', 'console.info', 'console.debug'], legalComments: 'none' }
        : {},
    css: {
        transformer: 'lightningcss',
        lightningcss: {
            targets: { chrome: 111 << 16, firefox: 113 << 16, safari: (16 << 16) | (4 << 8) },
        },
    },
    build: {
        target: 'es2022',
        cssMinify: 'lightningcss',
        rollupOptions: {
            input: {
                main: fileURLToPath(new URL('./index.html', import.meta.url)),
                mobile: fileURLToPath(new URL('./mobile.html', import.meta.url)),
            },
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules/three')) return 'vendor-three';
                },
            },
        },
    },
}));
