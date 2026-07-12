import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: '.vite/build',
    emptyOutDir: false,
    rollupOptions: {
      external: [
        'electron',
        'node-pty',
        '@mysten/walrus',
        '@mysten/walrus-wasm',
      ],
    }
  }
})