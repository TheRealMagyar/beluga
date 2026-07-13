import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

function resolveIkaSdkRoot(): string {
  const vendorSdk = path.resolve(process.cwd(), 'vendor/@ika.xyz/sdk/dist/esm');
  if (fs.existsSync(vendorSdk)) return vendorSdk;

  const installedSdk = path.resolve(
    process.cwd(),
    'node_modules/@ika.xyz/sdk/dist/esm',
  );
  if (fs.existsSync(installedSdk)) return installedSdk;

  return vendorSdk;
}

const ikaSdkRoot = resolveIkaSdkRoot();
const ikaWasmEntry = path.resolve(
  process.cwd(),
  'src/renderer/lib/ika-wasm-entry.ts',
);

export default defineConfig({
  resolve: {
    alias: {
      '@ika.xyz/sdk': ikaSdkRoot,
      '@ika.xyz/ika-wasm': ikaWasmEntry,
    },
  },
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    include: ['@ika.xyz/sdk'],
    exclude: ['@ika.xyz/ika-wasm'],
  },
  css: {
    postcss: {
      plugins: [
        require('@tailwindcss/postcss'),
      ],
    },
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
          warning.message.includes('use client')
        ) {
          return;
        }
        warn(warning);
      },
    },
  },
});