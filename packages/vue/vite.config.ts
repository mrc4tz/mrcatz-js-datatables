import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// Build library: komponen SFC dikompilasi ke JS; dependensi peer tidak dibundel.
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'index.js' },
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      external: ['vue', 'vue-router', '@tanstack/vue-query', '@mrcatz/datatable-core'],
    },
  },
});
