import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['packages/**/src/**/*.{ts,tsx}'],
      exclude: ['packages/**/src/cli.ts', 'packages/**/src/generator.ts'],
      thresholds: {
        statements: 50,
        branches: 60,
        functions: 80,
        lines: 50,
      },
    },
  },
});
