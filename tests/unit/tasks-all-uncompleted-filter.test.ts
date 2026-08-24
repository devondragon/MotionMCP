import { describe, it, expect, vi } from 'vitest';
import { getAllUncompletedTasks } from '../../src/services/api/tasks';
import type { ResourceContext } from '../../src/services/api/types';

// Two workspaces, each with its own task set. getAllUncompletedTasks fetches /workspaces
// then /tasks?workspaceId=... per workspace and applies dueDate/priority via getTasks.
function makeMockCtx(workspaces: Array<{ id: string; name: string }>, tasksByWs: Record<string, any[]>) {
  const get = vi.fn().mockImplementation((url: string) => {
    if (url.startsWith('/workspaces')) {
      return Promise.resolve({ data: { workspaces }, status: 200, statusText: 'OK', headers: {}, config: {} });
    }
    const params = new URLSearchParams(url.split('?')[1] || '');
    const wsId = params.get('workspaceId') || '';
    return Promise.resolve({
      data: { meta: { pageSize: 20 }, tasks: tasksByWs[wsId] || [] },
      status: 200, statusText: 'OK', headers: {}, config: {},
    });
  });

  const ctx = {
    api: {
      client: { get } as any,
      requestWithRetry: vi.fn().mockImplementation((fn: () => any) => fn()),
      validateResponse: (data: unknown) => data,
      mergeTruncationMetadata: (a: unknown, b: unknown) => b || a,
      formatApiError: (e: unknown) => e,
    } as any,
    cache: { workspace: { withCache: (_k: string, fn: () => any) => fn() } } as any,
  } as ResourceContext;

  return { ctx, get };
}

const workspaces = [{ id: 'ws1', name: 'One' }, { id: 'ws2', name: 'Two' }];
const tasksByWs = {
  ws1: [
    { id: 'A', name: 'A', status: 'Todo', priority: 'HIGH', dueDate: '2026-08-25T05:59:59.999Z' }, // Denver 08-24
    { id: 'B', name: 'B', status: 'Todo', priority: 'MEDIUM', dueDate: '2026-09-10T05:59:59.999Z' }, // future
  ],
  ws2: [
    { id: 'C', name: 'C', status: 'Todo', priority: 'HIGH', dueDate: '2026-08-20T06:00:00.000Z' }, // Denver 08-20
    { id: 'D', name: 'D', status: 'Todo', priority: 'HIGH', dueDate: null }, // no due date
  ],
};

describe('getAllUncompletedTasks cross-workspace filtering', () => {
  it('honors dueDate across workspaces (on or before, account zone)', async () => {
    const { ctx } = makeMockCtx(workspaces, tasksByWs);
    const result = await getAllUncompletedTasks(ctx, { assigneeId: 'me', dueDate: '2026-08-24', timeZone: 'America/Denver' });
    const ids = result.items.map((t: any) => t.id).sort();
    expect(ids).toEqual(['A', 'C']); // B is future, D has no due date
  });

  it('honors priority across workspaces', async () => {
    const { ctx } = makeMockCtx(workspaces, tasksByWs);
    const result = await getAllUncompletedTasks(ctx, { assigneeId: 'me', priority: 'HIGH' });
    const ids = result.items.map((t: any) => t.id).sort();
    expect(ids).toEqual(['A', 'C', 'D']); // all HIGH, no date filter
  });

  it('combines dueDate and priority', async () => {
    const { ctx } = makeMockCtx(workspaces, tasksByWs);
    const result = await getAllUncompletedTasks(ctx, {
      assigneeId: 'me', priority: 'HIGH', dueDate: '2026-08-24', timeZone: 'America/Denver',
    });
    const ids = result.items.map((t: any) => t.id).sort();
    expect(ids).toEqual(['A', 'C']);
  });

  it('returns all uncompleted when no filters given', async () => {
    const { ctx } = makeMockCtx(workspaces, tasksByWs);
    const result = await getAllUncompletedTasks(ctx, { assigneeId: 'me' });
    const ids = result.items.map((t: any) => t.id).sort();
    expect(ids).toEqual(['A', 'B', 'C', 'D']);
  });
});
