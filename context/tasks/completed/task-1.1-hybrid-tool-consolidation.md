# Task 1.1: Implement Hybrid Tool Consolidation Strategy

**Priority:** Critical Tool Consolidation (Priority 1)
**Status:** Current

**Problem:** MCP clients like Claude limit active tools to ~100 across all servers. Current implementation exposes 18 separate tools.

**Solution:** Consolidate related CRUD operations into resource-based tools while keeping specialized tools separate.

## Implementation Details

### 1. Create consolidated tool handlers in `src/mcp-server.js`:

```javascript
// Replace 5 task tools with 1
{
  name: "motion_tasks",
  description: "Manage Motion tasks - supports create, list, get, update, delete, move, and unassign operations",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["create", "list", "get", "update", "delete", "move", "unassign"],
        description: "Operation to perform"
      },
      // Common params
      taskId: { type: "string", description: "Task ID (required for get/update/delete/move/unassign)" },
      
      // List params
      workspaceId: { type: "string", description: "Filter by workspace (for list)" },
      workspaceName: { type: "string", description: "Filter by workspace name (for list)" },
      projectId: { type: "string", description: "Filter by project (for list)" },
      status: { type: "string", description: "Filter by status (for list)" },
      assigneeId: { type: "string", description: "Filter by assignee (for list)" },
      
      // Create/Update params
      name: { type: "string", description: "Task name (required for create)" },
      description: { type: "string", description: "Task description" },
      priority: { type: "string", enum: ["ASAP", "HIGH", "MEDIUM", "LOW"] },
      dueDate: { type: "string", description: "ISO 8601 format" },
      duration: { type: ["string", "number"], description: "Minutes or 'NONE'/'REMINDER'" },
      labels: { type: "array", items: { type: "string" } },
      autoScheduled: { type: ["object", "null"] },
      
      // Move params
      targetProjectId: { type: "string", description: "Target project for move operation" },
      targetWorkspaceId: { type: "string", description: "Target workspace for move operation" }
    },
    required: ["operation"]
  }
}

// Replace 5 project tools with 1
{
  name: "motion_projects",
  description: "Manage Motion projects - supports create, list, get, update, and delete operations",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["create", "list", "get", "update", "delete"],
        description: "Operation to perform"
      },
      projectId: { type: "string", description: "Project ID (required for get/update/delete)" },
      workspaceId: { type: "string", description: "Workspace ID" },
      workspaceName: { type: "string", description: "Workspace name (alternative to ID)" },
      name: { type: "string", description: "Project name" },
      description: { type: "string", description: "Project description" },
      color: { type: "string", description: "Hex color code" },
      status: { type: "string", description: "Project status" }
    },
    required: ["operation"]
  }
}
```

### 2. Update handler methods to route based on operation:

```javascript
async handleMotionTasks(args) {
  const { operation, ...params } = args;
  
  switch(operation) {
    case 'create':
      return this.createTask(params);
    case 'list':
      return this.listTasks(params);
    case 'get':
      return this.getTask(params.taskId);
    case 'update':
      return this.updateTask(params.taskId, params);
    case 'delete':
      return this.deleteTask(params.taskId);
    case 'move':
      return this.moveTask(params.taskId, params.targetProjectId, params.targetWorkspaceId);
    case 'unassign':
      return this.unassignTask(params.taskId);
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}
```

### 3. Add configuration support in environment:

```javascript
// In src/mcp-server.js constructor
this.toolsConfig = process.env.MOTION_MCP_TOOLS || 'essential';
// Options: 'minimal', 'essential', 'all', 'custom:tasks,projects,search'

// In setupHandlers, filter tools based on config
getEnabledTools() {
  const allTools = { /* ... */ };
  
  switch(this.toolsConfig) {
    case 'minimal':
      return ['motion_tasks', 'motion_projects', 'motion_context'];
    case 'essential':
      return ['motion_tasks', 'motion_projects', 'motion_context', 
              'search_motion_content', 'motion_workspaces', 'motion_comments', 
              'motion_recurring_tasks'];
    case 'all':
      return Object.keys(allTools);
    default:
      if (this.toolsConfig.startsWith('custom:')) {
        return this.toolsConfig.substring(7).split(',');
      }
      return this.getEssentialTools();
  }
}
```

## Files to modify
- `src/mcp-server.js` - Consolidate tool definitions and handlers
- `.env.example` - Add MOTION_MCP_TOOLS configuration option
- `CLAUDE.md` - Document the consolidated tools and configuration