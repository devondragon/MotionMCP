import { describe, it, expect, vi } from 'vitest';
import { TaskHandler } from '../src/handlers';
import type { HandlerContext } from '../src/handlers/base/HandlerInterface';

function makeContext(overrides: Partial<HandlerContext> = {}): HandlerContext {
  const motionService = {
    createTask: vi.fn().mockResolvedValue({ id: 't1', name: 'Hello' }),
    getTasks: vi.fn().mockResolvedValue({
      items: [
        { id: 't1', name: 'A' },
        { id: 't2', name: 'B' },
      ],
      truncation: undefined,
    }),
    getTask: vi.fn().mockResolvedValue({ id: 't1', name: 'A' }),
    updateTask: vi.fn().mockResolvedValue({ id: 't1', name: 'New' }),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    moveTask: vi.fn().mockResolvedValue({ id: 't1', name: 'A' }),
    unassignTask: vi.fn().mockResolvedValue({ id: 't1', name: 'A' }),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'me-id', name: 'Me', email: 'me@example.com' }),
    resolveUserIdentifier: vi.fn().mockResolvedValue({ id: 'u-jane', name: 'Jane', email: 'jane@example.com' }),
    getWorkspaces: vi.fn().mockResolvedValue([{ id: 'w1', name: 'Dev' }]),
    // Note: getSchedules is intentionally NOT mocked so resolveTimeZone() degrades
    // to undefined and due dates use end-of-day UTC (see due-date assertions above).
  } as any;

  const workspaceResolver = {
    resolveWorkspace: vi.fn().mockResolvedValue({ id: 'w1', name: 'Dev' })
  } as any;

  const validator = {} as any;

  return {
    motionService,
    workspaceResolver,
    validator,
    ...overrides,
  } as HandlerContext;
}

describe('TaskHandler', () => {
  it('creates a task using resolved workspace and normalizes due dates', async () => {
    const ctx = makeContext();
    const handler = new TaskHandler(ctx);
    const res = await handler.handle({
      operation: 'create',
      name: 'Hello',
      workspaceName: 'Dev',
      dueDate: '2024-05-10'
    } as any);

    expect(ctx.workspaceResolver.resolveWorkspace).toHaveBeenCalled();
    expect(ctx.motionService.createTask).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Hello',
      workspaceId: 'w1',
      dueDate: '2024-05-10T23:59:59.000Z'
    }));

    const text = (res.content?.[0] as any)?.text || '';
    expect(text).toContain('Successfully created task');
    expect(text).toContain('Hello');
  });

  it('lists tasks and formats response', async () => {
    const ctx = makeContext();
    const handler = new TaskHandler(ctx);
    const res = await handler.handle({ operation: 'list', workspaceName: 'Dev', limit: 10 } as any);

    expect(ctx.motionService.getTasks).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'w1',
      limit: 10
    }));
    const text = (res.content?.[0] as any)?.text || '';
    expect(text).toContain('Found 2 tasks');
    expect(text).toContain('(ID: t1)');
    expect(text).toContain('(ID: t2)');
  });

  it('updates a task, normalizes due dates, and returns success text', async () => {
    const ctx = makeContext();
    const handler = new TaskHandler(ctx);
    const res = await handler.handle({
      operation: 'update',
      taskId: 't1',
      name: 'New',
      dueDate: '2024-06-01'
    } as any);

    expect(ctx.motionService.updateTask).toHaveBeenCalledWith('t1', expect.objectContaining({
      name: 'New',
      dueDate: '2024-06-01T23:59:59.000Z'
    }));
    const text = (res.content?.[0] as any)?.text || '';
    expect(text).toContain('Successfully updated task');
  });

  it('returns error for invalid create duration strings', async () => {
    const ctx = makeContext();
    const handler = new TaskHandler(ctx);

    const res = await handler.handle({
      operation: 'create',
      name: 'Hello',
      workspaceName: 'Dev',
      duration: '5 minutes'
    } as any);

    expect(res.isError).toBe(true);
    expect(ctx.motionService.createTask).not.toHaveBeenCalled();
    const text = (res.content?.[0] as any)?.text || '';
    expect(text).toContain('Duration must be a non-negative integer');
  });

  it('returns error for invalid update duration strings', async () => {
    const ctx = makeContext();
    const handler = new TaskHandler(ctx);

    const res = await handler.handle({
      operation: 'update',
      taskId: 't1',
      duration: 'abc'
    } as any);

    expect(res.isError).toBe(true);
    expect(ctx.motionService.updateTask).not.toHaveBeenCalled();
    const text = (res.content?.[0] as any)?.text || '';
    expect(text).toContain('Duration must be a non-negative integer');
  });

  it('resolves an assignee name to an ID on create', async () => {
    const ctx = makeContext();
    const handler = new TaskHandler(ctx);

    await handler.handle({
      operation: 'create',
      name: 'Hello',
      workspaceName: 'Dev',
      assignee: 'Jane'
    } as any);

    expect(ctx.motionService.resolveUserIdentifier).toHaveBeenCalledWith(
      { userName: 'Jane' },
      'w1',
      { strictWorkspace: true }
    );
    expect(ctx.motionService.createTask).toHaveBeenCalledWith(expect.objectContaining({
      assigneeId: 'u-jane'
    }));
  });

  it("resolves the assigneeId 'me' shortcut to the current user on create", async () => {
    const ctx = makeContext();
    const handler = new TaskHandler(ctx);

    await handler.handle({
      operation: 'create',
      name: 'Hello',
      workspaceName: 'Dev',
      assigneeId: 'me'
    } as any);

    expect(ctx.motionService.getCurrentUser).toHaveBeenCalled();
    expect(ctx.motionService.createTask).toHaveBeenCalledWith(expect.objectContaining({
      assigneeId: 'me-id'
    }));
  });

  it('errors when a supplied assignee name cannot be resolved on create', async () => {
    const ctx = makeContext();
    (ctx.motionService.resolveUserIdentifier as any).mockResolvedValue(null);
    const handler = new TaskHandler(ctx);

    const res = await handler.handle({
      operation: 'create',
      name: 'Hello',
      workspaceName: 'Dev',
      assignee: 'Ghost'
    } as any);

    expect(res.isError).toBe(true);
    expect(ctx.motionService.createTask).not.toHaveBeenCalled();
    const text = (res.content?.[0] as any)?.text || '';
    expect(text).toContain('Ghost');
    expect(text).toContain('not found');
  });

  it('resolves an assignee name (cross-workspace) on update', async () => {
    const ctx = makeContext();
    const handler = new TaskHandler(ctx);

    await handler.handle({
      operation: 'update',
      taskId: 't1',
      assignee: 'Jane'
    } as any);

    expect(ctx.motionService.updateTask).toHaveBeenCalledWith('t1', expect.objectContaining({
      assigneeId: 'u-jane'
    }));
  });

  it("resolves the assigneeId 'me' shortcut on move", async () => {
    const ctx = makeContext();
    const handler = new TaskHandler(ctx);

    await handler.handle({
      operation: 'move',
      taskId: 't1',
      targetWorkspaceId: 'w2',
      assigneeId: 'me'
    } as any);

    expect(ctx.motionService.moveTask).toHaveBeenCalledWith('t1', 'w2', 'me-id');
  });
});
