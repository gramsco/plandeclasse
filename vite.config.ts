import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'))

export default defineConfig({
  base: './', // chemins relatifs : fonctionne sous https://<user>.github.io/<repo>/
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    VitePWA({
      // "prompt": a new version is only applied on request, never in the middle of the user's work.
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'Plan de classe',
        short_name: 'Plan de classe',
        description: 'Plans de classe : élèves, salles, hypothèses. Fonctionne hors ligne, données sur cet appareil.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f6f7f9',
        theme_color: '#3b6fd4',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: { environment: 'node' },
})
