import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimpleCache } from '../../src/utils/cache';

describe('SimpleCache', () => {
  let cache: SimpleCache<string>;

  beforeEach(() => {
    vi.useFakeTimers();
    // Disable auto cleanup by setting autoCleanup: false
    cache = new SimpleCache<string>(60, 100, { autoCleanup: false });
  });

  afterEach(() => {
    cache.destroy();
    vi.useRealTimers();
  });

  describe('basic get/set operations', () => {
    it('stores and retrieves values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('returns null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('overwrites existing values', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });

    it('stores multiple keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
    });
  });

  describe('TTL expiry', () => {
    it('returns value before TTL expires', () => {
      cache.set('key1', 'value1');
      vi.advanceTimersByTime(59 * 1000); // 59 seconds
      expect(cache.get('key1')).toBe('value1');
    });

    it('returns null after TTL expires', () => {
      cache.set('key1', 'value1');
      vi.advanceTimersByTime(61 * 1000); // 61 seconds (TTL is 60)
      expect(cache.get('key1')).toBeNull();
    });

    it('removes expired entry on get', () => {
      cache.set('key1', 'value1');
      vi.advanceTimersByTime(61 * 1000);
      cache.get('key1'); // This should remove it
      expect(cache.getStats().size).toBe(0);
    });

    it('respects custom TTL', () => {
      const shortCache = new SimpleCache<string>(5, 100, { autoCleanup: false });
      shortCache.set('key1', 'value1');

      vi.advanceTimersByTime(4 * 1000);
      expect(shortCache.get('key1')).toBe('value1');

      vi.advanceTimersByTime(2 * 1000);
      expect(shortCache.get('key1')).toBeNull();

      shortCache.destroy();
    });
  });

  describe('LRU eviction', () => {
    it('evicts oldest entry when at capacity', () => {
      const smallCache = new SimpleCache<string>(60, 3, { autoCleanup: false });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');

      // All three should be present
      expect(smallCache.getStats().size).toBe(3);

      // Add fourth, should evict key1 (oldest)
      smallCache.set('key4', 'value4');

      expect(smallCache.get('key1')).toBeNull();
      expect(smallCache.get('key2')).toBe('value2');
      expect(smallCache.get('key3')).toBe('value3');
      expect(smallCache.get('key4')).toBe('value4');

      smallCache.destroy();
    });

    it('does not evict when updating existing key', () => {
      const smallCache = new SimpleCache<string>(60, 3, { autoCleanup: false });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');

      // Update existing key should not trigger eviction
      smallCache.set('key2', 'updated');

      expect(smallCache.get('key1')).toBe('value1');
      expect(smallCache.get('key2')).toBe('updated');
      expect(smallCache.get('key3')).toBe('value3');

      smallCache.destroy();
    });
  });

  describe('LRU promotion on access', () => {
    it('promotes accessed items to most recently used', () => {
      const smallCache = new SimpleCache<string>(60, 3, { autoCleanup: false });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');

      // Access key1, making it most recently used
      smallCache.get('key1');

      // Add key4, should evict key2 (now oldest)
      smallCache.set('key4', 'value4');

      expect(smallCache.get('key1')).toBe('value1'); // Was promoted
      expect(smallCache.get('key2')).toBeNull(); // Was evicted
      expect(smallCache.get('key3')).toBe('value3');
      expect(smallCache.get('key4')).toBe('value4');

      smallCache.destroy();
    });
  });

  describe('invalidation', () => {
    it('clears entire cache with null pattern', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.invalidate(null);

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
      expect(cache.getStats().size).toBe(0);
    });

    it('clears entire cache with no argument', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.invalidate();

      expect(cache.getStats().size).toBe(0);
    });

    it('invalidates keys matching prefix pattern', () => {
      cache.set('tasks:123', 'task1');
      cache.set('tasks:456', 'task2');
      cache.set('projects:789', 'project1');

      cache.invalidate('tasks:');

      expect(cache.get('tasks:123')).toBeNull();
      expect(cache.get('tasks:456')).toBeNull();
      expect(cache.get('projects:789')).toBe('project1');
    });

    it('does nothing when pattern matches no keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.invalidate('nonexistent:');

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
    });
  });

  describe('withCache', () => {
    it('returns cached value on hit', async () => {
      cache.set('key1', 'cached');
      const fn = vi.fn().mockResolvedValue('fresh');

      const result = await cache.withCache('key1', fn);

      expect(result).toBe('cached');
      expect(fn).not.toHaveBeenCalled();
    });

    it('calls function and caches result on miss', async () => {
      const fn = vi.fn().mockResolvedValue('fresh');

      const result = await cache.withCache('key1', fn);

      expect(result).toBe('fresh');
      expect(fn).toHaveBeenCalledOnce();
      expect(cache.get('key1')).toBe('fresh');
    });

    it('rethrows function errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(cache.withCache('key1', fn)).rejects.toThrow('Test error');
      expect(cache.get('key1')).toBeNull(); // Should not be cached
    });

    it('does not cache on error', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      try {
        await cache.withCache('key1', fn);
      } catch {
        // Expected
      }

      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('returns correct size', () => {
      expect(cache.getStats().size).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.getStats().size).toBe(1);

      cache.set('key2', 'value2');
      expect(cache.getStats().size).toBe(2);
    });

    it('returns maxSize', () => {
      expect(cache.getStats().maxSize).toBe(100);
    });

    it('returns ttlSeconds', () => {
      expect(cache.getStats().ttlSeconds).toBe(60);
    });
  });

  describe('cleanup', () => {
    it('removes expired entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      // Advance past TTL
      vi.advanceTimersByTime(61 * 1000);

      // Add a new entry that won't be expired
      cache.set('key3', 'value3');

      cache.cleanup();

      // key1 and key2 should be cleaned up, key3 should remain
      expect(cache.getStats().size).toBe(1);
      expect(cache.get('key3')).toBe('value3');
    });

    it('does nothing when no entries expired', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.cleanup();

      expect(cache.getStats().size).toBe(2);
    });
  });

  describe('destroy', () => {
    it('clears cache on destroy', () => {
      cache.set('key1', 'value1');
      cache.destroy();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('auto cleanup interval', () => {
    it('runs cleanup automatically when enabled', () => {
      const autoCache = new SimpleCache<string>(60, 100, { autoCleanup: true });

      autoCache.set('key1', 'value1');

      // Advance past TTL to expire the entry
      vi.advanceTimersByTime(61 * 1000);

      // Advance a full TTL cycle (60s) to ensure cleanup runs
      // This is more robust than assuming the internal 30s interval
      vi.advanceTimersByTime(60 * 1000);

      // The key should be removed by auto cleanup
      expect(autoCache.getStats().size).toBe(0);

      autoCache.destroy();
    });
  });
});
