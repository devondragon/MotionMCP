import { describe, it, expect, vi } from 'vitest';
import { RecurringTaskHandler } from '../src/handlers';
import type { HandlerContext } from '../src/handlers/base/HandlerInterface';
import type { MotionRecurringTasksArgs } from '../src/types/mcp-tool-args';

function makeContext() {
  const motionService = {
    getRecurringTasks: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'rt1',
          name: 'Weekly Report',
          frequency: { type: 'weekly' },
          priority: 'MEDIUM',
          assignee: { id: 'user1', name: 'Owner 1', email: 'owner1@example.com' },
          creator: { id: 'user1', name: 'Owner 1', email: 'owner1@example.com' },
          workspace: {
            id: 'ws1',
            name: 'Test Workspace',
            teamId: null,
            type: 'WORKSPACE',
            labels: []
          },
          status: { name: 'Backlog', isDefaultStatus: true, isResolvedStatus: false },
          labels: []
        },
        {
          id: 'rt2',
          name: 'Daily Standup',
          frequency: { type: 'daily' },
          priority: 'HIGH',
          assignee: { id: 'user2', name: 'Owner 2', email: 'owner2@example.com' },
          creator: { id: 'user2', name: 'Owner 2', email: 'owner2@example.com' },
          workspace: {
            id: 'ws1',
            name: 'Test Workspace',
            teamId: null,
            type: 'WORKSPACE',
            labels: []
          },
          status: { name: 'Backlog', isDefaultStatus: true, isResolvedStatus: false },
          labels: []
        },
      ],
      truncation: undefined,
    }),
    createRecurringTask: vi.fn().mockResolvedValue({
      id: 'rt3',
      name: 'New Task',
      frequency: { type: 'weekly' },
      priority: 'MEDIUM',
      creator: { id: 'user1', name: 'Test User', email: 'test@example.com' },
      assignee: { id: 'user1', name: 'Test User', email: 'test@example.com' },
      workspace: {
        id: 'ws1',
        name: 'Test Workspace',
        teamId: null,
        type: 'WORKSPACE',
        labels: []
      },
      status: { name: 'In Progress', isDefaultStatus: false, isResolvedStatus: false },
      labels: [],
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

    it('returns error when workspace identifier missing', async () => {
      const { ctx } = makeContext();
      const handler = new RecurringTaskHandler(ctx);
      const args: MotionRecurringTasksArgs = { operation: 'list' };

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('Workspace ID or workspace name is required');
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

    it('preserves duration 0 in create payload', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new RecurringTaskHandler(ctx);
      const args: MotionRecurringTasksArgs = {
        operation: 'create',
        name: 'Zero Duration Task',
        workspaceId: 'ws1',
        assigneeId: 'user1',
        frequency: { type: 'daily' },
        duration: 0,
      };

      const res = await handler.handle(args);

      expect(motionService.createRecurringTask).toHaveBeenCalledWith(expect.objectContaining({
        duration: 0,
      }));
      expect(res.isError).toBeFalsy();
    });

    it('formats creator and assignee details from create response', async () => {
      const { ctx, motionService } = makeContext();
      motionService.createRecurringTask.mockResolvedValueOnce({
        id: 'rt4',
        name: 'Formatted Task',
        priority: 'MEDIUM',
        creator: { id: 'user9', name: 'Creator Name', email: 'creator@example.com' },
        assignee: { id: 'user8', name: 'Assignee Name', email: 'assignee@example.com' },
        workspace: {
          id: 'ws1',
          name: 'Test Workspace',
          teamId: null,
          type: 'WORKSPACE',
          labels: []
        },
        status: { name: 'In Progress', isDefaultStatus: false, isResolvedStatus: false },
        labels: [],
      });
      const handler = new RecurringTaskHandler(ctx);
      const args: MotionRecurringTasksArgs = {
        operation: 'create',
        name: 'Formatted Task',
        workspaceId: 'ws1',
        assigneeId: 'user1',
        frequency: { type: 'weekly' },
      };

      const res = await handler.handle(args);
      const text = (res.content?.[0] as any)?.text || '';
      expect(res.isError).toBeFalsy();
      expect(text).toContain('- Creator: Creator Name (creator@example.com)');
      expect(text).toContain('- Assignee: Assignee Name (assignee@example.com)');
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

    it('parses JSON-stringified frequency object', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new RecurringTaskHandler(ctx);
      const args = {
        operation: 'create',
        name: 'Stringified Freq Task',
        workspaceId: 'ws1',
        assigneeId: 'user1',
        frequency: '{"type":"weekly"}' as any,
      };

      const res = await handler.handle(args);

      expect(res.isError).toBeFalsy();
      expect(motionService.createRecurringTask).toHaveBeenCalledWith(
        expect.objectContaining({ frequency: { type: 'weekly' } })
      );
    });

    it('returns error for non-object stringified frequency', async () => {
      const { ctx } = makeContext();
      const handler = new RecurringTaskHandler(ctx);
      const args = {
        operation: 'create',
        name: 'Bad Freq Task',
        workspaceId: 'ws1',
        assigneeId: 'user1',
        frequency: 'not-an-object' as any,
      };

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('frequency must be an object');
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
