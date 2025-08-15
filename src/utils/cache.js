// For mixed module systems, we'll use the compiled version
let mcpLog;
try {
  mcpLog = require('../../dist/utils/logger').mcpLog;
} catch (e) {
  // Fallback if logger not available
  mcpLog = (level, msg, extra) => {
    console.error(JSON.stringify({ level, msg, time: new Date().toISOString(), ...extra }));
  };
}

class SimpleCache {
  constructor(ttlSeconds = 300) { // 5 minutes default
    this.cache = new Map();
    this.ttl = ttlSeconds * 1000;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl
    });
  }

  get(key) {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  invalidate(pattern = null) {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    
    // Invalidate keys matching pattern
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  // Decorator for caching method results
  async withCache(key, fn) {
    const cached = this.get(key);
    if (cached !== null) {
      mcpLog('debug', 'Cache hit', { key });
      return cached;
    }
    
    const result = await fn();
    this.set(key, result);
    mcpLog('debug', 'Cache miss - storing', { key });
    return result;
  }
}

module.exports = SimpleCache;