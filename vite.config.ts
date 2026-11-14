import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// The app is published at https://<username>.github.io/liferpg/, so every
// address inside the app must start with /liferpg/. If the GitHub repo is ever
// renamed, change this one line to match.
const BASE = '/liferpg/'

// https://vite.dev/config/
export default defineConfig({
  base: BASE,
  plugins: [
    react(),

    // Makes the app installable and able to work offline.
    VitePWA({
      // When a new version is published, phones pick it up by themselves the
      // next time the app is opened.
      registerType: 'autoUpdate',

      // Extra files to keep on the phone for offline use.
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],

      // The "manifest": what the phone shows when the app is installed.
      manifest: {
        name: 'LifeRPG',
        short_name: 'LifeRPG',
        description: 'A cozy life game: level up five realms by logging real actions.',
        lang: 'en',
        start_url: BASE,
        scope: BASE,
        display: 'standalone', // open like an app, without the browser bars
        orientation: 'portrait',
        background_color: '#f4ecdb',
        theme_color: '#f4ecdb',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          // "maskable" lets Android crop the icon into its own shape.
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
