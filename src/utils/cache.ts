import { mcpLog } from './logger';
import { LOG_LEVELS } from './constants';

interface CacheItem<T> {
  value: T;
  expiry: number;
}

export class SimpleCache<T = any> {
  private cache: Map<string, CacheItem<T>>;
  private ttlMs: number;
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(ttlSeconds: number = 300, maxSize: number = 1000, options: { autoCleanup?: boolean } = {}) {
    this.cache = new Map();
    this.ttlMs = ttlSeconds * 1000;
    this.maxSize = maxSize;

    // Set up automatic cleanup if requested
    if (options.autoCleanup !== false) { // Default to true for automatic cleanup
      // Run cleanup periodically at half the TTL interval for efficiency
      this.cleanupInterval = setInterval(() => this.cleanup(), Math.max(30000, this.ttlMs / 2));
      
      // Allow process to exit even if interval is active
      if (typeof this.cleanupInterval.unref === 'function') {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Destroy the cache and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }

  set(key: string, value: T): void {
    // Enforce size limit - remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
        mcpLog(LOG_LEVELS.DEBUG, 'Cache eviction - removed oldest entry', { 
          key: oldestKey,
          reason: 'maxSize',
          currentSize: this.cache.size 
        });
      }
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttlMs
    });
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    // Implement LRU: move accessed item to the end of insertion order
    // This makes it the "most recently used" item
    this.cache.delete(key);
    this.cache.set(key, item);
    
    return item.value;
  }

  invalidate(pattern: string | null = null): void {
    if (!pattern) {
      this.cache.clear();
      mcpLog(LOG_LEVELS.DEBUG, 'Cache cleared', { size: 0 });
      return;
    }
    
    // Invalidate keys matching pattern - use startsWith for precision
    let invalidatedCount = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }
    
    if (invalidatedCount > 0) {
      mcpLog(LOG_LEVELS.DEBUG, 'Cache invalidation', { 
        pattern, 
        invalidatedCount,
        remainingSize: this.cache.size 
      });
    }
  }

  // Decorator for caching method results with error handling
  async withCache(key: string, fn: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      mcpLog(LOG_LEVELS.DEBUG, 'Cache hit', { key });
      return cached;
    }
    
    try {
      const result = await fn();
      this.set(key, result);
      mcpLog(LOG_LEVELS.DEBUG, 'Cache miss - storing', { key });
      return result;
    } catch (error) {
      mcpLog(LOG_LEVELS.ERROR, 'Cache function failed', { 
        key, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  // Utility method to get cache statistics
  getStats(): { size: number; maxSize: number; ttlSeconds: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlSeconds: this.ttlMs / 1000
    };
  }

  // Clean up expired entries (can be called periodically if needed)
  cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      mcpLog(LOG_LEVELS.DEBUG, 'Cache cleanup', { 
        cleanedCount,
        remainingSize: this.cache.size 
      });
    }
  }
}

export default SimpleCache;
