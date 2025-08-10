# Task 3.2: Implement Statuses API

**Priority:** Additional API Features (Priority 3)
**Status:** Current

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