/**
 * Integration tests — verify that enum values and special parameter semantics
 * are accepted by the real Motion API.
 *
 * These tests catch casing mismatches (e.g. 'ASAP' vs 'asap') and parameter
 * semantics (e.g. autoScheduled: null) that unit tests with mocked APIs miss.
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
import type { MotionProject, MotionTask } from '../../src/types/motion';

const describeIf = process.env.MOTION_API_KEY ? describe : describe.skip;

describeIf('Enum values and parameter semantics (real Motion API)', () => {
  let service: MotionApiService;
  let workspaceId: string;
  let testProject: MotionProject;
  const createdTaskIds: string[] = [];

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

  afterAll(async () => {
    for (const id of createdTaskIds) {
      try {
        await service.deleteTask(id);
      } catch { /* ignore */ }
      await rateLimitDelay();
    }
  });

  // =======================================================================
  // Priority enum values
  // =======================================================================

  describe('Priority values', () => {
    const priorities = ['ASAP', 'HIGH', 'MEDIUM', 'LOW'] as const;

    for (const priority of priorities) {
      it(`accepts priority "${priority}"`, async () => {
        const task = await service.createTask({
          name: `[Integration Test] Priority ${priority}`,
          workspaceId,
          projectId: testProject.id,
          priority,
        });
        createdTaskIds.push(task.id);

        expect(task).toHaveProperty('id');
        // The API should echo back the same priority
        expect(task.priority).toBe(priority);

        await rateLimitDelay();
      });
    }
  });

  // =======================================================================
  // autoScheduled: null semantics
  // =======================================================================

  describe('autoScheduled parameter', () => {
    it('accepts autoScheduled: null without error', async () => {
      const task = await service.createTask({
        name: '[Integration Test] autoScheduled null',
        workspaceId,
        projectId: testProject.id,
        autoScheduled: null,
      });
      createdTaskIds.push(task.id);

      expect(task).toHaveProperty('id');
      // autoScheduled may come back as null, undefined, or an object — just verify the call succeeded
    });
  });

  // =======================================================================
  // Custom field type casing
  // =======================================================================

  describe('Custom field type casing', () => {
    let customFieldId: string | undefined;
    let cfTaskId: string | undefined;
    let betaAvailable = true;

    afterAll(async () => {
      // Cleanup: delete task (which removes any custom field assignments), then delete custom field
      if (cfTaskId) {
        try { await service.deleteTask(cfTaskId); } catch { /* ignore */ }
        await rateLimitDelay();
      }
      if (customFieldId) {
        try { await service.deleteCustomField(workspaceId, customFieldId); } catch { /* ignore */ }
        await rateLimitDelay();
      }
    });

    it('creates a text custom field and sets value with camelCase type', async () => {
      let field;
      try {
        field = await service.createCustomField(workspaceId, {
          name: '[Integration Test] Enum Casing Field',
          field: 'text',
        });
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.originalError?.response?.status === 404 ||
            String(err).includes('404')) {
          betaAvailable = false;
          console.warn('Custom fields beta API not available (404) — skipping');
          return;
        }
        throw err;
      }
      customFieldId = field.id;

      await rateLimitDelay();

      const task = await service.createTask({
        name: '[Integration Test] CF Casing Task',
        workspaceId,
        projectId: testProject.id,
      });
      cfTaskId = task.id;

      await rateLimitDelay();

      // Add value using camelCase type ('text')
      const result = await service.addCustomFieldToTask(task.id, field.id, 'test value', 'text');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('value');
      // Document whether the API echoes 'text' or 'TEXT'
      expect(typeof result.type).toBe('string');
    });
  });

  // =======================================================================
  // Deadline type via autoScheduled
  // deadlineType is a nested property inside autoScheduled, not top-level
  // =======================================================================

  describe('Deadline type via autoScheduled', () => {
    it('accepts deadlineType inside autoScheduled object', async () => {
      // Look up a valid schedule name for this account
      const schedules = await service.getSchedules();
      const scheduleName = schedules[0]?.name;
      expect(scheduleName).toBeDefined();  // must have at least one schedule

      await rateLimitDelay();
      const task = await service.createTask({
        name: '[Integration Test] Deadline via autoScheduled',
        workspaceId,
        projectId: testProject.id,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
        autoScheduled: {
          schedule: scheduleName,
          deadlineType: 'HARD',
        },
      });
      createdTaskIds.push(task.id);

      expect(task).toHaveProperty('id');
      // The response includes deadlineType as a top-level field
      expect(task.deadlineType).toBe('HARD');
    });
  });

  // =======================================================================
  // Duration special values
  // =======================================================================

  describe('Duration special values', () => {
    it('accepts duration "NONE"', async () => {
      const task = await service.createTask({
        name: '[Integration Test] Duration NONE',
        workspaceId,
        projectId: testProject.id,
        duration: 'NONE',
      });
      createdTaskIds.push(task.id);
      expect(task).toHaveProperty('id');
    });

    it('accepts duration "REMINDER"', async () => {
      await rateLimitDelay();
      const task = await service.createTask({
        name: '[Integration Test] Duration REMINDER',
        workspaceId,
        projectId: testProject.id,
        duration: 'REMINDER',
      });
      createdTaskIds.push(task.id);
      expect(task).toHaveProperty('id');
    });

    it('accepts numeric duration (30 minutes)', async () => {
      await rateLimitDelay();
      const task = await service.createTask({
        name: '[Integration Test] Duration 30',
        workspaceId,
        projectId: testProject.id,
        duration: 30,
      });
      createdTaskIds.push(task.id);
      expect(task).toHaveProperty('id');
    });
  });
});
