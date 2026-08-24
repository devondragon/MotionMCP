import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.integration.test.ts'],
    // Load .env so MOTION_API_KEY is present before the test files evaluate their
    // describe.skip guard. Unlike the unit run, this config has no other path to
    // .env, so without this the suite silently skips even when a key is set.
    setupFiles: ['dotenv/config'],
    testTimeout: 60_000,   // 60s per test — API calls with rate-limit delays are slow
    hookTimeout: 60_000,   // beforeAll / afterAll may create/delete multiple resources
    maxWorkers: 1,         // Sequential execution to respect Motion API rate limits
    isolate: false,        // Single process — no module isolation needed
  },
});
