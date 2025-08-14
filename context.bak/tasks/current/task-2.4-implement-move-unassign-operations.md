# Task 2.4: Implement Move and Unassign Task Operations

**Priority:** Missing Core API Features (Priority 2)
**Status:** Current

**Endpoints:** PATCH /tasks/{id}/move, PATCH /tasks/{id}/unassign  
**Purpose:** Complete task management operations

## Implementation Details

### 1. Add to `src/services/motionApi.js`:

```javascript
async moveTask(taskId, targetProjectId = null, targetWorkspaceId = null) {
  try {
    if (!targetProjectId && !targetWorkspaceId) {
      throw new Error('Either targetProjectId or targetWorkspaceId must be provided');
    }
    
    const moveData = {};
    if (targetProjectId) moveData.projectId = targetProjectId;
    if (targetWorkspaceId) moveData.workspaceId = targetWorkspaceId;
    
    const response = await this.client.patch(`/tasks/${taskId}/move`, moveData);
    return response.data;
  } catch (error) {
    mcpLog('error', 'Failed to move task', {
      method: 'moveTask',
      taskId,
      targetProjectId,
      targetWorkspaceId,
      error: error.message
    });
    throw new Error(`Failed to move task: ${error.message}`);
  }
}

async unassignTask(taskId) {
  try {
    const response = await this.client.patch(`/tasks/${taskId}/unassign`);
    return response.data;
  } catch (error) {
    mcpLog('error', 'Failed to unassign task', {
      method: 'unassignTask',
      taskId,
      error: error.message
    });
    throw new Error(`Failed to unassign task: ${error.message}`);
  }
}
```

### 2. Integration
These are included in the consolidated `motion_tasks` tool from Task 1.1