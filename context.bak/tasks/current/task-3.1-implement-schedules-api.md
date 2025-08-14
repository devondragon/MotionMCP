# Task 3.1: Implement Schedules API

**Priority:** Additional API Features (Priority 3)
**Status:** Current

**Endpoint:** GET /schedules  
**Purpose:** View calendar and time blocks

## Implementation Details

### 1. Add to `src/services/motionApi.js`:

```javascript
async getSchedules(userId = null, startDate = null, endDate = null) {
  try {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const url = params.toString() ? `/schedules?${params.toString()}` : '/schedules';
    const response = await this.client.get(url);
    return response.data?.schedules || response.data || [];
  } catch (error) {
    mcpLog('error', 'Failed to fetch schedules', {
      method: 'getSchedules',
      userId,
      startDate,
      endDate,
      error: error.message
    });
    throw new Error(`Failed to fetch schedules: ${error.message}`);
  }
}
```

### 2. Add tool in `src/mcp-server.js`:

```javascript
{
  name: "motion_schedules",
  description: "Get user schedules and calendar view",
  inputSchema: {
    type: "object",
    properties: {
      userId: { type: "string", description: "User ID to get schedule for" },
      startDate: { type: "string", description: "Start date (ISO 8601)" },
      endDate: { type: "string", description: "End date (ISO 8601)" }
    }
  }
}
```