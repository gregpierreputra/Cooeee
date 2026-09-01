import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt', never 'autoUpdate'. A new shell waits for the user to choose it.
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webmanifest,woff2}'],
        // ping.txt MUST stay out, or the connectivity probe answers from cache
        // and reports "online" with the radios off.
        globIgnores: ['**/ping.txt'],
        navigateFallback: '/index.html',
        runtimeCaching: [], // durable data lives in IndexedDB by design
      },
      manifest: {
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
