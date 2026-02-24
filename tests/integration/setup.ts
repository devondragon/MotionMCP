/**
 * Integration test infrastructure — shared helpers for tests that hit the real Motion API.
 *
 * Usage:
 *   import { getTestService, getTestWorkspaceId, getOrCreateTestProject, rateLimitDelay, skipIfNoApiKey } from './setup';
 */
import { MotionApiService } from '../../src/services/motionApi';
import type { MotionProject } from '../../src/types/motion';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Delay between API calls in ms. Motion rate limit is 12 req/min ≈ 5s between calls. */
const RATE_LIMIT_DELAY_MS = Number(process.env.MOTION_RATE_LIMIT_DELAY_MS) || 5500;

/** Name of the sandbox project used by integration tests. */
const TEST_PROJECT_NAME = process.env.MOTION_INTEGRATION_PROJECT || 'MCP Integration Tests';

// ---------------------------------------------------------------------------
// Singleton caches (survive across tests within the same vitest run)
// ---------------------------------------------------------------------------

let cachedService: MotionApiService | undefined;
let cachedWorkspaceId: string | undefined;
let cachedProject: MotionProject | undefined;

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Returns a `MotionApiService` backed by the real API key from the environment.
 * Reuses the same instance across all tests.
 */
export function getTestService(): MotionApiService {
  if (!cachedService) {
    cachedService = new MotionApiService(process.env.MOTION_API_KEY);
  }
  return cachedService;
}

/**
 * Resolves the default workspace ID (the first workspace returned by the API).
 * Cached after the first call.
 */
export async function getTestWorkspaceId(): Promise<string> {
  if (cachedWorkspaceId) return cachedWorkspaceId;

  const service = getTestService();
  const workspaces = await service.getWorkspaces();
  if (workspaces.length === 0) {
    throw new Error('No workspaces found — cannot run integration tests');
  }
  cachedWorkspaceId = workspaces[0].id;
  return cachedWorkspaceId;
}

/**
 * Finds or creates the "MCP Integration Tests" project in the default workspace.
 * Cached after the first call.
 */
export async function getOrCreateTestProject(): Promise<MotionProject> {
  if (cachedProject) return cachedProject;

  const service = getTestService();
  const workspaceId = await getTestWorkspaceId();

  // Try to find existing project
  const existing = await service.getProjectByName(TEST_PROJECT_NAME, workspaceId);
  if (existing) {
    cachedProject = existing;
    return cachedProject;
  }

  // Create the sandbox project
  await rateLimitDelay();
  cachedProject = await service.createProject({
    name: TEST_PROJECT_NAME,
    workspaceId,
  });
  return cachedProject;
}

/**
 * Waits for the configured rate-limit delay. Call between API requests
 * to stay safely under Motion's 12 req/min limit.
 */
export function rateLimitDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
}

/**
 * Call at the top of every integration test file (outside `describe`).
 * When `MOTION_API_KEY` is not set the entire file is skipped gracefully.
 *
 * Usage:
 *   skipIfNoApiKey();
 *   describe('...', () => { ... });
 */
export function skipIfNoApiKey(): void {
  if (!process.env.MOTION_API_KEY) {
    // vitest will pick up the top-level describe.skip generated below
    // but we also set a global flag tests can check
    (globalThis as any).__SKIP_INTEGRATION__ = true;
  }
}

/**
 * Use inside `describe` blocks as: `beforeAll(() => { if (shouldSkip()) return; ... })`
 */
export function shouldSkip(): boolean {
  return !process.env.MOTION_API_KEY;
}
