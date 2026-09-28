import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base switches to the repo sub-path when deploying to GitHub Pages
// (see doc/13 §12); local dev and other hosts keep the root path.
const base = process.env.GITHUB_PAGES === 'true' ? '/EmberCultivation/' : '/'

export default defineConfig({
  base,
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
