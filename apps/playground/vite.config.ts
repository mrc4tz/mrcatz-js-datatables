import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// Playground memakai source langsung (bukan dist) agar perubahan terlihat instan.
// `MRCATZ_DIST=1 bun run build` menguji hasil build paket seperti konsumen npm.
const useDist = process.env.MRCATZ_DIST === '1';
const src = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url));

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: useDist
      ? {}
      : {
          '@mrc4tz/datatable-core': src('core/src/index.ts'),
          '@mrc4tz/datatable-vue': src('vue/src/index.ts'),
        },
  },
  server: { port: 5178 },
});
