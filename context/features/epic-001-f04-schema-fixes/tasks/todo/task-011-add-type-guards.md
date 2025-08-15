# Task 011: Add Type Guards

## Metadata
- **Task ID**: epic-001-f04-task-011
- **Priority**: 🟡 Medium - Runtime safety
- **Estimated Effort**: 2 hours
- **Dependencies**: task-009 (type unions)
- **Status**: TODO

## Problem Statement
With multiple type unions and inconsistent API responses, we need runtime type guards to safely handle data variations and prevent runtime errors.

## Current Issues
1. **No Runtime Type Checking**
   - Can't distinguish union types at runtime
   - No safe way to access union fields
2. **Inconsistent Response Handling**
   - Need to detect wrapper vs array
   - Need to identify field types
3. **Missing Error Safety**
   - Type assertions without checks

## Requirements
- [ ] Create type guard functions
- [ ] Add response format detectors
- [ ] Create safe accessors
- [ ] Add error boundaries
- [ ] Document usage patterns

## Implementation Details

### 1. Basic Type Guards
```typescript
// src/utils/typeGuards.ts

// Status type guards
export function isStatusObject(
  value: unknown
): value is { name: string; isDefaultStatus: boolean; isResolvedStatus: boolean } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'isDefaultStatus' in value &&
    'isResolvedStatus' in value
  );
}

export function isStatusString(value: unknown): value is string {
  return typeof value === 'string';
}

// Duration type guards
export function isDurationNumber(value: unknown): value is number {
  return typeof value === 'number' && value >= 0;
}

export function isDurationLiteral(
  value: unknown
): value is 'NONE' | 'REMINDER' {
  return value === 'NONE' || value === 'REMINDER';
}

// Label type guards
export function isLabelObject(value: unknown): value is { name: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof (value as any).name === 'string'
  );
}

export function isLabelArray(value: unknown): value is Array<{name: string}> {
  return Array.isArray(value) && value.every(isLabelObject);
}
```

### 2. Response Format Guards
```typescript
// Response wrapper detection
export function isWrappedResponse(
  value: unknown
): value is { meta: any; [key: string]: any } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'meta' in value
  );
}

export function isPaginatedResponse(
  value: unknown
): value is { meta: { nextCursor?: string; pageSize: number } } {
  return (
    isWrappedResponse(value) &&
    typeof value.meta === 'object' &&
    'pageSize' in value.meta
  );
}

export function isDirectArrayResponse(value: unknown): value is any[] {
  return Array.isArray(value);
}
```

### 3. Safe Accessors
```typescript
// Safe field access
export function safeGetStatus(item: { status?: any }): string | undefined {
  if (!item.status) return undefined;
  
  if (isStatusString(item.status)) {
    return item.status;
  }
  
  if (isStatusObject(item.status)) {
    return item.status.name;
  }
  
  console.warn('Unknown status format:', item.status);
  return undefined;
}

export function safeGetLabels(item: { labels?: any }): string[] {
  if (!item.labels) return [];
  
  if (Array.isArray(item.labels)) {
    if (item.labels.length === 0) return [];
    
    // Check if label objects or strings
    if (isLabelObject(item.labels[0])) {
      return item.labels.map((l: any) => l.name || '');
    }
    
    if (typeof item.labels[0] === 'string') {
      return item.labels;
    }
  }
  
  console.warn('Unknown labels format:', item.labels);
  return [];
}
```

### 4. Response Normalizers
```typescript
export function normalizeTaskResponse(raw: unknown): MotionTask[] {
  // Handle wrapped response
  if (isPaginatedResponse(raw) && 'tasks' in raw) {
    return (raw.tasks as any[]).map(normalizeTask);
  }
  
  // Handle direct array
  if (isDirectArrayResponse(raw)) {
    return raw.map(normalizeTask);
  }
  
  console.error('Unknown task response format:', raw);
  return [];
}

function normalizeTask(raw: any): MotionTask {
  return {
    ...raw,
    labels: safeGetLabels(raw),
    status: raw.status, // Keep original, use safeGetStatus when needed
    duration: normalizeDuration(raw.duration),
    // ... other normalizations
  };
}
```

### 5. Error Boundaries
```typescript
export function withTypeGuard<T, R>(
  guard: (value: unknown) => value is T,
  handler: (value: T) => R,
  fallback: R
): (value: unknown) => R {
  return (value: unknown) => {
    try {
      if (guard(value)) {
        return handler(value);
      }
      return fallback;
    } catch (error) {
      console.error('Type guard error:', error);
      return fallback;
    }
  };
}
```

## Testing Checklist
- [ ] Test all type guards with valid data
- [ ] Test guards with invalid data
- [ ] Test safe accessors with edge cases
- [ ] Test response normalizers
- [ ] Verify error boundaries work

## Acceptance Criteria
- [ ] Type guards correctly identify types
- [ ] Safe accessors prevent crashes
- [ ] Response format detected correctly
- [ ] Normalizers handle all variations
- [ ] Clear error messages for unknown formats

## Notes
- Type guards are critical for runtime safety
- Log unknown formats for debugging
- Consider telemetry for format variations
- May need to update as API evolves