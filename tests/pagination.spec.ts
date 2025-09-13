import { describe, it, expect } from 'vitest';
import { fetchAllPages } from '../src/utils/paginationNew';

function makeAxiosResponse(data: any) {
  return { data } as any;
}

describe('fetchAllPages', () => {
  it('accumulates across pages and stops when no nextCursor', async () => {
    const pages: Record<string, any> = {
      undefined: { meta: { nextCursor: '2', pageSize: 2 }, tasks: [1, 2] },
      '2': { meta: { pageSize: 1 }, tasks: [3] },
    };
    const fetchPage = async (cursor?: string) => makeAxiosResponse(pages[String(cursor)]);

    const res = await fetchAllPages<number>(fetchPage, 'tasks', { maxPages: 5, logProgress: false });
    expect(res.items).toEqual([1, 2, 3]);
    expect(res.hasMore).toBe(false);
    expect(res.totalFetched).toBe(3);
  });

  it('warn-safeguards cursor not advancing but still returns collected items', async () => {
    const pages: Record<string, any> = {
      undefined: { meta: { nextCursor: '1', pageSize: 2 }, tasks: [1, 2] },
      '1': { meta: { nextCursor: '1', pageSize: 1 }, tasks: [3] }, // same cursor -> should stop after this
    };
    const fetchPage = async (cursor?: string) => makeAxiosResponse(pages[String(cursor)]);

    const res = await fetchAllPages<number>(fetchPage, 'tasks', { maxPages: 5, logProgress: false });
    expect(res.items).toEqual([1, 2, 3]);
    expect(res.hasMore).toBe(false);
  });
});

