import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/nest.ts', 'src/meilisearch.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'es2022',
    // Satu salinan kelas error untuk index, nest & meilisearch (instanceof tetap valid di CJS).
    splitting: true,
    external: ['@mrcatz/datatable-core', '@nestjs/common'],
  },
  {
    // CLI `mrcatz make|remove` (pengganti `php artisan mrcatz:make`).
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    platform: 'node',
    target: 'node20',
    banner: { js: '#!/usr/bin/env node' },
    clean: false,
  },
]);
