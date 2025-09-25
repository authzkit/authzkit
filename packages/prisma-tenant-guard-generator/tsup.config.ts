import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    dts: true,
    format: ['esm', 'cjs'],
    clean: true,
  },
  {
    entry: ['src/cli.ts'],
    dts: false,
    format: ['esm', 'cjs'],
    clean: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    entry: ['src/generator.ts'],
    dts: true,
    format: ['esm', 'cjs'],
    clean: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
