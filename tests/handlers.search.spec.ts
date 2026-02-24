import { describe, it, expect, vi } from 'vitest';
import { SearchHandler } from '../src/handlers';
import type { HandlerContext } from '../src/handlers/base/HandlerInterface';

function makeContext(): HandlerContext {
  const motionService = {
    searchTasks: vi.fn().mockResolvedValue({
      items: [{ id: 't1', name: 'Task', projectId: 'p1' }],
      truncation: undefined,
    }),
    searchProjects: vi.fn().mockResolvedValue({
      items: [{ id: 'p1', name: 'Project', description: '', workspaceId: 'w1' }],
      truncation: undefined,
    }),
  } as any;

  const workspaceResolver = {
    resolveWorkspace: vi.fn().mockResolvedValue({ id: 'w1', name: 'Dev' }),
  } as any;

  return {
    motionService,
    workspaceResolver,
    validator: {} as any,
  } as HandlerContext;
}

describe('SearchHandler', () => {
  it('performs content search across tasks and projects', async () => {
    const ctx = makeContext();
    const handler = new SearchHandler(ctx);
    const res = await handler.handle({ operation: 'content', query: 'foo', searchScope: 'both', limit: 5, workspaceName: 'Dev' } as any);
    const text = (res.content?.[0] as any)?.text || '';
    expect(ctx.motionService.searchTasks).toHaveBeenCalledWith('foo', 'w1', 5);
    expect(ctx.motionService.searchProjects).toHaveBeenCalledWith('foo', 'w1', 5);
    expect(text).toContain('Search Results for "foo"');
    expect(text).toContain('[task]');
    expect(text).toContain('[project]');
  });

  it('respects tasks-only scope for content search', async () => {
    const ctx = makeContext();
    const handler = new SearchHandler(ctx);

    const res = await handler.handle({
      operation: 'content',
      query: 'foo',
      searchScope: 'tasks',
      limit: 5,
      workspaceName: 'Dev'
    } as any);

    const text = (res.content?.[0] as any)?.text || '';
    expect(ctx.motionService.searchTasks).toHaveBeenCalledWith('foo', 'w1', 5);
    expect(ctx.motionService.searchProjects).not.toHaveBeenCalled();
    expect(text).toContain('[task]');
    expect(text).not.toContain('[project]');
  });

  it('does not mutate per-source truncation metadata during merge', async () => {
    const ctx = makeContext();
    const sourceTruncation = { wasTruncated: true, returnedCount: 50, reason: 'max_pages', limit: 50 } as const;
    ctx.motionService.searchTasks.mockResolvedValueOnce({
      items: [{ id: 't1', name: 'Task' }],
      truncation: sourceTruncation,
    });
    const handler = new SearchHandler(ctx);

    await handler.handle({
      operation: 'content',
      query: 'foo',
      searchScope: 'tasks',
      limit: 5,
      workspaceName: 'Dev'
    } as any);

    expect(sourceTruncation.returnedCount).toBe(50);
  });
});
