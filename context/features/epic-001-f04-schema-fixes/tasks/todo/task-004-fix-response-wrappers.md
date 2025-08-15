# Task 004: Fix Response Wrapper Handling

## Metadata
- **Task ID**: epic-001-f04-task-004
- **Priority**: 🔴 Critical - Affects multiple APIs
- **Estimated Effort**: 3 hours
- **Dependencies**: None
- **Status**: TODO

## Problem Statement
Response wrapper handling is inconsistent across APIs. Some endpoints return wrapped responses with `{meta: {...}, [resource]: [...]}` while others return direct arrays. Our current handling doesn't properly account for this.

## Current Issues
1. **Inconsistent Wrapper Pattern**
   - Wrapped: Tasks, Projects, Comments, Recurring Tasks
   - Direct: Schedules, Statuses, Workspaces
2. **Wrong ListResponse Interface**
   - Current interface has all resource types as optional
   - Doesn't handle meta object
3. **No Pagination Support**
   - meta.nextCursor not captured
   - No standard pagination handling

## Requirements
- [ ] Create proper response type definitions
- [ ] Implement consistent wrapper handling
- [ ] Add pagination support for all list endpoints
- [ ] Maintain backward compatibility
- [ ] Document which APIs use which pattern

## Implementation Details

### 1. Create Response Types
```typescript
// Paginated response wrapper
export interface PaginatedResponse<T> {
  meta: {
    nextCursor?: string;
    pageSize: number;
  };
}

// Specific wrapped responses
export interface TasksResponse extends PaginatedResponse<MotionTask> {
  tasks: MotionTask[];
}

export interface ProjectsResponse extends PaginatedResponse<MotionProject> {
  projects: MotionProject[];
}

export interface CommentsResponse extends PaginatedResponse<MotionComment> {
  comments: MotionComment[];
}

// Note: Recurring tasks uses 'tasks' key!
export interface RecurringTasksResponse extends PaginatedResponse<MotionRecurringTask> {
  tasks: MotionRecurringTask[];
}

// Direct array responses (no wrapper)
export type SchedulesResponse = MotionSchedule[];
export type StatusesResponse = MotionStatus[];
export type WorkspacesResponse = MotionWorkspace[];
```

### 2. Create Wrapper Handler
```typescript
class ResponseWrapper {
  static unwrapList<T>(
    response: any,
    resourceKey: string,
    expectWrapper: boolean
  ): { items: T[], meta?: PaginationMeta } {
    if (expectWrapper) {
      return {
        items: response[resourceKey] || [],
        meta: response.meta
      };
    }
    return {
      items: Array.isArray(response) ? response : []
    };
  }
}
```

### 3. Update Each API Method
```typescript
// Example for tasks
async getTasks(workspaceId?: string, cursor?: string) {
  const response = await this.client.get('/tasks', { params });
  const { items, meta } = ResponseWrapper.unwrapList<MotionTask>(
    response.data,
    'tasks',
    true // expects wrapper
  );
  return { tasks: items, nextCursor: meta?.nextCursor };
}
```

## API Wrapper Mapping
| API | Wrapped | Resource Key | Has Pagination |
|-----|---------|--------------|----------------|
| Tasks | ✅ | tasks | ✅ |
| Projects | ✅ | projects | ✅ |
| Comments | ✅ | comments | ✅ |
| Recurring Tasks | ✅ | tasks | ✅ |
| Custom Fields | ❓ | TBD | ❓ |
| Workspaces | ❌ | - | ❌ |
| Users | ❓ | users | ❓ |
| Schedules | ❌ | - | ❌ |
| Statuses | ❌ | - | ❌ |

## Testing Checklist
- [ ] Test each API's response handling
- [ ] Verify pagination works where supported
- [ ] Test empty responses
- [ ] Test error responses
- [ ] Verify backward compatibility

## Acceptance Criteria
- [ ] All APIs correctly handle their response format
- [ ] Pagination captured where available
- [ ] No data loss from wrapper mishandling
- [ ] Consistent interface for consumers
- [ ] Clear documentation of patterns

## Notes
- Motion API inconsistency is the root cause
- May need to handle API version changes
- Consider adding response interceptor
- Document exceptions clearly