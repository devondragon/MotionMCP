# Task 0.1: Migrate to TypeScript

**Priority:** Foundation (Priority 0)
**Status:** Completed

**Rationale:** Type safety will catch errors at compile time, improve IDE support, provide better documentation through types, and make refactoring safer - especially important when consolidating tools and handling API responses.

## Implementation Steps

### 1. Setup TypeScript Configuration
- Install TypeScript and necessary dependencies:
  ```bash
  npm install --save-dev typescript @types/node ts-node
  npm install --save-dev @types/axios  # if axios is used
  ```
- Create `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "target": "ES2020",
      "module": "commonjs",
      "lib": ["ES2020"],
      "outDir": "./dist",
      "rootDir": "./src",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "resolveJsonModule": true,
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true,
      "noImplicitReturns": true,
      "noFallthroughCasesInSwitch": true
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist"]
  }
  ```

### 2. Create Type Definitions
- Create `src/types/motion.ts` for Motion API types:
  ```typescript
  export interface MotionWorkspace {
    id: string;
    name: string;
    type: string;
  }
  
  export interface MotionProject {
    id: string;
    name: string;
    description?: string;
    workspaceId: string;
    color?: string;
    status?: string;
  }
  
  export interface MotionTask {
    id: string;
    name: string;
    description?: string;
    workspaceId: string;
    projectId?: string;
    status?: string;
    priority?: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';
    dueDate?: string;
    duration?: number | 'NONE' | 'REMINDER';
    assigneeId?: string;
    labels?: string[];
    autoScheduled?: object | null;
  }
  
  export interface MotionUser {
    id: string;
    name: string;
    email?: string;
  }
  
  export interface MotionComment {
    id: string;
    taskId?: string;
    projectId?: string;
    content: string;
    authorId: string;
    createdAt: string;
  }
  ```

- Create `src/types/mcp.ts` for MCP types:
  ```typescript
  export interface McpToolResponse {
    content: Array<{
      type: 'text';
      text: string;
    }>;
    isError?: boolean;
  }
  
  export interface McpToolDefinition {
    name: string;
    description: string;
    inputSchema: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
      additionalProperties?: boolean;
    };
  }
  ```

### 3. Convert Files to TypeScript
- Rename all `.js` files to `.ts`
- Add type annotations to all functions, parameters, and return values
- Convert class properties to typed properties
- Add interfaces for complex objects

### 4. Update Motion API Service
- Convert `src/services/motionApi.js` to `src/services/motionApi.ts`
- Add proper types for all methods:
  ```typescript
  import { MotionWorkspace, MotionProject, MotionTask } from '../types/motion';
  
  class MotionApiService {
    private apiKey: string;
    private baseUrl: string;
    private client: AxiosInstance;
    
    async getProjects(workspaceId?: string): Promise<MotionProject[]> {
      // Implementation
    }
    
    async createTask(taskData: Partial<MotionTask> & { name: string; workspaceId: string }): Promise<MotionTask> {
      // Implementation
    }
  }
  ```

### 5. Update Build Scripts
- Update `package.json` scripts:
  ```json
  {
    "scripts": {
      "build": "tsc",
      "dev": "ts-node src/mcp-server.ts",
      "mcp": "node dist/mcp-server.js",
      "watch": "tsc --watch",
      "type-check": "tsc --noEmit"
    }
  }
  ```

### 6. Update Documentation
- Update `context/conventions.md` to reflect TypeScript conventions
- Update `context/project.md` to note TypeScript usage
- Update `CLAUDE.md` to remove "pure JavaScript" references
- Update README with TypeScript setup instructions

## Testing
- Ensure all files compile without errors: `npm run build`
- Test MCP server still works: `npm run mcp`
- Verify type checking catches errors: `npm run type-check`

## Benefits
- Catch Motion API response structure issues at compile time
- Better IDE autocomplete for all team members
- Self-documenting code through types
- Safer refactoring when consolidating tools
- Clearer contracts between modules