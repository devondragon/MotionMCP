# Task 4.3: Implement Caching Layer

**Priority:** Implementation Improvements (Priority 4)
**Status:** Current

**Purpose:** Reduce API calls and improve performance

## Implementation Details

### 1. Create `src/utils/cache.js`:

```javascript
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
```

### 2. Apply caching in `src/services/motionApi.js`:

```javascript
const SimpleCache = require('../utils/cache');

class MotionApiService {
  constructor() {
    // ... existing code ...
    this.workspaceCache = new SimpleCache(600); // 10 minutes for workspaces
    this.userCache = new SimpleCache(600); // 10 minutes for users
    this.projectCache = new SimpleCache(300); // 5 minutes for projects
  }

  async getWorkspaces() {
    return this.workspaceCache.withCache('workspaces', async () => {
      // ... existing implementation ...
    });
  }

  async getUsers() {
    return this.userCache.withCache('users', async () => {
      // ... existing implementation ...
    });
  }

  // Invalidate cache on updates
  async createProject(projectData) {
    const result = await this._createProject(projectData); // actual implementation
    this.projectCache.invalidate(`workspace:${projectData.workspaceId}`);
    return result;
  }
}
```