# Task 003: Fix Comments API Schema

## Metadata
- **Task ID**: epic-001-f04-task-003
- **Priority**: 🔴 Critical - Missing data fields
- **Estimated Effort**: 2 hours
- **Dependencies**: None
- **Status**: TODO

## Problem Statement
The Comments API is missing the `creator` field and has incorrect response wrapper handling. Comments are wrapped in `{meta: {...}, comments: [...]}` with pagination support.

## API Documentation URL
Reference the API documenation here - https://docs.usemotion.com/api-reference/comments/get/
https://docs.usemotion.com/api-reference/comments/post/

## Current Issues
1. **Missing Creator Field**
   - API returns creator object with id, name, email
   - Our interface doesn't capture this
2. **Response Wrapper Not Handled**
   - Response is `{meta: {...}, comments: [...]}`
   - We expect direct array
3. **Missing Pagination**
   - No handling for meta.nextCursor
4. **Field Name Issues**
   - Using wrong field names for timestamps

## Requirements
- [ ] Add creator field to MotionComment interface
- [ ] Fix response wrapper handling
- [ ] Implement pagination support
- [ ] Ensure all fields are captured
- [ ] Update validation schema

## Implementation Details

### 1. Update Interface
```typescript
// OLD
export interface MotionComment {
  id: string;
  content: string;
  authorId: string;
  taskId?: string;
  projectId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// NEW
export interface MotionComment {
  id: string;
  taskId: string; // Required when from task
  content: string;
  createdAt: string; // Required
  creator: {
    id: string;
    name: string;
    email: string;
  };
  // Note: projectId not returned by API
}
```

### 2. Fix Response Handling
```typescript
async getComments(taskId: string, cursor?: string) {
  const params = new URLSearchParams({ taskId });
  if (cursor) params.append('cursor', cursor);

  const response = await this.client.get(`/comments?${params}`);
  const { meta, comments } = response.data;

  return {
    comments,
    nextCursor: meta?.nextCursor,
    pageSize: meta?.pageSize
  };
}
```

### 3. Update Create Comment
- Verify if create returns wrapped response
- Update return type handling

## Testing Checklist
- [ ] Test listing comments for a task
- [ ] Verify creator field is populated
- [ ] Test pagination with cursor
- [ ] Test creating new comment
- [ ] Verify timestamps are correct

## Acceptance Criteria
- [ ] Creator information is captured
- [ ] Pagination works correctly
- [ ] Response wrapper handled properly
- [ ] All fields from API are typed
- [ ] No data loss when fetching comments

## Notes
- Comments are task-scoped in the GET endpoint
- Project comments may use different endpoint
- Creator field is essential for display
- Consider caching creator data
