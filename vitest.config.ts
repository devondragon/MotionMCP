import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      include: ['src/utils/**/*.ts', 'src/tools/**/*.ts'],
      exclude: ['src/utils/logger.ts', 'src/utils/index.ts']
    },
    testTimeout: 10000
  }
});
