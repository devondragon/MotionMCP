# Task 012: Create Integration Tests

## Metadata
- **Task ID**: epic-001-f04-task-012
- **Priority**: 🟡 Medium - Prevent regressions
- **Estimated Effort**: 4 hours
- **Dependencies**: tasks 001-011 (all fixes)
- **Status**: TODO

## Problem Statement
We have no automated tests to verify our schema fixes work correctly or to catch future regressions. We need integration tests that validate against real or mocked API responses.

## Current Issues
1. **No Test Framework**
   - Currently manual testing only
   - No regression prevention
2. **No Response Mocks**
   - Can't test without API access
   - No fixtures for edge cases
3. **No Validation Testing**
   - Schema validation untested
   - Type guards untested

## Requirements
- [ ] Set up test framework
- [ ] Create response fixtures
- [ ] Test all API methods
- [ ] Test schema validation
- [ ] Test type guards
- [ ] Test error handling
- [ ] Add CI integration

## Implementation Details

### 1. Set Up Test Framework
```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "devDependencies": {
    "@types/jest": "^29.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  }
}
```

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ]
};
```

### 2. Create Response Fixtures
```typescript
// src/__tests__/fixtures/responses.ts

export const taskListResponse = {
  meta: {
    nextCursor: "cursor123",
    pageSize: 20
  },
  tasks: [
    {
      id: "task1",
      name: "Test Task",
      description: "Test description",
      duration: "NONE",
      workspace: {
        id: "ws1",
        name: "Test Workspace",
        teamId: "team1",
        type: "PERSONAL"
      },
      labels: [{ name: "urgent" }, { name: "bug" }],
      status: {
        name: "In Progress",
        isDefaultStatus: false,
        isResolvedStatus: false
      },
      // ... complete task object
    }
  ]
};

export const customFieldsResponse = [
  {
    id: "field1",
    field: "text"
  },
  {
    id: "field2", 
    field: "select"
  }
];

export const schedulesResponse = [
  {
    name: "Work Hours",
    isDefaultTimezone: true,
    timezone: "America/New_York",
    schedule: {
      monday: [{ start: "09:00", end: "17:00" }],
      // ... other days
    }
  }
];
```

### 3. Test API Methods
```typescript
// src/services/__tests__/motionApi.test.ts

import { MotionApiService } from '../motionApi';
import axios from 'axios';
import { taskListResponse } from '../fixtures/responses';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MotionApiService', () => {
  let service: MotionApiService;
  
  beforeEach(() => {
    service = new MotionApiService();
    jest.clearAllMocks();
  });
  
  describe('getTasks', () => {
    it('should handle wrapped response correctly', async () => {
      mockedAxios.get.mockResolvedValue({
        data: taskListResponse
      });
      
      const result = await service.getTasks();
      
      expect(result.tasks).toHaveLength(1);
      expect(result.nextCursor).toBe('cursor123');
      expect(result.tasks[0].labels).toEqual([
        { name: 'urgent' },
        { name: 'bug' }
      ]);
    });
    
    it('should handle pagination cursor', async () => {
      const cursor = 'abc123';
      await service.getTasks(undefined, cursor);
      
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`cursor=${cursor}`)
      );
    });
  });
  
  describe('getCustomFields', () => {
    it('should use beta endpoint with workspace', async () => {
      const workspaceId = 'ws123';
      await service.getCustomFields(workspaceId);
      
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `/beta/workspaces/${workspaceId}/custom-fields`
      );
    });
  });
});
```

### 4. Test Schema Validation
```typescript
// src/schemas/__tests__/motion.test.ts

import { 
  MotionTaskSchema,
  TasksResponseSchema 
} from '../motion';
import { taskListResponse } from '../fixtures/responses';

describe('Motion Schemas', () => {
  describe('TasksResponseSchema', () => {
    it('should validate correct response', () => {
      const result = TasksResponseSchema.safeParse(taskListResponse);
      expect(result.success).toBe(true);
    });
    
    it('should reject missing meta', () => {
      const invalid = { tasks: [] };
      const result = TasksResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
    
    it('should handle label objects', () => {
      const task = taskListResponse.tasks[0];
      const result = MotionTaskSchema.safeParse(task);
      expect(result.success).toBe(true);
    });
  });
});
```

### 5. Test Type Guards
```typescript
// src/utils/__tests__/typeGuards.test.ts

import {
  isStatusObject,
  isLabelArray,
  isPaginatedResponse
} from '../typeGuards';

describe('Type Guards', () => {
  describe('isStatusObject', () => {
    it('should identify status objects', () => {
      const status = {
        name: 'Done',
        isDefaultStatus: false,
        isResolvedStatus: true
      };
      expect(isStatusObject(status)).toBe(true);
    });
    
    it('should reject strings', () => {
      expect(isStatusObject('Done')).toBe(false);
    });
  });
  
  describe('isPaginatedResponse', () => {
    it('should identify paginated responses', () => {
      const response = {
        meta: { nextCursor: 'abc', pageSize: 20 },
        tasks: []
      };
      expect(isPaginatedResponse(response)).toBe(true);
    });
  });
});
```

### 6. Test Error Handling
```typescript
describe('Error Handling', () => {
  it('should handle API errors gracefully', async () => {
    mockedAxios.get.mockRejectedValue({
      response: {
        status: 429,
        data: { message: 'Rate limited' }
      }
    });
    
    await expect(service.getTasks()).rejects.toThrow('Rate limited');
  });
  
  it('should retry on transient failures', async () => {
    mockedAxios.get
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValueOnce({ data: taskListResponse });
    
    const result = await service.getTasks();
    expect(result.tasks).toHaveLength(1);
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });
});
```

## Testing Checklist
- [ ] All API methods have tests
- [ ] All schemas validated
- [ ] All type guards tested
- [ ] Error scenarios covered
- [ ] Pagination tested
- [ ] Response variations tested

## Acceptance Criteria
- [ ] Test suite runs successfully
- [ ] 80%+ code coverage
- [ ] All edge cases covered
- [ ] CI integration working
- [ ] Tests document expected behavior

## Notes
- Start with critical paths
- Mock axios for isolation
- Use fixtures for consistency
- Consider contract testing later