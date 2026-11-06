import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const at = (...parts: string[]) => path.resolve(import.meta.dirname, ...parts)

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: { main: at('src/main/main.ts') },
        output: { format: 'es', entryFileNames: '[name].js' },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    build: {
      rollupOptions: {
        input: { preload: at('src/preload/preload.cts') },
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: at('src/renderer'),
    build: {
      rollupOptions: {
        input: {
          focus: at('src/renderer/focus.html'),
          activity: at('src/renderer/activity.html'),
          showcase: at('src/renderer/showcase.html'),
        },
      },
    },
    plugins: [react()],
  },
})
