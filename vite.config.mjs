import { defineConfig } from 'vite'
import uniModule from '@dcloudio/vite-plugin-uni'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))
// The official plugin is published as CommonJS with a default export.
const uni = typeof uniModule === 'function' ? uniModule : uniModule.default

export default defineConfig(({ command, isPreview }) => ({
  root: projectRoot,
  plugins: isPreview ? [] : [uni()],
  define: {
    __DEV__: JSON.stringify(command === 'serve' && !isPreview),
  },
  cacheDir: path.join(projectRoot, 'unpackage/.cache/vite', process.env.UNI_PLATFORM || 'h5'),
  clearScreen: false,
  build: {
    outDir: process.env.UNI_OUTPUT_DIR || path.join(projectRoot, 'unpackage/dist/build/h5'),
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    open: false,
    cors: false,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    open: false,
    cors: false,
  },
}))
