import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// Build library: komponen SFC dikompilasi ke JS; dependensi peer tidak dibundel.
// Entry `editor`, `editor-advanced`, dan `map` terpisah agar paket opsional
// (quill, tinymce, leaflet) hanya di-resolve bundler aplikasi bila diimpor.
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: { index: 'src/index.ts', editor: 'src/editor.ts', 'editor-advanced': 'src/editor-advanced.ts', map: 'src/map.ts' },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      external: [
        'vue',
        'vue-router',
        '@tanstack/vue-query',
        '@mrc4tz/datatable-core',
        // Peer opsional — dimuat lewat import() dinamis, tidak pernah dibundel.
        /^quill(\/.*)?$/,
        /^tinymce(\/.*)?$/,
        /^leaflet(\/.*)?$/,
      ],
    },
  },
});
