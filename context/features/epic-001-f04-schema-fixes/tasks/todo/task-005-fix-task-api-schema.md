# Task 005: Fix Task API Schema

## Metadata
- **Task ID**: epic-001-f04-task-005
- **Priority**: 🟠 High - Core API with multiple issues
- **Estimated Effort**: 3 hours
- **Dependencies**: task-004 (response wrappers)
- **Status**: TODO

## Problem Statement
The Task API has multiple schema mismatches including wrong label types, missing fields in nested objects, incorrect duration types, and missing pagination handling.

## API Documentation URL
Reference the API documenation here - https://docs.usemotion.com/api-reference/tasks/get/
https://docs.usemotion.com/api-reference/tasks/list/
https://docs.usemotion.com/api-reference/tasks/post/
https://docs.usemotion.com/api-reference/tasks/patch/
etc...


## Current Issues
1. **Labels Type Mismatch**
   - Expected: `string[]`
   - Actual: `Array<{name: string}>`
2. **Missing teamId in Workspace**
   - Workspace object missing required teamId field
3. **Chunks Structure Issues**
   - Missing `isFixed` field
   - Wrong field names/types
4. **Duration Type Union**
   - Can be number, "NONE", or "REMINDER"
5. **CustomFieldValues Structure**
   - Wrong nested structure
6. **Missing Pagination**
   - No meta object handling

## Requirements
- [ ] Fix labels field type
- [ ] Add teamId to nested workspace
- [ ] Update chunks interface
- [ ] Fix duration type union
- [ ] Fix customFieldValues structure
- [ ] Add pagination support
- [ ] Ensure all fields captured

## Implementation Details

### 1. Update Task Interface
```typescript
export interface MotionTask {
  id: string;
  name: string;
  description?: string;
  duration: number | 'NONE' | 'REMINDER'; // Fix type union
  dueDate?: string;
  deadlineType: 'HARD' | 'SOFT' | 'NONE';
  parentRecurringTaskId?: string;
  completed: boolean;
  completedTime?: string;
  updatedTime?: string;
  createdTime: string;
  startOn?: string;

  // Fixed nested objects
  creator?: {
    id: string;
    name: string;
    email: string;
  };

  project?: {
    id: string;
    name: string;
    description: string;
    workspaceId: string;
    status?: {
      name: string;
      isDefaultStatus: boolean;
      isResolvedStatus: boolean;
    };
  };

  workspace: {
    id: string;
    name: string;
    teamId: string; // ADD THIS
    type: string;
  };

  status?: {
    name: string;
    isDefaultStatus: boolean;
    isResolvedStatus: boolean;
  };

  priority?: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';

  // Fix labels type
  labels?: Array<{name: string}>;

  assignees?: Array<{
    id: string;
    name: string;
    email: string;
  }>;

  scheduledStart?: string;
  scheduledEnd?: string;
  schedulingIssue?: boolean;
  lastInteractedTime?: string;

  // Fix custom fields
  customFieldValues?: Record<string, {
    type: string;
    value: any;
  }>;

  // Fix chunks
  chunks?: Array<{
    id: string;
    duration: number;
    scheduledStart: string;
    scheduledEnd: string;
    completedTime?: string;
    isFixed: boolean; // ADD THIS
  }>;
}
```

### 2. Update List Response
```typescript
interface TasksListResponse {
  meta: {
    nextCursor?: string;
    pageSize: number;
  };
  tasks: MotionTask[];
}
```

### 3. Update Validation Schema
```typescript
const MotionTaskSchema = z.object({
  // ... update all fields to match
  labels: z.array(z.object({ name: z.string() })).optional(),
  duration: z.union([
    z.number(),
    z.literal('NONE'),
    z.literal('REMINDER')
  ]).optional(),
  // ... etc
});
```

## Testing Checklist
- [ ] Test fetching tasks with all fields
- [ ] Verify labels are objects with name
- [ ] Check workspace has teamId
- [ ] Test duration string values
- [ ] Verify chunks structure
- [ ] Test pagination

## Acceptance Criteria
- [ ] All task fields correctly typed
- [ ] Labels handled as objects
- [ ] Duration union type works
- [ ] Pagination implemented
- [ ] No runtime type errors
- [ ] All nested objects complete

## Notes
- This is the most complex API schema
- Many other APIs reference task structure
- Critical for core functionality
- Test thoroughly with real data
