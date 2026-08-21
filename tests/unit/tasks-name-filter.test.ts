import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTasks } from '../../src/services/api/tasks';
import type { ResourceContext } from '../../src/services/api/types';

function makeMockCtx(tasks: Array<{ id: string; name: string }>): ResourceContext {
  const wrappedResponse = {
    data: {
      meta: { pageSize: 20 },
      tasks,
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any,
  };

  return {
    api: {
      client: { get: vi.fn().mockResolvedValue(wrappedResponse) } as any,
      requestWithRetry: vi.fn().mockImplementation((fn: () => any) => fn()),
    } as any,
    cache: {} as any,
  };
}

describe('getTasks name filtering', () => {
  const sampleTasks = [
    { id: 't1', name: 'Deploy dashboard' },
    { id: 't2', name: 'Fix login bug' },
    { id: 't3', name: 'Dashboard redesign' },
  ];

  it('filters by name client-side (case-insensitive substring)', async () => {
    const ctx = makeMockCtx(sampleTasks);
    const result = await getTasks(ctx, { name: 'dashboard' });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((t: any) => t.id)).toEqual(['t1', 't3']);
  });

  it('does not send name as a query parameter to the API', async () => {
    const ctx = makeMockCtx(sampleTasks);
    await getTasks(ctx, { name: 'dashboard' });

    const getCall = (ctx.api.client.get as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(getCall).not.toContain('name=');
  });

  it('handles projectId + name + includeAllStatuses without hanging', async () => {
    const ctx = makeMockCtx(sampleTasks);
    const result = await getTasks(ctx, {
      projectId: 'p1',
      name: 'dashboard',
      includeAllStatuses: true,
    });

    expect(result.items).toHaveLength(2);
    const getCall = (ctx.api.client.get as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(getCall).toContain('projectId=p1');
    expect(getCall).toContain('includeAllStatuses=true');
    expect(getCall).not.toContain('name=');
  });

  it('returns all tasks when no name filter is provided', async () => {
    const ctx = makeMockCtx(sampleTasks);
    const result = await getTasks(ctx, {});

    expect(result.items).toHaveLength(3);
  });

  it('returns empty when name matches nothing', async () => {
    const ctx = makeMockCtx(sampleTasks);
    const result = await getTasks(ctx, { name: 'nonexistent' });

    expect(result.items).toHaveLength(0);
  });
});
