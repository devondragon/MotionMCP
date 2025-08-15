/**
 * Type definitions for MCP tool handler arguments
 * These interfaces match the inputSchema definitions in mcp-server.ts
 */

export interface CreateProjectArgs {
  name: string;
  description?: string;
  workspaceId?: string;
  workspaceName?: string;
  color?: string;
  status?: string;
}

export interface ListProjectsArgs {
  workspaceId?: string;
  workspaceName?: string;
}

export interface GetProjectArgs {
  projectId: string;
}


export interface CreateTaskArgs {
  name: string;
  description?: string;
  workspaceId?: string;
  workspaceName?: string;
  projectId?: string;
  projectName?: string;
  status?: string;
  priority?: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate?: string;
  assigneeId?: string;
}

export interface ListTasksArgs {
  workspaceId?: string;
  workspaceName?: string;
  projectId?: string;
  projectName?: string;
  status?: string;
  assigneeId?: string;
}

export interface GetTaskArgs {
  taskId: string;
}

export interface UpdateTaskArgs {
  taskId: string;
  name?: string;
  description?: string;
  status?: string;
  priority?: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate?: string;
  assigneeId?: string;
}

export interface DeleteTaskArgs {
  taskId: string;
}

export interface ListWorkspacesArgs {
  // No parameters for this tool
}

export interface ListUsersArgs {
  workspaceId?: string;
  workspaceName?: string;
}

export interface SearchContentArgs {
  query: string;
  workspaceId?: string;
  workspaceName?: string;
  entityTypes?: Array<'projects' | 'tasks'>;
}

export interface GetContextArgs {
  entityType: 'project' | 'task';
  entityId: string;
  includeRelated?: boolean;
}


// Consolidated tool types
export type ProjectOperation = 'create' | 'list' | 'get';
export type TaskOperation = 'create' | 'list' | 'get' | 'update' | 'delete' | 'move' | 'unassign';

export interface MotionProjectsArgs {
  operation: ProjectOperation;
  // Common params
  projectId?: string;
  workspaceId?: string;
  workspaceName?: string;
  // Create/Update params
  name?: string;
  description?: string;
  color?: string;
  status?: string;
}

export interface MotionTasksArgs {
  operation: TaskOperation;
  // Common params
  taskId?: string;
  workspaceId?: string;
  workspaceName?: string;
  // List params
  projectId?: string;
  projectName?: string;
  assigneeId?: string;
  limit?: number;
  // Create/Update params
  name?: string;
  description?: string;
  status?: string;
  priority?: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate?: string;
  duration?: string | number;
  labels?: string[];
  autoScheduled?: object | null;
  // Move params
  targetProjectId?: string;
  targetWorkspaceId?: string;
}

export interface MotionCommentsArgs {
  operation: 'list' | 'create';
  taskId?: string;
  projectId?: string;
  content?: string;
  authorId?: string;
}

// Union type of all tool arguments for type safety
export type AllToolArgs = 
  | CreateProjectArgs
  | ListProjectsArgs
  | GetProjectArgs
  | CreateTaskArgs
  | ListTasksArgs
  | GetTaskArgs
  | UpdateTaskArgs
  | DeleteTaskArgs
  | ListWorkspacesArgs
  | ListUsersArgs
  | SearchContentArgs
  | GetContextArgs
  | MotionProjectsArgs
  | MotionTasksArgs
  | MotionCommentsArgs;