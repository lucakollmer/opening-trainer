import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Opening Trainer',
        short_name: 'Openings',
        description: 'Offline-first chess opening training foundation',
        theme_color: '#263238',
        background_color: '#f5f7f8',
        display: 'standalone',
        start_url: '/',
        scope: '/',
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    testTimeout: 10_000,
    coverage: {
      enabled: false,
    },
  },
});
