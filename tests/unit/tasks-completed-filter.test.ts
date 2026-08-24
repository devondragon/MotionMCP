import { describe, it, expect, vi } from 'vitest';
import { getTasks } from '../../src/services/api/tasks';
import type { ResourceContext } from '../../src/services/api/types';

function makeMockCtx(tasks: Array<Record<string, unknown>>) {
  const get = vi.fn().mockResolvedValue({
    data: { meta: { pageSize: 20 }, tasks },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any,
  });
  return {
    ctx: {
      api: {
        client: { get } as any,
        requestWithRetry: vi.fn().mockImplementation((fn: () => any) => fn()),
      } as any,
      cache: {} as any,
    } as ResourceContext,
    get,
  };
}

describe('getTasks completion-date filtering', () => {
  // completedTime is a UTC instant; the bounds are local calendar dates. Denver = UTC-6 (MDT).
  const tasks = [
    { id: 'early', name: 'a', completed: true, completedTime: '2026-08-16T10:00:00.000Z' }, // Denver 08-16
    { id: 'mid', name: 'b', completed: true, completedTime: '2026-08-20T18:00:00.000Z' }, // Denver 08-20
    { id: 'late', name: 'c', completed: true, completedTime: '2026-08-25T05:00:00.000Z' }, // Denver 08-24 23:00
    { id: 'open', name: 'd', completed: false }, // never completed
  ];

  it('keeps tasks completed on or after completedAfter (account zone)', async () => {
    const { ctx } = makeMockCtx(tasks);
    const result = await getTasks(ctx, { completedAfter: '2026-08-18', timeZone: 'America/Denver' });
    const ids = result.items.map((t: any) => t.id).sort();
    expect(ids).toEqual(['late', 'mid']);
  });

  it('keeps tasks completed on or before completedBefore (account zone)', async () => {
    const { ctx } = makeMockCtx(tasks);
    const result = await getTasks(ctx, { completedBefore: '2026-08-20', timeZone: 'America/Denver' });
    const ids = result.items.map((t: any) => t.id).sort();
    expect(ids).toEqual(['early', 'mid']);
  });

  it('bounds a completion window with both ends inclusive', async () => {
    const { ctx } = makeMockCtx(tasks);
    const result = await getTasks(ctx, {
      completedAfter: '2026-08-18',
      completedBefore: '2026-08-22',
      timeZone: 'America/Denver',
    });
    const ids = result.items.map((t: any) => t.id);
    expect(ids).toEqual(['mid']);
  });

  it('excludes tasks with no completedTime', async () => {
    const { ctx } = makeMockCtx(tasks);
    const result = await getTasks(ctx, { completedAfter: '2000-01-01', timeZone: 'America/Denver' });
    const ids = result.items.map((t: any) => t.id);
    expect(ids).not.toContain('open');
  });

  it('implies includeAllStatuses in the fetch so completed tasks are present', async () => {
    const { ctx, get } = makeMockCtx(tasks);
    await getTasks(ctx, { completedAfter: '2026-08-18', timeZone: 'America/Denver' });
    const url = get.mock.calls[0][0] as string;
    expect(url).toContain('includeAllStatuses=true');
  });
});
