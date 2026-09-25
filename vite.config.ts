import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    preact(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Cambridge Sustainable Food App',
        short_name: 'CSF',
        description: 'Food Flow Log — records every weigh-in and weigh-out at the moment it happens.',
        theme_color: '#8A4097',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // App shell only: cache-first, so the app opens with no connection.
        //
        // API responses are deliberately NOT cached by the service worker.
        // On a shared tablet a cached /me would bring the previous
        // volunteer back after sign-out. The data the forms need offline
        // (locations, categories, tray types, the signed-in user) is kept
        // by the app itself and cleared on sign-out -- see
        // src/store/referenceData.ts and src/store/session.ts.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallbackDenylist: [/^\/api\//]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  test: {
    environment: 'jsdom',
    globals: true
  }
})