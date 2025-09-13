import { describe, it, expect } from 'vitest';
import { unwrapApiResponse } from '../src/utils/responseWrapper';

describe('unwrapApiResponse', () => {
  it('handles wrapped responses with meta (tasks)', () => {
    const resp = {
      meta: { nextCursor: '2', pageSize: 2 },
      tasks: [{ id: '1' }, { id: '2' }],
    };
    const unwrapped = unwrapApiResponse(resp, 'tasks');
    expect(unwrapped.data.length).toBe(2);
    expect(unwrapped.meta?.nextCursor).toBe('2');
  });

  it('handles direct arrays (workspaces)', () => {
    const resp = [{ id: 'w1' }, { id: 'w2' }];
    const unwrapped = unwrapApiResponse(resp, 'workspaces');
    expect(unwrapped.data.length).toBe(2);
    expect(unwrapped.meta).toBeUndefined();
  });

  it('falls back to array payload for unknown endpoints', () => {
    const resp = [{ id: 'x' }];
    const unwrapped = unwrapApiResponse(resp, 'unknown-endpoint');
    expect(unwrapped.data.length).toBe(1);
  });
});

