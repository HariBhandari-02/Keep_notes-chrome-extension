import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the project at /<repo-name>/. The extension's SITE_URL
// (src/background/siteUrls.ts) must stay in sync with this base.
const BASE = '/Keep_notes-chrome-extension/'

const page = (name: string) => resolve(import.meta.dirname, name)

export default defineConfig({
  base: BASE,
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: page('index.html'),
        welcome: page('welcome.html'),
        uninstall: page('uninstall.html'),
        privacy: page('privacy.html'),
      },
    },
  },
})
