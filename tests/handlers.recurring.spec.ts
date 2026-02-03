import { describe, it, expect, vi } from 'vitest';
import { RecurringTaskHandler } from '../src/handlers';
import type { HandlerContext } from '../src/handlers/base/HandlerInterface';
import type { MotionRecurringTasksArgs } from '../src/types/mcp-tool-args';

function makeContext() {
  const motionService = {
    getRecurringTasks: vi.fn().mockResolvedValue([
      { id: 'rt1', name: 'Weekly Report', frequency: { type: 'weekly' }, priority: 'MEDIUM' },
      { id: 'rt2', name: 'Daily Standup', frequency: { type: 'daily' }, priority: 'HIGH' },
    ]),
    createRecurringTask: vi.fn().mockResolvedValue({
      id: 'rt3',
      name: 'New Task',
      frequency: { type: 'weekly' },
      priority: 'MEDIUM',
      creator: { name: 'Test User', email: 'test@example.com' },
      workspace: { id: 'ws1', name: 'Test Workspace' },
      status: { name: 'In Progress' },
    }),
    deleteRecurringTask: vi.fn().mockResolvedValue(undefined),
  } as any;

  const workspaceResolver = {
    resolveWorkspace: vi.fn().mockResolvedValue({ id: 'ws1', name: 'Test Workspace' }),
  } as any;

  const ctx: HandlerContext = {
    motionService,
    workspaceResolver,
    validator: {} as any,
  };
  return { ctx, motionService, workspaceResolver };
}

describe('RecurringTaskHandler', () => {
  describe('list operation', () => {
    it('lists recurring tasks with workspaceId', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new RecurringTaskHandler(ctx);
      const args: MotionRecurringTasksArgs = { operation: 'list', workspaceId: 'ws1' };

      const res = await handler.handle(args);

      expect(motionService.getRecurringTasks).toHaveBeenCalledWith('ws1');
      expect(res.isError).toBeFalsy();
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('Weekly Report');
      expect(text).toContain('Daily Standup');
    });

    it('returns error when workspaceId missing', async () => {
      const { ctx } = makeContext();
      const handler = new RecurringTaskHandler(ctx);
      const args: MotionRecurringTasksArgs = { operation: 'list' };

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('Workspace ID is required');
    });
  });

  describe('create operation', () => {
    it('creates a recurring task successfully', async () => {
      const { ctx, motionService, workspaceResolver } = makeContext();
      const handler = new RecurringTaskHandler(ctx);
      const args: MotionRecurringTasksArgs = {
        operation: 'create',
        name: 'New Recurring Task',
        workspaceId: 'ws1',
        assigneeId: 'user1',
        frequency: { type: 'weekly' },
      };

      const res = await handler.handle(args);

      expect(workspaceResolver.resolveWorkspace).toHaveBeenCalledWith({ workspaceId: 'ws1' });
      expect(motionService.createRecurringTask).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Recurring Task',
        workspaceId: 'ws1',
        assigneeId: 'user1',
        frequency: { type: 'weekly' },
      }));
      expect(res.isError).toBeFalsy();
    });

    it('creates recurring task with all optional fields', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new RecurringTaskHandler(ctx);
      const args: MotionRecurringTasksArgs = {
        operation: 'create',
        name: 'Full Task',
        workspaceId: 'ws1',
        assigneeId: 'user1',
        frequency: { type: 'daily' },
        description: 'Daily task description',
        projectId: 'proj1',
        deadlineType: 'HARD',
        duration: 30,
        startingOn: '2024-01-15',
        idealTime: '09:00',
        schedule: 'Work Hours',
        priority: 'HIGH',
      };

      const res = await handler.handle(args);

      expect(motionService.createRecurringTask).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Full Task',
        description: 'Daily task description',
        projectId: 'proj1',
        deadlineType: 'HARD',
        duration: 30,
        priority: 'HIGH',
      }));
      expect(res.isError).toBeFalsy();
    });

    it('returns error when required params missing', async () => {
      const { ctx } = makeContext();
      const handler = new RecurringTaskHandler(ctx);
      const args: MotionRecurringTasksArgs = {
        operation: 'create',
        name: 'Task',
      };

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('required');
    });

    it('returns error for invalid frequency type', async () => {
      const { ctx } = makeContext();
      const handler = new RecurringTaskHandler(ctx);
      const args: MotionRecurringTasksArgs = {
        operation: 'create',
        name: 'Task',
        workspaceId: 'ws1',
        assigneeId: 'user1',
        frequency: { type: 'invalid' as any },
      };

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('Frequency type');
    });

    it('returns error when frequency missing type', async () => {
      const { ctx } = makeContext();
      const handler = new RecurringTaskHandler(ctx);
      const args: MotionRecurringTasksArgs = {
        operation: 'create',
        name: 'Task',
        workspaceId: 'ws1',
        assigneeId: 'user1',
        frequency: {} as any,
      };

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('Frequency type');
    });
  });

  describe('delete operation', () => {
    it('deletes recurring task successfully', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new RecurringTaskHandler(ctx);
      const args: MotionRecurringTasksArgs = {
        operation: 'delete',
        recurringTaskId: 'rt1',
      };

      const res = await handler.handle(args);

      expect(motionService.deleteRecurringTask).toHaveBeenCalledWith('rt1');
      expect(res.isError).toBeFalsy();
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('deleted successfully');
    });

    it('returns error when recurringTaskId missing', async () => {
      const { ctx } = makeContext();
      const handler = new RecurringTaskHandler(ctx);
      const args: MotionRecurringTasksArgs = { operation: 'delete' };

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('Recurring task ID is required');
    });
  });

  describe('unknown operation', () => {
    it('returns error for unknown operation', async () => {
      const { ctx } = makeContext();
      const handler = new RecurringTaskHandler(ctx);
      const args = { operation: 'invalid' } as any;

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('Unknown operation');
    });
  });

  describe('error handling', () => {
    it('handles service errors gracefully', async () => {
      const { ctx, motionService } = makeContext();
      motionService.getRecurringTasks.mockRejectedValue(new Error('Service unavailable'));
      const handler = new RecurringTaskHandler(ctx);
      const args: MotionRecurringTasksArgs = { operation: 'list', workspaceId: 'ws1' };

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('Service unavailable');
    });
  });
});
