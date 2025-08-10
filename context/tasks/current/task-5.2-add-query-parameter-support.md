# Task 5.2: Add Query Parameter Support

**Priority:** Documentation and Testing (Priority 5)
**Status:** Current

**Purpose:** Enable more advanced filtering and sorting

## Implementation Details

### 1. Update list methods in `src/services/motionApi.js`:

```javascript
async getTasks(options = {}) {
  try {
    const {
      workspaceId,
      projectId,
      status,
      assigneeId,
      labels,
      priority,
      dueDateFrom,
      dueDateTo,
      sortBy = 'dueDate', // dueDate, priority, created, updated
      sortOrder = 'asc',
      limit = 100,
      offset = 0
    } = options;

    const params = new URLSearchParams();
    if (workspaceId) params.append('workspaceId', workspaceId);
    if (projectId) params.append('projectId', projectId);
    if (status) params.append('status', status);
    if (assigneeId) params.append('assigneeId', assigneeId);
    if (labels?.length) params.append('labels', labels.join(','));
    if (priority) params.append('priority', priority);
    if (dueDateFrom) params.append('dueDateFrom', dueDateFrom);
    if (dueDateTo) params.append('dueDateTo', dueDateTo);
    if (sortBy) params.append('sortBy', sortBy);
    if (sortOrder) params.append('sortOrder', sortOrder);
    if (limit) params.append('limit', limit);
    if (offset) params.append('offset', offset);

    const response = await this.client.get(`/tasks?${params.toString()}`);
    return response.data?.tasks || response.data || [];
  } catch (error) {
    // ... error handling
  }
}
```

### 2. Update tool schemas to include new parameters