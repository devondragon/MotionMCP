# Task 2.1: Implement Comments API

**Priority:** Missing Core API Features (Priority 2)
**Status:** Current

**Endpoint:** GET /comments, POST /comments  
**Purpose:** Enable collaboration through task/project comments

## Implementation Details

### 1. Add to `src/services/motionApi.js`:

```javascript
async getComments(taskId, projectId = null) {
  try {
    const params = new URLSearchParams();
    if (taskId) params.append('taskId', taskId);
    if (projectId) params.append('projectId', projectId);
    
    const response = await this.client.get(`/comments?${params.toString()}`);
    return response.data?.comments || response.data || [];
  } catch (error) {
    mcpLog('error', 'Failed to fetch comments', {
      method: 'getComments',
      taskId,
      projectId,
      error: error.message
    });
    throw new Error(`Failed to fetch comments: ${error.message}`);
  }
}

async createComment(commentData) {
  try {
    // commentData should include: { taskId OR projectId, content, authorId? }
    const response = await this.client.post('/comments', commentData);
    return response.data;
  } catch (error) {
    mcpLog('error', 'Failed to create comment', {
      method: 'createComment',
      error: error.message
    });
    throw new Error(`Failed to create comment: ${error.message}`);
  }
}
```

### 2. Add consolidated tool in `src/mcp-server.js`:

```javascript
{
  name: "motion_comments",
  description: "Manage comments on tasks and projects",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["list", "create"],
        description: "Operation to perform"
      },
      taskId: { type: "string", description: "Task ID to comment on or fetch comments from" },
      projectId: { type: "string", description: "Project ID to comment on or fetch comments from" },
      content: { type: "string", description: "Comment content (required for create)" },
      authorId: { type: "string", description: "Author user ID (optional)" }
    },
    required: ["operation"]
  }
}
```