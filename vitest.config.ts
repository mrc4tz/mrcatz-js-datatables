import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

const src = (p: string) => fileURLToPath(new URL(`./packages/${p}/src/index.ts`, import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // Test memakai source langsung, bukan dist hasil build.
    alias: {
      '@mrc4tz/datatable-core': src('core'),
      '@mrc4tz/datatable-server': src('server'),
      '@mrc4tz/datatable-vue': src('vue'),
    },
  },
  test: { include: ['packages/*/test/**/*.test.ts'] },
});
