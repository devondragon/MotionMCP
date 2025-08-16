# Task 008: Implement Pagination Support

## Metadata
- **Task ID**: epic-001-f04-task-008
- **Priority**: 🟠 High - Required for large datasets
- **Estimated Effort**: 3 hours
- **Dependencies**: task-004 (response wrappers)
- **Status**: TODO

## Problem Statement
Multiple list endpoints support pagination via `meta.nextCursor` but we're not capturing or using this. This limits us to first page of results only.

## Current Issues
1. **No Cursor Handling**
   - meta.nextCursor not captured
   - No way to request next page
2. **No Pagination Interface**
   - Consumers can't paginate
   - No standard pagination pattern
3. **Affected APIs**
   - Tasks, Projects, Comments, Recurring Tasks
   - Possibly Users and Custom Fields

## Requirements
- [ ] Add cursor parameter to list methods
- [ ] Return pagination metadata
- [ ] Create pagination helper/iterator
- [ ] Update MCP tool interfaces
- [ ] Document pagination pattern

## Implementation Details

### 1. Create Pagination Types
```typescript
export interface PaginationParams {
  cursor?: string;
  pageSize?: number; // If API supports
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  pageSize?: number;
}
```

### 2. Update API Methods
```typescript
// Example for tasks
async getTasks(
  workspaceId?: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<MotionTask>> {
  const params = new URLSearchParams();
  if (workspaceId) params.append('workspaceId', workspaceId);
  if (pagination?.cursor) params.append('cursor', pagination.cursor);
  
  const response = await this.client.get(`/tasks?${params}`);
  const { meta, tasks } = response.data;
  
  return {
    items: tasks || [],
    nextCursor: meta?.nextCursor,
    hasMore: !!meta?.nextCursor,
    pageSize: meta?.pageSize
  };
}
```

### 3. Create Pagination Iterator
```typescript
export class PaginationIterator<T> {
  constructor(
    private fetcher: (cursor?: string) => Promise<PaginatedResult<T>>
  ) {}
  
  async *[Symbol.asyncIterator]() {
    let cursor: string | undefined;
    
    do {
      const result = await this.fetcher(cursor);
      yield* result.items;
      cursor = result.nextCursor;
    } while (cursor);
  }
  
  async getAllPages(): Promise<T[]> {
    const allItems: T[] = [];
    for await (const item of this) {
      allItems.push(item);
    }
    return allItems;
  }
}
```

### 4. Update MCP Tools
```typescript
// Add pagination parameters to tool arguments
interface TaskListArgs {
  workspaceId?: string;
  cursor?: string;
  fetchAll?: boolean; // Auto-paginate all
}
```

### 5. Add Convenience Methods
```typescript
// Get all with auto-pagination
async getAllTasks(workspaceId?: string): Promise<MotionTask[]> {
  const iterator = new PaginationIterator(
    (cursor) => this.getTasks(workspaceId, { cursor })
  );
  return iterator.getAllPages();
}
```

## Testing Checklist
- [ ] Test single page fetch
- [ ] Test pagination with cursor
- [ ] Test auto-pagination for all pages
- [ ] Test with empty results
- [ ] Test pagination iterator
- [ ] Verify all affected APIs

## Acceptance Criteria
- [ ] Can fetch beyond first page
- [ ] Pagination metadata returned
- [ ] Iterator pattern works
- [ ] MCP tools support pagination
- [ ] Auto-fetch all option available
- [ ] Documentation complete

## Notes
- Consider rate limiting with pagination
- May need exponential backoff
- Large datasets could cause memory issues
- Consider streaming for very large sets