# Task 010: Update Validation Schemas

## Metadata
- **Task ID**: epic-001-f04-task-010
- **Priority**: 🟡 Medium - Runtime validation
- **Estimated Effort**: 2 hours
- **Dependencies**: tasks 001-009 (interface updates)
- **Status**: TODO

## Problem Statement
The Zod validation schemas in `src/schemas/motion.ts` don't match the actual API responses. This causes validation to fail or pass incorrectly, defeating the purpose of runtime validation.

## Current Issues
1. **Outdated Schemas**
   - Don't match updated interfaces
   - Missing new fields
   - Wrong types for unions
2. **Missing Schemas**
   - No schema for Comments
   - No schema for Custom Fields
   - No schema for Recurring Tasks
3. **Wrong Response Schemas**
   - Don't handle wrapped responses
   - No pagination meta validation

## Requirements
- [ ] Update all existing schemas
- [ ] Create missing schemas
- [ ] Add response wrapper schemas
- [ ] Include pagination meta
- [ ] Test with real API data

## Implementation Details

### 1. Update Core Schemas
```typescript
// Task schema with all fixes
export const MotionTaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  duration: z.union([
    z.number(),
    z.literal('NONE'),
    z.literal('REMINDER')
  ]),
  dueDate: z.string().optional(),
  deadlineType: z.enum(['HARD', 'SOFT', 'NONE']),
  completed: z.boolean(),
  
  // Fixed nested objects
  creator: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string()
  }).optional(),
  
  workspace: z.object({
    id: z.string(),
    name: z.string(),
    teamId: z.string(), // Added
    type: z.string()
  }),
  
  // Fixed labels
  labels: z.array(z.object({
    name: z.string()
  })).optional(),
  
  // Fixed status union
  status: z.union([
    z.string(),
    z.object({
      name: z.string(),
      isDefaultStatus: z.boolean(),
      isResolvedStatus: z.boolean()
    })
  ]).optional(),
  
  // ... rest of fields
});
```

### 2. Add Missing Schemas
```typescript
// Comments schema
export const MotionCommentSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  content: z.string(),
  createdAt: z.string(),
  creator: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string()
  })
});

// Custom Fields schema (new structure)
export const MotionCustomFieldSchema = z.object({
  id: z.string(),
  field: z.enum([
    'text', 'url', 'date', 'person', 'multiPerson',
    'phone', 'select', 'multiSelect', 'number',
    'email', 'checkbox', 'relatedTo'
  ])
});

// Recurring Tasks (same as tasks mostly)
export const MotionRecurringTaskSchema = MotionTaskSchema.extend({
  // Any specific recurring task fields
});
```

### 3. Add Response Wrapper Schemas
```typescript
// Pagination meta
const PaginationMetaSchema = z.object({
  nextCursor: z.string().optional(),
  pageSize: z.number()
});

// Wrapped responses
export const TasksResponseSchema = z.object({
  meta: PaginationMetaSchema,
  tasks: z.array(MotionTaskSchema)
});

export const ProjectsResponseSchema = z.object({
  meta: PaginationMetaSchema,
  projects: z.array(MotionProjectSchema)
});

export const CommentsResponseSchema = z.object({
  meta: PaginationMetaSchema,
  comments: z.array(MotionCommentSchema)
});

// Direct array responses
export const WorkspacesResponseSchema = z.array(MotionWorkspaceSchema);
export const SchedulesResponseSchema = z.array(MotionScheduleSchema);
export const StatusesResponseSchema = z.array(MotionStatusSchema);
```

### 4. Update Validation Usage
```typescript
// In motionApi.ts
const validatedResponse = this.validateResponse(
  response.data,
  TasksResponseSchema, // Use correct schema
  'getTasks'
);
```

## Testing Checklist
- [ ] Test each schema with real API response
- [ ] Verify validation catches bad data
- [ ] Test optional vs required fields
- [ ] Check union type validation
- [ ] Test wrapped vs unwrapped responses

## Acceptance Criteria
- [ ] All schemas match actual API
- [ ] Validation works in strict mode
- [ ] Catches malformed responses
- [ ] Handles all field variations
- [ ] Clear validation errors

## Notes
- Run in lenient mode initially
- Log validation errors for analysis
- Consider schema versioning
- May need per-endpoint schemas