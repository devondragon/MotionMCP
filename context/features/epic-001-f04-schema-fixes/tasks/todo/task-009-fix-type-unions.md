# Task 009: Fix Type Unions and Enums

## Metadata
- **Task ID**: epic-001-f04-task-009
- **Priority**: 🟡 Medium - Type safety issues
- **Estimated Effort**: 2 hours
- **Dependencies**: None
- **Status**: TODO

## Problem Statement
Several fields have incorrect type definitions, particularly around union types and enums. This includes duration, status, and other fields that can have multiple formats.

## Current Issues
1. **Duration Type**
   - Can be number, "NONE", or "REMINDER"
   - Currently only number | undefined
2. **Status Inconsistency**
   - Sometimes string, sometimes object
   - No proper union type
3. **Priority Enum**
   - Verify all valid values
4. **DeadlineType Enum**
   - Missing from some interfaces

## Requirements
- [ ] Fix duration type union
- [ ] Fix status type union
- [ ] Verify all enum values
- [ ] Add missing enum fields
- [ ] Update validation schemas

## Implementation Details

### 1. Create Proper Type Unions
```typescript
// Duration type
export type TaskDuration = number | 'NONE' | 'REMINDER';

// Status type (used in multiple places)
export type StatusValue = string | {
  name: string;
  isDefaultStatus: boolean;
  isResolvedStatus: boolean;
};

// Priority enum
export type Priority = 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';

// Deadline type
export type DeadlineType = 'HARD' | 'SOFT' | 'NONE';
```

### 2. Update Interfaces
```typescript
export interface MotionTask {
  // ...
  duration: TaskDuration;
  status?: StatusValue;
  priority?: Priority;
  deadlineType?: DeadlineType;
  // ...
}

export interface MotionProject {
  // ...
  status?: StatusValue;
  // ...
}
```

### 3. Create Type Guards
```typescript
export function isStatusObject(
  status: StatusValue
): status is { name: string; isDefaultStatus: boolean; isResolvedStatus: boolean } {
  return typeof status === 'object' && 'name' in status;
}

export function isDurationNumber(duration: TaskDuration): duration is number {
  return typeof duration === 'number';
}
```

### 4. Update Validation Schemas
```typescript
const TaskDurationSchema = z.union([
  z.number(),
  z.literal('NONE'),
  z.literal('REMINDER')
]);

const StatusValueSchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    isDefaultStatus: z.boolean(),
    isResolvedStatus: z.boolean()
  })
]);
```

### 5. Handle in API Methods
```typescript
// When creating/updating tasks
if (duration === 'NONE' || duration === 'REMINDER') {
  apiData.duration = duration;
} else if (typeof duration === 'number') {
  apiData.duration = duration;
}

// When reading status
const statusName = isStatusObject(task.status) 
  ? task.status.name 
  : task.status;
```

## Testing Checklist
- [ ] Test duration with all three types
- [ ] Test status as string and object
- [ ] Verify priority enum values
- [ ] Test type guards
- [ ] Check validation with unions

## Acceptance Criteria
- [ ] All type unions correctly defined
- [ ] Type guards working
- [ ] Validation handles all cases
- [ ] No runtime type errors
- [ ] Clear type safety in IDE

## Notes
- Motion API inconsistency is root cause
- Type guards help runtime safety
- Consider normalizing in response
- Document the variations clearly