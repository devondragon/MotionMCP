# Task 4.1: Enhanced Error Handling with Retry Logic

**Priority:** Implementation Improvements (Priority 4)
**Status:** Current

**Purpose:** Improve reliability and user experience

## Implementation Details

### 1. Create `src/utils/retryHandler.js`:

```javascript
const mcpLog = require('./logger');

class RetryHandler {
  constructor(maxRetries = 3, baseDelay = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
  }

  async executeWithRetry(fn, context = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
          throw error;
        }
        
        if (attempt < this.maxRetries) {
          const delay = this.calculateDelay(attempt, error);
          mcpLog('info', `Retrying after ${delay}ms`, {
            attempt,
            maxRetries: this.maxRetries,
            error: error.message,
            ...context
          });
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  calculateDelay(attempt, error) {
    // Check for rate limit headers
    if (error.response?.headers['retry-after']) {
      const retryAfter = error.response.headers['retry-after'];
      return parseInt(retryAfter) * 1000;
    }
    
    // Exponential backoff with jitter
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000;
    return exponentialDelay + jitter;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RetryHandler;
```

### 2. Update `src/services/motionApi.js` to use retry handler:

```javascript
const RetryHandler = require('../utils/retryHandler');

class MotionApiService {
  constructor() {
    // ... existing code ...
    this.retryHandler = new RetryHandler(3, 1000);
  }

  async getProjects(workspaceId = null) {
    return this.retryHandler.executeWithRetry(
      async () => {
        // ... existing getProjects implementation ...
      },
      { method: 'getProjects', workspaceId }
    );
  }
  
  // Apply to all methods
}
```