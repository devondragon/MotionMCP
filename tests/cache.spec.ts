import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimpleCache } from '../src/utils/cache';

describe('SimpleCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('expires items after TTL', () => {
    const cache = new SimpleCache<number>(1, 100, { autoCleanup: false }); // 1s TTL
    cache.set('a', 42);
    expect(cache.get('a')).toBe(42);

    vi.setSystemTime(new Date('2024-01-01T00:00:02Z')); // +2s
    expect(cache.get('a')).toBeNull();
  });

  it('evicts least-recently-used when over capacity', () => {
    const cache = new SimpleCache<number>(60, 2, { autoCleanup: false });
    cache.set('k1', 1);
    cache.set('k2', 2);
    // Touch k1 to make it most-recently-used
    expect(cache.get('k1')).toBe(1);
    // Insert k3, should evict k2
    cache.set('k3', 3);

    expect(cache.get('k2')).toBeNull();
    expect(cache.get('k1')).toBe(1);
    expect(cache.get('k3')).toBe(3);
  });

  it('withCache caches success and propagates errors without caching', async () => {
    const cache = new SimpleCache<number>(60, 100, { autoCleanup: false });
    let calls = 0;
    const result = await cache.withCache('ok', async () => {
      calls += 1;
      return 7;
    });
    expect(result).toBe(7);
    const result2 = await cache.withCache('ok', async () => {
      calls += 1;
      return 8;
    });
    expect(result2).toBe(7);
    expect(calls).toBe(1);

    await expect(cache.withCache('err', async () => {
      throw new Error('boom');
    })).rejects.toThrow('boom');
    // Next call should still execute since previous error must not be cached
    let ran = false;
    await expect(cache.withCache('err', async () => {
      ran = true;
      return 1 as number;
    })).resolves.toBe(1);
    expect(ran).toBe(true);
  });
});

