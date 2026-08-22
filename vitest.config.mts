import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['tests/**/*.{test,spec}.ts'],
          exclude: ['tests/integration/**', 'tests/worker/**'],
          setupFiles: ['tests/setup.ts'],
          testTimeout: 10000
        }
      },
      {
        // Worker auth tests run inside workerd, the same runtime as production,
        // so they exercise the real crypto.subtle.timingSafeEqual, the real
        // Request/URL semantics behind the path rewrites, and the Durable
        // Object bindings the agent is mounted on.
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.toml' },
            miniflare: {
              bindings: {
                MOTION_API_KEY: 'test-motion-api-key',
                MOTION_MCP_SECRET: 'test-worker-secret'
              }
            }
          })
        ],
        test: {
          name: 'worker',
          include: ['tests/worker/**/*.{test,spec}.ts'],
          testTimeout: 10000
        }
      }
    ],
    coverage: {
      include: ['src/utils/**/*.ts', 'src/tools/**/*.ts', 'src/worker.ts'],
      exclude: ['src/utils/logger.ts', 'src/utils/index.ts']
    }
  }
});
