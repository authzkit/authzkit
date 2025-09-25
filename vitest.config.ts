import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['packages/**/src/**/*.{ts,tsx}'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
