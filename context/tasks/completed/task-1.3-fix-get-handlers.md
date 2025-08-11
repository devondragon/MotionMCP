# Task 1.3: Fix Incomplete Get Handlers

## Overview
The `handleGetProject` and `handleGetTask` handlers in `src/mcp-server.ts` currently return placeholder messages instead of actual project/task data. The Motion API doesn't provide direct endpoints for fetching single items by ID, so we need to implement a workaround.

## Problem
**Location**: `src/mcp-server.ts`
- Line ~648: `handleGetProject(args: ToolArgs.GetProjectArgs)`
- Line ~745: `handleGetTask(args: ToolArgs.GetTaskArgs)`

Both handlers currently return:
```typescript
return formatMcpSuccess(`Project details for ID: ${projectId}`);
// and
return formatMcpSuccess(`Task details for ID: ${taskId}`);
```

This doesn't return actual data, making these tools non-functional.

## Root Cause
The Motion API v1 DOES have dedicated endpoints for fetching individual items:
- `GET /projects/{id}` endpoint - Gets a single project
- `GET /tasks/{id}` endpoint - Gets a single task

These need to be properly implemented in the motionApi.ts service layer.

## Solution Approach

### Implement the GET endpoints properly
Add the missing methods to motionApi.ts:

```typescript
private async handleGetProject(args: ToolArgs.GetProjectArgs) {
  if (!this.motionService) {
    return formatMcpError(new Error('Motion service not initialized'));
  }
  
  const { projectId } = args;
  if (!projectId) {
    return formatMcpError(new ValidationError('Project ID is required', 'projectId'));
  }

  try {
    // Need to determine workspace - either from cache or by fetching all workspaces
    const workspaces = await this.motionService.getWorkspaces();
    
    // Try each workspace until we find the project
    for (const workspace of workspaces) {
      const projects = await this.motionService.getProjects(workspace.id);
      const project = projects.find(p => p.id === projectId);
      
      if (project) {
        return formatDetailResponse(project, 'Project', [
          'id', 'name', 'description', 'status', 'color', 
          'workspaceId', 'createdAt', 'updatedAt'
        ]);
      }
    }
    
    return formatMcpError(new Error(`Project with ID ${projectId} not found`));
  } catch (error) {
    return formatMcpError(error);
  }
}
```

### Option 2: Require Workspace Context
Modify the tool to require workspaceId as a parameter:

```typescript
// Update ToolArgs.GetProjectArgs to include optional workspaceId
interface GetProjectArgs {
  projectId: string;
  workspaceId?: string;
  workspaceName?: string;
}
```

Then use workspace context to reduce API calls.

### Option 3: Implement Caching Layer
Add a caching service that maintains an in-memory index of projects/tasks:
- Cache results from list operations
- Serve get requests from cache
- Implement TTL and invalidation strategies

## Implementation Steps

1. **Update the handlers** in `src/mcp-server.ts`
   - Implement actual data fetching logic
   - Handle edge cases (item not found, multiple workspaces)
   - Use proper error handling

2. **Consider performance optimizations**
   - Cache workspace list (already partially implemented)
   - Consider caching project/task lists with TTL
   - Implement parallel workspace searches if needed

3. **Update tool descriptions** to reflect limitations
   - Document that these operations may be slower
   - Mention the workspace search behavior

4. **Add response formatting**
   - Use existing `formatDetailResponse` or similar
   - Ensure consistent response structure with other handlers

## Testing Requirements

1. Test with valid project/task IDs
2. Test with invalid/non-existent IDs
3. Test with projects/tasks from different workspaces
4. Verify error handling and messages
5. Check performance with multiple workspaces

## Performance Considerations

**Warning**: The list-and-filter approach has O(n) complexity where n is the total number of items across all workspaces. This could be slow for users with many projects/tasks.

Consider implementing:
- Response caching with 5-minute TTL
- Parallel workspace queries
- Early termination once item is found
- Optional workspace hint parameter

## Alternative Solutions

1. **Contact Motion API team** to request single-item endpoints
2. **Document as known limitation** and recommend using list operations with client-side filtering
3. **Implement a proxy cache** that indexes all Motion data periodically

## Dependencies
- Requires understanding of Motion API response structures
- May need to update type definitions if response includes additional fields
- Should coordinate with any caching implementation (Task 3.1)

## Success Criteria
- [ ] Both handlers return actual project/task data
- [ ] Proper error handling for not-found cases  
- [ ] Performance is acceptable (<2 seconds for typical use)
- [ ] Tool descriptions accurately reflect behavior
- [ ] No breaking changes to tool interfaces

## Priority
HIGH - These are core functionality tools that are currently non-functional

## Estimated Effort
2-3 hours for basic implementation
Additional 1-2 hours if caching is included