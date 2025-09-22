/**
 * Type definitions for consolidated MCP tool arguments
 * All individual tool types removed - only consolidated tools remain
 */

import { FrequencyObject } from './motion';

// Core utility types for search and context operations (used by motion_search)
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

// Consolidated tool operation types
export type ProjectOperation = 'create' | 'list' | 'get';
export type TaskOperation = 'create' | 'list' | 'get' | 'update' | 'delete' | 'move' | 'unassign' | 'list_all_uncompleted';

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
  assignee?: string;
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

export interface MotionUsersArgs {
  operation: 'list' | 'current';
  workspaceId?: string;
  workspaceName?: string;
}

export interface MotionCommentsArgs {
  operation: 'list' | 'create';
  taskId?: string;
  projectId?: string;
  content?: string;
  cursor?: string;
}

export interface MotionCustomFieldsArgs {
  operation: 'list' | 'create' | 'delete' | 'add_to_project' | 'remove_from_project' | 'add_to_task' | 'remove_from_task';
  fieldId?: string;
  workspaceId: string;
  name?: string;
  field?: 'text' | 'url' | 'date' | 'person' | 'multiPerson' | 'phone' | 'select' | 'multiSelect' | 'number' | 'email' | 'checkbox' | 'relatedTo';
  options?: string[];
  projectId?: string;
  taskId?: string;
  value?: string | number | boolean | string[] | null;
}

export interface MotionRecurringTasksArgs {
  operation: 'list' | 'create' | 'delete';
  recurringTaskId?: string;
  workspaceId?: string;
  name?: string;
  projectId?: string;
  assigneeId?: string;
  frequency?: FrequencyObject;
  description?: string;
  deadlineType?: 'HARD' | 'SOFT';
  duration?: number | 'REMINDER';
  startingOn?: string;
  idealTime?: string;
  schedule?: string;
  priority?: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface MotionSchedulesArgs {
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export interface MotionStatusesArgs {
  workspaceId?: string;
}

// New consolidated tool argument types
export type WorkspaceOperation = 'list' | 'get' | 'set_default';
export interface MotionWorkspacesArgs {
  operation: WorkspaceOperation;
  workspaceId?: string;
}

export type SearchOperation = 'content' | 'context' | 'smart';
export interface MotionSearchArgs {
  operation: SearchOperation;
  // Content search params
  query?: string;
  searchScope?: 'tasks' | 'projects' | 'both';
  limit?: number;
  // Context params
  includeProjects?: boolean;
  includeTasks?: boolean;
  includeUsers?: boolean;
  // Smart search params
  entityType?: 'project' | 'task';
  entityId?: string;
  includeRelated?: boolean;
  // Common params
  workspaceId?: string;
  workspaceName?: string;
}

// Union type of all consolidated tool arguments for type safety
export type AllToolArgs = 
  | SearchContentArgs
  | GetContextArgs
  | MotionProjectsArgs
  | MotionTasksArgs
  | MotionUsersArgs
  | MotionCommentsArgs
  | MotionCustomFieldsArgs
  | MotionRecurringTasksArgs
  | MotionSchedulesArgs
  | MotionStatusesArgs
  | MotionWorkspacesArgs
  | MotionSearchArgs;
