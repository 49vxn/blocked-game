import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

/**
 * Static build for GitHub Pages: no game server, so the menu's online doors are
 * dead and every match runs in the browser against bots (`?offline=1`).
 * `base: './'` keeps asset URLs working from a /repo/ subpath.
 */
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig({
  base: './',
  define: { __SITES__: false, __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { outDir: 'dist-pages', chunkSizeWarningLimit: 1600, target: 'es2022' },
})
