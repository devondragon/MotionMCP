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

export interface UpdateProjectArgs {
  projectId: string;
  name?: string;
  description?: string;
  color?: string;
  status?: string;
}

export interface DeleteProjectArgs {
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

export interface SuggestNextActionArgs {
  workspaceId?: string;
  workspaceName?: string;
  userId?: string;
  context?: string;
}

export interface AnalyzeWorkloadArgs {
  workspaceId?: string;
  workspaceName?: string;
  userId?: string;
  timeframe?: string;
}

export interface SmartScheduleTasksArgs {
  taskIds: string[];
  strategy?: 'balanced' | 'urgent_first' | 'easy_first';
}

export interface CreateProjectTemplateArgs {
  templateName: string;
  templateDescription?: string;
  projectName: string;
  projectDescription?: string;
  workspaceId?: string;
  workspaceName?: string;
  tasks?: Array<{
    name: string;
    description?: string;
    priority?: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';
    assigneeId?: string;
  }>;
}

// Union type of all tool arguments for type safety
export type AllToolArgs = 
  | CreateProjectArgs
  | ListProjectsArgs
  | GetProjectArgs
  | UpdateProjectArgs
  | DeleteProjectArgs
  | CreateTaskArgs
  | ListTasksArgs
  | GetTaskArgs
  | UpdateTaskArgs
  | DeleteTaskArgs
  | ListWorkspacesArgs
  | ListUsersArgs
  | SearchContentArgs
  | GetContextArgs
  | SuggestNextActionArgs
  | AnalyzeWorkloadArgs
  | SmartScheduleTasksArgs
  | CreateProjectTemplateArgs;