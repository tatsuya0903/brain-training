import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import vueDevTools from 'vite-plugin-vue-devtools'
import vuetify from 'vite-plugin-vuetify'

// https://vite.dev/config/
export default defineConfig({
  base: '/brain-training/',
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    vueDevTools(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'pwa.svg'],
      manifest: {
        name: 'Brain Training',
        short_name: 'Brain Training',
        description: '暗算の回答タイムを計測・分析する脳トレアプリ',
        lang: 'ja',
        theme_color: '#6750a4',
        background_color: '#fdf8ff',
        display: 'standalone',
        start_url: '/brain-training/',
        scope: '/brain-training/',
        icons: [
          {
            src: 'pwa.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
