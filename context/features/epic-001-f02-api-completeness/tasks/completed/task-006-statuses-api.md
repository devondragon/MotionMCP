# Task 3.2: Implement Statuses API

**Priority:** Additional API Features (Priority 3)
**Status:** Completed - 2025-08-15

**Endpoint:** GET /statuses  
**Purpose:** Get available workflow states

## Implementation Details

### 1. Add to `src/services/motionApi.js`:

```javascript
async getStatuses(workspaceId = null) {
  try {
    const params = workspaceId ? `?workspaceId=${workspaceId}` : '';
    const response = await this.client.get(`/statuses${params}`);
    return response.data?.statuses || response.data || [];
  } catch (error) {
    mcpLog('error', 'Failed to fetch statuses', {
      method: 'getStatuses',
      workspaceId,
      error: error.message
    });
    throw new Error(`Failed to fetch statuses: ${error.message}`);
  }
}
```

### 2. Add tool in `src/mcp-server.js`:

```javascript
{
  name: "motion_statuses",
  description: "Get available task/project statuses",
  inputSchema: {
    type: "object",
    properties: {
      workspaceId: { type: "string", description: "Workspace ID to get statuses for" }
    }
  }
}
```

## Implementation Completed

**Files Modified:**
1. **src/types/motion.ts** - Updated MotionStatus interface to match API response
2. **src/types/mcp-tool-args.ts** - Added MotionStatusesArgs interface
3. **src/utils/responseFormatters.ts** - Added formatStatusList function
4. **src/services/motionApi.ts** - Added getStatuses method with caching
5. **src/mcp-server.ts** - Added motion_statuses tool and handler

**Key Changes:**
- Fixed MotionStatus interface to match actual API response structure (name, isDefaultStatus, isResolvedStatus)
- Implemented caching with 10-minute TTL (same as workspaces)
- Added to 'essential' tools configuration for default availability
- Handles both wrapped and unwrapped API responses
- Tested successfully - tool is available and working

**Branch:** feature/task-006-statuses-api