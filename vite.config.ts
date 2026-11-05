import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { devDataApi } from './vite-plugins/dev-data-api.ts'

export default defineConfig({
  base: './',
  plugins: [vue(), tailwindcss(), devDataApi()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@seed': fileURLToPath(new URL('./data/seed', import.meta.url)),
      '@tests': fileURLToPath(new URL('./tests', import.meta.url)),
    },
  },
})
