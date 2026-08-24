import { describe, it, expect, vi } from 'vitest';
import { getTasks } from '../../src/services/api/tasks';
import type { ResourceContext } from '../../src/services/api/types';

function makeMockCtx(tasks: Array<{ id: string; name: string; dueDate?: string }>): ResourceContext {
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

describe('getTasks dueDate filtering', () => {
  // Motion returns dueDate as a UTC instant. For an account west of UTC, a task
  // due end-of-day local time carries a UTC calendar date of the NEXT day.
  // America/Denver on 2026-08-24 is MDT (UTC-6), so 23:59:59 local -> 05:59:59Z
  // on 2026-08-25.
  const denverTasks = [
    { id: 'overdue', name: 'BeauTeas', dueDate: '2026-08-20T16:00:00.000Z' }, // Aug 20 local
    { id: 'today-late', name: 'chicken and rice', dueDate: '2026-08-25T05:59:59.000Z' }, // Aug 24 23:59 local
    { id: 'tomorrow-late', name: 'next day', dueDate: '2026-08-26T05:59:59.000Z' }, // Aug 25 23:59 local
  ];

  it('includes same-day tasks whose UTC date rolls to the next day (negative offset)', async () => {
    const ctx = makeMockCtx(denverTasks);
    const result = await getTasks(ctx, { dueDate: '2026-08-24', timeZone: 'America/Denver' });

    const ids = result.items.map((t: any) => t.id);
    expect(ids).toContain('today-late'); // must not be silently dropped
  });

  it('returns tasks due on or before the filter date, including overdue', async () => {
    const ctx = makeMockCtx(denverTasks);
    const result = await getTasks(ctx, { dueDate: '2026-08-24', timeZone: 'America/Denver' });

    const ids = result.items.map((t: any) => t.id).sort();
    expect(ids).toEqual(['overdue', 'today-late']);
  });

  it('excludes tasks due after the filter date', async () => {
    const ctx = makeMockCtx(denverTasks);
    const result = await getTasks(ctx, { dueDate: '2026-08-24', timeZone: 'America/Denver' });

    const ids = result.items.map((t: any) => t.id);
    expect(ids).not.toContain('tomorrow-late');
  });

  it('falls back to the UTC date portion when no timeZone is supplied', async () => {
    const ctx = makeMockCtx(denverTasks);
    const result = await getTasks(ctx, { dueDate: '2026-08-24' });

    // Without a zone, comparison is on the raw UTC date: only the Aug 20 task qualifies.
    const ids = result.items.map((t: any) => t.id);
    expect(ids).toEqual(['overdue']);
  });

  it('skips tasks with no dueDate', async () => {
    const ctx = makeMockCtx([
      { id: 'no-due', name: 'someday' },
      ...denverTasks,
    ]);
    const result = await getTasks(ctx, { dueDate: '2026-08-24', timeZone: 'America/Denver' });

    const ids = result.items.map((t: any) => t.id);
    expect(ids).not.toContain('no-due');
  });
});
