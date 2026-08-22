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

  it("scopes assignee-name resolution on update to the task's actual workspace instead of a cross-workspace scan", async () => {
    const ctx = makeContext();
    ctx.motionService.getTask = vi.fn().mockResolvedValue({ id: 't1', name: 'A', workspaceId: 'w1' });
    // Two different "Jane"s in two workspaces; only the task's own workspace (w1) should resolve.
    ctx.motionService.resolveUserIdentifier = vi.fn().mockImplementation((_ident: unknown, workspaceId: string) =>
      Promise.resolve(
        workspaceId === 'w1' ? { id: 'u-jane-w1', name: 'Jane', email: 'jane@w1.example.com' } : null
      )
    );
    const handler = new TaskHandler(ctx);

    await handler.handle({
      operation: 'update',
      taskId: 't1',
      assignee: 'Jane'
      // no workspaceId supplied — must be scoped via the task's own workspace, not a cross-workspace scan
    } as any);

    expect(ctx.motionService.getTask).toHaveBeenCalledWith('t1');
    expect(ctx.motionService.resolveUserIdentifier).toHaveBeenCalledWith(
      { userName: 'Jane' },
      'w1',
      { strictWorkspace: true }
    );
    expect(ctx.motionService.getWorkspaces).not.toHaveBeenCalled();
    expect(ctx.motionService.updateTask).toHaveBeenCalledWith('t1', expect.objectContaining({
      assigneeId: 'u-jane-w1'
    }));
  });

  it('scopes assignee-name resolution on move to the destination workspace, not a cross-workspace scan', async () => {
    const ctx = makeContext();
    // Two different "Jane"s in two workspaces; only the destination workspace (w2) should resolve.
    ctx.motionService.resolveUserIdentifier = vi.fn().mockImplementation((_ident: unknown, workspaceId: string) =>
      Promise.resolve(
        workspaceId === 'w2' ? { id: 'u-jane-w2', name: 'Jane', email: 'jane@w2.example.com' } : null
      )
    );
    const handler = new TaskHandler(ctx);

    await handler.handle({
      operation: 'move',
      taskId: 't1',
      targetWorkspaceId: 'w2',
      assignee: 'Jane'
    } as any);

    expect(ctx.motionService.resolveUserIdentifier).toHaveBeenCalledWith(
      { userName: 'Jane' },
      'w2',
      { strictWorkspace: true }
    );
    expect(ctx.motionService.getWorkspaces).not.toHaveBeenCalled();
    expect(ctx.motionService.moveTask).toHaveBeenCalledWith('t1', 'w2', 'u-jane-w2');
  });
});
