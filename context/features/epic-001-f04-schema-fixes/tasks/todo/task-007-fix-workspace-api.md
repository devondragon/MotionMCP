# Task 007: Fix Workspace API Schema

## Metadata
- **Task ID**: epic-001-f04-task-007
- **Priority**: 🟠 High - Missing required field
- **Estimated Effort**: 1 hour
- **Dependencies**: None
- **Status**: TODO

## Problem Statement
The Workspace API is missing the required `teamId` field in our interface. This is a required field per the API documentation.

## Current Issues
1. **Missing teamId Field**
   - API returns teamId (required)
   - Our interface doesn't have it
2. **Potential Other Missing Fields**
   - Need to verify complete structure

## Requirements
- [ ] Add teamId to MotionWorkspace interface
- [ ] Verify all workspace fields captured
- [ ] Update validation schema
- [ ] Check workspace usage in nested objects

## Implementation Details

### 1. Update Workspace Interface
```typescript
// OLD
export interface MotionWorkspace {
  id: string;
  name: string;
  type: string;
}

// NEW
export interface MotionWorkspace {
  id: string;
  name: string;
  teamId: string; // ADD THIS - Required field
  type: string;
  // Check for any other fields from API
}
```

### 2. Update Nested Workspace References
Many APIs return workspace as nested object:
```typescript
// In Task, RecurringTask, etc.
workspace: {
  id: string;
  name: string;
  teamId: string; // Add to all nested references
  type: string;
}
```

### 3. Update Validation Schema
```typescript
const MotionWorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  teamId: z.string(), // Add required field
  type: z.string()
});
```

### 4. Check WorkspaceReference Type
```typescript
// Update the minimal reference if used
export interface WorkspaceReference {
  id: string;
  name: string;
  teamId?: string; // Add if needed in references
  type?: string;
}
```

## Testing Checklist
- [ ] Test fetching workspaces
- [ ] Verify teamId is populated
- [ ] Check nested workspace objects in tasks
- [ ] Test workspace resolver with teamId
- [ ] Verify no breaking changes

## Acceptance Criteria
- [ ] teamId field captured in all workspace objects
- [ ] Validation includes teamId as required
- [ ] Nested workspace objects updated
- [ ] No runtime errors from missing field
- [ ] Backward compatibility maintained

## Notes
- Simple fix but affects many places
- Check all nested workspace usage
- Required field so should not be optional
- May affect workspace resolver logic