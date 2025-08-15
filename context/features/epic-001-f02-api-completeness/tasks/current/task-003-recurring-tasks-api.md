# Task 2.3: Implement Recurring Tasks API

**Priority:** Missing Core API Features (Priority 2)
**Status:** Current

**Endpoints:** GET /recurring-tasks, POST /recurring-tasks, DELETE /recurring-tasks/{id}  
**Purpose:** Support repetitive task management

## Implementation Details

### 1. Add to `src/services/motionApi.js`:

```javascript
async getRecurringTasks(workspaceId = null) {
  try {
    const params = workspaceId ? `?workspaceId=${workspaceId}` : '';
    const response = await this.client.get(`/recurring-tasks${params}`);
    return response.data?.recurringTasks || response.data || [];
  } catch (error) {
    mcpLog('error', 'Failed to fetch recurring tasks', {
      method: 'getRecurringTasks',
      workspaceId,
      error: error.message
    });
    throw new Error(`Failed to fetch recurring tasks: ${error.message}`);
  }
}

async createRecurringTask(taskData) {
  try {
    // taskData: { name, workspaceId, projectId?, recurrence: { frequency, interval?, daysOfWeek?, dayOfMonth?, endDate? } }
    const response = await this.client.post('/recurring-tasks', taskData);
    return response.data;
  } catch (error) {
    mcpLog('error', 'Failed to create recurring task', {
      method: 'createRecurringTask',
      error: error.message
    });
    throw new Error(`Failed to create recurring task: ${error.message}`);
  }
}

async deleteRecurringTask(recurringTaskId) {
  try {
    await this.client.delete(`/recurring-tasks/${recurringTaskId}`);
    return { success: true };
  } catch (error) {
    mcpLog('error', 'Failed to delete recurring task', {
      method: 'deleteRecurringTask',
      recurringTaskId,
      error: error.message
    });
    throw new Error(`Failed to delete recurring task: ${error.message}`);
  }
}
```

### 2. Add consolidated tool in `src/mcp-server.js`:

```javascript
{
  name: "motion_recurring_tasks",
  description: "Manage recurring tasks",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["list", "create", "delete"],
        description: "Operation to perform"
      },
      recurringTaskId: { type: "string", description: "Recurring task ID (for delete)" },
      workspaceId: { type: "string", description: "Workspace ID" },
      name: { type: "string", description: "Task name (for create)" },
      description: { type: "string", description: "Task description" },
      projectId: { type: "string", description: "Project ID" },
      recurrence: {
        type: "object",
        properties: {
          frequency: { type: "string", enum: ["daily", "weekly", "monthly", "yearly"] },
          interval: { type: "number", description: "Repeat every N periods" },
          daysOfWeek: { type: "array", items: { type: "number" }, description: "0-6 for Sunday-Saturday" },
          dayOfMonth: { type: "number", description: "1-31 for monthly recurrence" },
          endDate: { type: "string", description: "ISO 8601 format" }
        }
      }
    },
    required: ["operation"]
  }
}
```