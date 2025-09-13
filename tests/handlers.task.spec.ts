import { describe, it, expect, vi } from 'vitest';
import { TaskHandler } from '../src/handlers';
import type { HandlerContext } from '../src/handlers/base/HandlerInterface';

function makeContext(overrides: Partial<HandlerContext> = {}): HandlerContext {
  const motionService = {
    createTask: vi.fn().mockResolvedValue({ id: 't1', name: 'Hello' }),
    getTasks: vi.fn().mockResolvedValue([
      { id: 't1', name: 'A' },
      { id: 't2', name: 'B' },
    ]),
    getTask: vi.fn().mockResolvedValue({ id: 't1', name: 'A' }),
    updateTask: vi.fn().mockResolvedValue({ id: 't1', name: 'New' }),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    moveTask: vi.fn().mockResolvedValue({ id: 't1', name: 'A' }),
    unassignTask: vi.fn().mockResolvedValue({ id: 't1', name: 'A' }),
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
  it('creates a task using resolved workspace', async () => {
    const ctx = makeContext();
    const handler = new TaskHandler(ctx);
    const res = await handler.handle({ operation: 'create', name: 'Hello', workspaceName: 'Dev' } as any);

    expect(ctx.workspaceResolver.resolveWorkspace).toHaveBeenCalled();
    expect(ctx.motionService.createTask).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Hello',
      workspaceId: 'w1',
    }));

    const text = (res.content?.[0] as any)?.text || '';
    expect(text).toContain('Successfully created task');
    expect(text).toContain('Hello');
  });

  it('lists tasks and formats response', async () => {
    const ctx = makeContext();
    const handler = new TaskHandler(ctx);
    const res = await handler.handle({ operation: 'list', workspaceName: 'Dev', limit: 10 } as any);

    expect(ctx.motionService.getTasks).toHaveBeenCalledWith('w1', undefined, 5, 10);
    const text = (res.content?.[0] as any)?.text || '';
    expect(text).toContain('Found 2 tasks');
    expect(text).toContain('(ID: t1)');
    expect(text).toContain('(ID: t2)');
  });

  it('updates a task and returns success text', async () => {
    const ctx = makeContext();
    const handler = new TaskHandler(ctx);
    const res = await handler.handle({ operation: 'update', taskId: 't1', name: 'New' } as any);

    expect(ctx.motionService.updateTask).toHaveBeenCalledWith('t1', expect.objectContaining({ name: 'New' }));
    const text = (res.content?.[0] as any)?.text || '';
    expect(text).toContain('Successfully updated task');
  });
});

