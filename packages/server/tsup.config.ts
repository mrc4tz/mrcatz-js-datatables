import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/nest.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  // Satu salinan kelas error untuk index & nest (instanceof tetap valid di CJS).
  splitting: true,
  external: ['@mrcatz/datatable-core', '@nestjs/common'],
});
