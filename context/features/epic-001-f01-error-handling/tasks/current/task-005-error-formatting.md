# Task 4.5: Centralize Error Formatting in Motion API Service

## Overview
The error formatting logic in `MotionApiService` is duplicated across every method's catch block. This task involves creating a centralized error formatting helper to reduce code duplication and improve maintainability.

## Problem
**Identified during**: Code review of task-1.3
**Severity**: Low
**Location**: `src/services/motionApi.ts`

Every method in the service has similar error handling code:
```typescript
throw new Error(`Failed to [action]: ${(isAxiosError(error) ? error.response?.data?.message : undefined) || getErrorMessage(error)}`);
```

This pattern is repeated in:
- getProjects
- getProject
- createProject
- updateProject
- deleteProject
- getTasks
- getTask
- createTask
- updateTask
- deleteTask
- getWorkspaces
- getUsers
- getProjectByName
- searchTasks
- searchProjects

## Solution Approach

### Step 1: Create Helper Method
Add a private helper method to the MotionApiService class:

```typescript
private formatApiError(error: unknown, action: string): Error {
  const baseMessage = `Failed to ${action}`;
  const apiMessage = isAxiosError(error) ? error.response?.data?.message : undefined;
  const errorMessage = getErrorMessage(error);
  return new Error(`${baseMessage}: ${apiMessage || errorMessage}`);
}
```

### Step 2: Optional - Enhanced Error Class
Consider creating a custom error class for better error handling:

```typescript
export class MotionApiError extends Error {
  public readonly statusCode?: number;
  public readonly apiMessage?: string;
  public readonly originalError: unknown;
  
  constructor(action: string, error: unknown) {
    const apiMessage = isAxiosError(error) ? error.response?.data?.message : undefined;
    const errorMessage = getErrorMessage(error);
    
    super(`Failed to ${action}: ${apiMessage || errorMessage}`);
    
    this.name = 'MotionApiError';
    this.statusCode = isAxiosError(error) ? error.response?.status : undefined;
    this.apiMessage = apiMessage;
    this.originalError = error;
  }
}
```

### Step 3: Update All Catch Blocks
Replace the duplicated error throwing logic in each method:

```typescript
// Before:
throw new Error(`Failed to fetch projects: ${(isAxiosError(error) ? error.response?.data?.message : undefined) || getErrorMessage(error)}`);

// After (simple approach):
throw this.formatApiError(error, 'fetch projects');

// After (with custom error class):
throw new MotionApiError('fetch projects', error);
```

## Benefits
- Reduced code duplication (DRY principle)
- Easier to modify error format globally
- Consistent error messages across all methods
- Improved maintainability
- Optional: Better error metadata with custom error class

## Implementation Checklist
1. [ ] Create the helper method or error class
2. [ ] Update all existing catch blocks to use the new approach
3. [ ] Ensure error messages remain consistent
4. [ ] Verify logging still works correctly
5. [ ] Test error scenarios to ensure proper error propagation

## Testing Requirements
1. Trigger error conditions for various API methods
2. Verify error messages are formatted correctly
3. Ensure error logging still captures all necessary details
4. Check that MCP error responses are properly formatted
5. Test with network errors, 404s, 401s, and 500s

## Estimated Effort
1 hour

## Priority
Low - This is a code quality improvement focused on maintainability

## Dependencies
None - Can be done independently

## Success Criteria
- [ ] Single source of truth for error formatting
- [ ] All API methods use the centralized error handling
- [ ] No change in error message format or content
- [ ] Error logging continues to work as before
- [ ] TypeScript compilation succeeds
- [ ] All error scenarios properly handled