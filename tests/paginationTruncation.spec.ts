/**
 * Truncation coverage for fetchAllPages (issue #136).
 *
 * The existing tests/pagination.spec.ts covers happy-path accumulation and the
 * cursor-not-advancing guard. This spec pins the three truncation reasons and
 * the returnedCount they report:
 *   - page_size_limit: a single oversized page is sliced to MAX_PAGE_SIZE and
 *     pagination STOPS rather than advancing the cursor (which would silently
 *     drop items 201+ of that page).
 *   - max_items: the caller's item cap stops pagination, and takes precedence
 *     over page_size_limit when both fire in the same iteration.
 *   - max_pages: the page-count ceiling stops pagination.
 *
 * 'tasks' is a wrapped endpoint: unwrapApiResponse reads { meta, tasks }.
 */
import { describe, it, expect } from 'vitest';
import { fetchAllPages } from '../src/utils/paginationNew';
import { LIMITS } from '../src/utils/constants';

function makeAxiosResponse(data: any) {
  return { data } as any;
}

/** A wrapped Motion task page with an optional nextCursor. */
function taskPage(count: number, nextCursor?: string) {
  const tasks = Array.from({ length: count }, (_, i) => i);
  return { meta: nextCursor ? { nextCursor } : {}, tasks };
}

describe('fetchAllPages truncation', () => {
  it('stops on an oversized page instead of advancing the cursor, and reports the returned count', async () => {
    // First page is larger than MAX_PAGE_SIZE and carries a nextCursor. The
    // oversized page must be sliced and pagination must stop; the second page
    // must never be fetched.
    const fetched: Array<string | undefined> = [];
    const pages: Record<string, any> = {
      undefined: taskPage(LIMITS.MAX_PAGE_SIZE + 50, 'page-2'),
      'page-2': taskPage(5)
    };
    const fetchPage = async (cursor?: string) => {
      fetched.push(cursor);
      return makeAxiosResponse(pages[String(cursor)]);
    };

    const res = await fetchAllPages<number>(fetchPage, 'tasks', { logProgress: false });

    expect(res.items).toHaveLength(LIMITS.MAX_PAGE_SIZE);
    expect(res.hasMore).toBe(false);
    expect(fetched).toEqual([undefined]); // page-2 was never requested
    expect(res.truncation).toEqual({
      wasTruncated: true,
      returnedCount: LIMITS.MAX_PAGE_SIZE,
      reason: 'page_size_limit',
      limit: LIMITS.MAX_PAGE_SIZE
    });
    // returnedCount reflects what was actually returned, not 0.
    expect(res.truncation?.returnedCount).toBe(res.items.length);
  });

  it('stops at max_items and reports the returned count', async () => {
    // Two full-size pages available; maxItems caps collection below one page.
    const pages: Record<string, any> = {
      undefined: taskPage(10, 'page-2'),
      'page-2': taskPage(10)
    };
    const fetchPage = async (cursor?: string) => makeAxiosResponse(pages[String(cursor)]);

    const res = await fetchAllPages<number>(fetchPage, 'tasks', {
      logProgress: false,
      maxItems: 4
    });

    expect(res.items).toHaveLength(4);
    expect(res.hasMore).toBe(false);
    expect(res.truncation).toEqual({
      wasTruncated: true,
      returnedCount: 4,
      reason: 'max_items',
      limit: 4
    });
  });

  it('lets max_items take precedence over page_size_limit when both fire in one iteration', async () => {
    // A single oversized page also exceeds maxItems. The slice trims to
    // MAX_PAGE_SIZE, then the maxItems cap trims further; the recorded reason
    // must be max_items, not page_size_limit.
    const maxItems = LIMITS.MAX_PAGE_SIZE - 10;
    const pages: Record<string, any> = {
      undefined: taskPage(LIMITS.MAX_PAGE_SIZE + 50, 'page-2')
    };
    const fetchPage = async (cursor?: string) => makeAxiosResponse(pages[String(cursor)]);

    const res = await fetchAllPages<number>(fetchPage, 'tasks', {
      logProgress: false,
      maxItems
    });

    expect(res.items).toHaveLength(maxItems);
    expect(res.hasMore).toBe(false);
    expect(res.truncation?.reason).toBe('max_items');
    expect(res.truncation?.returnedCount).toBe(maxItems);
    expect(res.truncation?.limit).toBe(maxItems);
  });

  it('stops at max_pages when every page keeps advancing the cursor', async () => {
    // Each page hands back a fresh cursor forever; maxPages bounds the fetch.
    const maxPages = 3;
    let n = 0;
    const fetchPage = async (_cursor?: string) => {
      n += 1;
      return makeAxiosResponse(taskPage(2, `cursor-${n}`));
    };

    const res = await fetchAllPages<number>(fetchPage, 'tasks', {
      logProgress: false,
      maxPages
    });

    expect(res.items).toHaveLength(maxPages * 2);
    expect(res.hasMore).toBe(false);
    expect(res.truncation).toEqual({
      wasTruncated: true,
      returnedCount: maxPages * 2,
      reason: 'max_pages',
      limit: maxPages
    });
  });

  it('stops when the cursor does not advance, with no truncation record', async () => {
    // Guard duplication of the existing spec, but assert the outcome shape:
    // collected items are returned and no truncation reason is attached.
    const pages: Record<string, any> = {
      undefined: taskPage(2, 'stuck'),
      stuck: { meta: { nextCursor: 'stuck' }, tasks: [9] }
    };
    const fetchPage = async (cursor?: string) => makeAxiosResponse(pages[String(cursor)]);

    const res = await fetchAllPages<number>(fetchPage, 'tasks', { logProgress: false });

    expect(res.items).toHaveLength(3);
    expect(res.hasMore).toBe(false);
    expect(res.truncation).toBeUndefined();
  });
});
