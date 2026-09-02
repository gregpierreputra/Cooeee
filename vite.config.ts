import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import vercel from './vercel.json';

// The production security headers, so `vite preview` (and therefore e2e) runs
// under the same policy Vercel serves.
const headers = Object.fromEntries(vercel.headers[0].headers.map(({ key, value }) => [key, value]));

export default defineConfig({
  preview: { headers },
  // Development only: the API server (npm run server) answers /api on 8787. In
  // production vercel.json rewrites the same path, so the browser sees one origin.
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  plugins: [
    react(),
    VitePWA({
      // 'prompt', never 'autoUpdate'. A new shell waits for the user to choose it.
      registerType: 'prompt',
      workbox: {
        // The data snapshots under public/data are precached with the shell on
        // purpose: they version with the build, so an offline start has them.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webmanifest,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//], // an API path is never the app shell
        runtimeCaching: [], // user data lives in IndexedDB; nothing else is cached at runtime
      },
      manifest: {
        id: '/',
        name: 'Cooeee',
        short_name: 'Cooeee',
        description:
          'Official bushfire information for a place, assembled while you have a connection and usable when you do not.',
        lang: 'en-AU',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#070C11',
        background_color: '#070C11',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
