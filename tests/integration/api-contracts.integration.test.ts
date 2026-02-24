/**
 * Integration tests — verify that real Motion API responses match our TypeScript types.
 *
 * These tests would have caught the bugs found during review cycles:
 *   - wrong response shapes (wrapped vs unwrapped)
 *   - enum casing mismatches
 *   - unexpected field names
 *
 * Requires MOTION_API_KEY in the environment. Skipped gracefully when absent.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  getTestService,
  getTestWorkspaceId,
  getOrCreateTestProject,
  rateLimitDelay,
  shouldSkip,
} from './setup';
import { MotionApiService } from '../../src/services/motionApi';
import type { MotionProject } from '../../src/types/motion';

// Skip the entire file when no API key is available
const describeIf = process.env.MOTION_API_KEY ? describe : describe.skip;

describeIf('API contract tests (real Motion API)', () => {
  let service: MotionApiService;
  let workspaceId: string;
  let testProject: MotionProject;

  beforeAll(async () => {
    if (shouldSkip()) return;
    service = getTestService();
    workspaceId = await getTestWorkspaceId();
    await rateLimitDelay();
    testProject = await getOrCreateTestProject();
    await rateLimitDelay();
  });

  afterEach(async () => {
    await rateLimitDelay();
  });

  // =======================================================================
  // Read-only endpoints (no side effects)
  // =======================================================================

  describe('Workspace endpoints', () => {
    it('GET /workspaces — returns array of workspaces with expected fields', async () => {
      const workspaces = await service.getWorkspaces();

      expect(Array.isArray(workspaces)).toBe(true);
      expect(workspaces.length).toBeGreaterThan(0);

      const ws = workspaces[0];
      expect(ws).toHaveProperty('id');
      expect(ws).toHaveProperty('name');
      expect(typeof ws.id).toBe('string');
      expect(typeof ws.name).toBe('string');
      // teamId may be null for personal workspaces
      expect(ws).toHaveProperty('teamId');
    });
  });

  describe('User endpoints', () => {
    it('GET /users/me — returns current user with expected fields', async () => {
      const user = await service.getCurrentUser();

      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('name');
      expect(typeof user.id).toBe('string');
      expect(typeof user.name).toBe('string');
    });
  });

  describe('Project endpoints', () => {
    it('GET /projects — returns projects with paginated structure', async () => {
      const result = await service.getProjects(workspaceId);

      // getProjects returns ListResult<MotionProject>
      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);

      if (result.items.length > 0) {
        const project = result.items[0];
        expect(project).toHaveProperty('id');
        expect(project).toHaveProperty('name');
        expect(project).toHaveProperty('workspaceId');
        expect(typeof project.id).toBe('string');
        expect(typeof project.name).toBe('string');
      }
    });
  });

  describe('Schedule endpoints', () => {
    it('GET /schedules — returns array of schedules with expected fields', async () => {
      const schedules = await service.getSchedules();

      expect(Array.isArray(schedules)).toBe(true);

      if (schedules.length > 0) {
        const sched = schedules[0];
        expect(sched).toHaveProperty('name');
        expect(sched).toHaveProperty('timezone');
        expect(sched).toHaveProperty('schedule');
        expect(typeof sched.name).toBe('string');
        expect(typeof sched.timezone).toBe('string');
      }
    });
  });

  describe('Status endpoints', () => {
    it('GET /statuses — returns array of statuses with expected fields', async () => {
      const statuses = await service.getStatuses(workspaceId);

      expect(Array.isArray(statuses)).toBe(true);
      expect(statuses.length).toBeGreaterThan(0);

      const status = statuses[0];
      expect(status).toHaveProperty('name');
      expect(status).toHaveProperty('isDefaultStatus');
      expect(status).toHaveProperty('isResolvedStatus');
      expect(typeof status.name).toBe('string');
      expect(typeof status.isDefaultStatus).toBe('boolean');
      expect(typeof status.isResolvedStatus).toBe('boolean');
    });
  });

  // =======================================================================
  // Task CRUD (creates data, cleans up in afterAll)
  // =======================================================================

  describe('Task CRUD', () => {
    const createdTaskIds: string[] = [];

    afterAll(async () => {
      // Cleanup: delete all tasks created during these tests
      for (const id of createdTaskIds) {
        try {
          await service.deleteTask(id);
        } catch {
          // Ignore — task may already be deleted
        }
        await rateLimitDelay();
      }
    });

    it('POST /tasks — returns full task object with expected fields', async () => {
      const task = await service.createTask({
        name: '[Integration Test] Task create',
        workspaceId,
        projectId: testProject.id,
      });
      createdTaskIds.push(task.id);

      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('name');
      expect(task).toHaveProperty('workspace');
      expect(typeof task.id).toBe('string');
      expect(task.name).toBe('[Integration Test] Task create');

      // workspace should be a nested object
      expect(task.workspace).toHaveProperty('id');
      expect(task.workspace).toHaveProperty('name');

      // status can be string or object
      expect(task).toHaveProperty('status');
    });

    it('GET /tasks/{id} — returns same shape as create', async () => {
      // Create a task to retrieve
      await rateLimitDelay();
      const created = await service.createTask({
        name: '[Integration Test] Task get',
        workspaceId,
        projectId: testProject.id,
      });
      createdTaskIds.push(created.id);

      await rateLimitDelay();
      const fetched = await service.getTask(created.id);

      expect(fetched.id).toBe(created.id);
      expect(fetched.name).toBe(created.name);
      expect(fetched).toHaveProperty('workspace');
      expect(fetched).toHaveProperty('status');
    });

    it('PATCH /tasks/{id} — returns updated task', async () => {
      await rateLimitDelay();
      const created = await service.createTask({
        name: '[Integration Test] Task update',
        workspaceId,
        projectId: testProject.id,
      });
      createdTaskIds.push(created.id);

      await rateLimitDelay();
      const updated = await service.updateTask(created.id, {
        name: '[Integration Test] Task update (edited)',
      });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe('[Integration Test] Task update (edited)');
      expect(updated).toHaveProperty('workspace');
    });

    it('DELETE /tasks/{id} — deletes successfully (void return)', async () => {
      await rateLimitDelay();
      const created = await service.createTask({
        name: '[Integration Test] Task delete',
        workspaceId,
        projectId: testProject.id,
      });
      // Don't push to cleanup — we're about to delete it ourselves

      await rateLimitDelay();
      // deleteTask returns void; should not throw
      await expect(service.deleteTask(created.id)).resolves.toBeUndefined();

      // Verify it's gone — getTask should throw
      await rateLimitDelay();
      await expect(service.getTask(created.id)).rejects.toThrow();
    });

    it('GET /tasks (list) — returns ListResult with items array', async () => {
      const result = await service.getTasks({ workspaceId });

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);

      if (result.items.length > 0) {
        const task = result.items[0];
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('name');
        expect(task).toHaveProperty('workspace');
      }
    });
  });

  // =======================================================================
  // Project creation contract verification
  // =======================================================================

  describe('Project creation contract', () => {
    it('POST /projects — succeeds without description field', async () => {
      // setup.ts already creates projects without description successfully.
      // This test makes the contract check explicit.
      const result = await service.createProject({
        name: '[Integration Test] No Description',
        workspaceId,
      });
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      // Verified: API accepts projects without description and returns one in the response (empty string)
      // Note: Motion API doesn't have a delete project endpoint, so this project will persist
    });
  });

  // =======================================================================
  // Custom field CRUD (beta endpoints, creates data, cleans up)
  // These endpoints may not be available for all accounts (404 = beta not enabled).
  // =======================================================================

  describe('Custom field CRUD', () => {
    let customFieldId: string | undefined;
    let cfTestTaskId: string | undefined;
    let betaAvailable = true;

    afterAll(async () => {
      // Cleanup: delete task (which removes any custom field assignments), then delete custom field
      if (cfTestTaskId) {
        try { await service.deleteTask(cfTestTaskId); } catch { /* ignore */ }
        await rateLimitDelay();
      }
      if (customFieldId) {
        try { await service.deleteCustomField(workspaceId, customFieldId); } catch { /* ignore */ }
        await rateLimitDelay();
      }
    });

    it('POST custom field — creates and returns field with id', async () => {
      try {
        const field = await service.createCustomField(workspaceId, {
          name: '[Integration Test] Text Field',
          field: 'text',
        });

        expect(field).toHaveProperty('id');
        expect(typeof field.id).toBe('string');
        customFieldId = field.id;

        // The API response shape uses either 'field' or 'type' for the field type
        expect('field' in field || 'type' in field).toBe(true);
      } catch (err: any) {
        // Beta endpoints may not be available (404)
        if (err?.statusCode === 404 || err?.originalError?.response?.status === 404 ||
            String(err).includes('404')) {
          betaAvailable = false;
          console.warn('Custom fields beta API not available (404) — skipping remaining custom field tests');
          return;
        }
        throw err;
      }
    });

    it('GET custom fields — returns array', async () => {
      if (!betaAvailable) return; // skip if beta not available

      await rateLimitDelay();
      const fields = await service.getCustomFields(workspaceId);

      expect(Array.isArray(fields)).toBe(true);
      if (customFieldId) {
        const found = fields.find((f) => f.id === customFieldId);
        expect(found).toBeDefined();

        // Verify field shape is consistent between POST and GET
        if (found) {
          expect('field' in found || 'type' in found).toBe(true);
        }
      }
    });

    it('POST custom field value on task — returns { type, value } not full task', async () => {
      if (!betaAvailable || !customFieldId) return;

      await rateLimitDelay();
      const task = await service.createTask({
        name: '[Integration Test] CF Task',
        workspaceId,
        projectId: testProject.id,
      });
      cfTestTaskId = task.id;

      await rateLimitDelay();
      const result = await service.addCustomFieldToTask(task.id, customFieldId, 'hello', 'text');

      // The bug we found: API returns { type, value }, NOT a full task object
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('value');
      // Should NOT have task-level fields
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('name');
      expect(result).not.toHaveProperty('workspace');
    });

    it('DELETE custom field value from task — succeeds', async () => {
      if (!betaAvailable || !cfTestTaskId || !customFieldId) return;

      await rateLimitDelay();
      const result = await service.removeCustomFieldFromTask(cfTestTaskId, customFieldId);
      expect(result).toEqual({ success: true });
    });

    it('DELETE custom field — succeeds', async () => {
      if (!betaAvailable || !customFieldId) return;

      await rateLimitDelay();
      const result = await service.deleteCustomField(workspaceId, customFieldId);
      expect(result).toEqual({ success: true });
      customFieldId = undefined;
    });
  });
});
