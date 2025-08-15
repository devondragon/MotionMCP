# Task 006: Fix Project API Schema

## Metadata
- **Task ID**: epic-001-f04-task-006
- **Priority**: 🟠 High - Core API with field issues
- **Estimated Effort**: 2 hours
- **Dependencies**: task-004 (response wrappers)
- **Status**: TODO

## Problem Statement
The Project API has schema issues including missing pagination metadata, incorrect customFieldValues structure, and response wrapper handling problems.

## Current Issues
1. **Missing Pagination Meta**
   - No handling for meta object
   - No nextCursor support
2. **CustomFieldValues Structure**
   - Same issue as Tasks API
   - Wrong nested structure
3. **Response Wrapper**
   - Wrapped as `{meta: {...}, projects: [...]}`
   - Currently expecting direct array
4. **Status Field**
   - Can be string or object (inconsistent)

## Requirements
- [ ] Add pagination meta handling
- [ ] Fix customFieldValues structure
- [ ] Handle response wrapper correctly
- [ ] Fix status field type union
- [ ] Ensure all fields captured

## Implementation Details

### 1. Update Project Interface
```typescript
export interface MotionProject {
  id: string;
  name: string;
  description: string; // Required per API
  workspaceId: string;
  
  // Status can be object or string
  status?: string | {
    name: string;
    isDefaultStatus: boolean;
    isResolvedStatus: boolean;
  };
  
  createdTime?: string;
  updatedTime?: string;
  
  // Fix custom field values structure
  customFieldValues?: Record<string, {
    type: string;
    value: any; // Varies by type
  }>;
  
  // Note: color field exists in our code but not in API docs
  color?: string; // Keep for backward compatibility?
}
```

### 2. Update List Response
```typescript
interface ProjectsListResponse {
  meta: {
    nextCursor?: string;
    pageSize: number;
  };
  projects: MotionProject[];
}
```

### 3. Fix Response Handling
```typescript
async getProjects(workspaceId?: string, cursor?: string) {
  const params = new URLSearchParams();
  if (workspaceId) params.append('workspaceId', workspaceId);
  if (cursor) params.append('cursor', cursor);
  
  const response = await this.client.get(`/projects?${params}`);
  const { meta, projects } = response.data;
  
  return {
    projects: projects || [],
    nextCursor: meta?.nextCursor,
    pageSize: meta?.pageSize
  };
}
```

### 4. Update Validation Schema
```typescript
const MotionProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  workspaceId: z.string(),
  status: z.union([
    z.string(),
    z.object({
      name: z.string(),
      isDefaultStatus: z.boolean(),
      isResolvedStatus: z.boolean()
    })
  ]).optional(),
  customFieldValues: z.record(
    z.string(),
    z.object({
      type: z.string(),
      value: z.any()
    })
  ).optional(),
  // ... other fields
});
```

## Testing Checklist
- [ ] Test listing projects with pagination
- [ ] Verify meta object captured
- [ ] Test customFieldValues structure
- [ ] Check status field variations
- [ ] Test with multiple workspaces
- [ ] Verify all fields populated

## Acceptance Criteria
- [ ] Pagination works correctly
- [ ] CustomFieldValues properly structured
- [ ] Response wrapper handled
- [ ] Status field type union works
- [ ] No data loss
- [ ] Backward compatibility maintained

## Notes
- Color field may be Motion UI addition
- Status inconsistency is API issue
- Custom fields critical for integrations
- Test with real project data