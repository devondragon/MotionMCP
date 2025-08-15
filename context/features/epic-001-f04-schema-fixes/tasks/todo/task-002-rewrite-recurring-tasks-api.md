# Task 002: Rewrite Recurring Tasks API

## Metadata
- **Task ID**: epic-001-f04-task-002
- **Priority**: 🔴 Critical - API completely wrong concept
- **Estimated Effort**: 4 hours
- **Dependencies**: None
- **Status**: TODO

## Problem Statement
The Recurring Tasks API returns full task objects with nested creator, assignee, project, and workspace data - NOT recurrence configuration as we expected. The response is also wrapped with `{meta: {...}, tasks: [...]}` not `recurringTasks`.

## API Documentation URL
Reference the API documenation here - https://docs.usemotion.com/api-reference/recurring-tasks/get/
https://docs.usemotion.com/api-reference/recurring-tasks/post/
https://docs.usemotion.com/api-reference/recurring-tasks/delete/


## Current Issues
1. **Wrong Conceptual Model**
   - Expected: Recurrence configuration objects
   - Actual: Full task objects representing recurring task instances
2. **Wrong Response Key**
   - Expected: `recurringTasks` array
   - Actual: `tasks` array (same as regular tasks)
3. **Missing Recurrence Fields**
   - No frequency, interval, or pattern data in response
4. **Complex Nested Objects**
   - Contains full workspace with labels and statuses
   - Contains full project and user objects

## Requirements
- [ ] Completely redefine `MotionRecurringTask` interface
- [ ] Update response handling for `tasks` key
- [ ] Handle pagination with meta object
- [ ] Support complex nested objects
- [ ] Update create/delete operations accordingly

## Implementation Details

### 1. Update Interface
```typescript
// OLD (Wrong)
export interface MotionRecurringTask {
  id: string;
  name: string;
  description?: string;
  workspaceId: string;
  projectId?: string;
  recurrence: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    endDate?: string;
  };
  nextOccurrence?: string;
  createdTime?: string;
  updatedTime?: string;
}

// NEW (Correct - similar to MotionTask)
export interface MotionRecurringTask {
  id: string;
  name: string;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  project: {
    id: string;
    name: string;
    description: string;
    workspaceId: string;
    status: {
      name: string;
      isDefaultStatus: boolean;
      isResolvedStatus: boolean;
    };
    customFieldValues?: Record<string, any>;
  };
  workspace: {
    id: string;
    name: string;
    teamId: string;
    type: string;
    labels: Array<{name: string}>;
    statuses: Array<{
      name: string;
      isDefaultStatus: boolean;
      isResolvedStatus: boolean;
    }>;
  };
  status: {
    name: string;
    isDefaultStatus: boolean;
    isResolvedStatus: boolean;
  };
  priority: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';
  labels: Array<{name: string}>;
}
```

### 2. Fix Response Handling
```typescript
// Handle response wrapper
const response = await this.client.get('/recurring-tasks');
const { meta, tasks } = response.data; // Note: 'tasks' not 'recurringTasks'
```

### 3. Update Pagination
- Add support for `meta.nextCursor`
- Implement cursor-based pagination

## Testing Checklist
- [ ] Test listing recurring tasks
- [ ] Verify nested objects are populated
- [ ] Test pagination with cursor
- [ ] Verify workspace data includes labels/statuses
- [ ] Test create/delete operations

## Acceptance Criteria
- [ ] Recurring tasks list returns full task data
- [ ] Response key is correctly handled as 'tasks'
- [ ] Pagination works with meta.nextCursor
- [ ] All nested objects are properly typed
- [ ] Create/delete operations work correctly

## Notes
- This API doesn't return recurrence patterns
- Returns task instances, not recurrence rules
- May need separate API for recurrence configuration
- Consider if we need a different abstraction layer
