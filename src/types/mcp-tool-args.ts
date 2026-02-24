/**
 * Type definitions for consolidated MCP tool arguments
 * All individual tool types removed - only consolidated tools remain
 */

import { FrequencyObject } from './motion';

// Consolidated tool operation types
export type ProjectOperation = 'create' | 'list' | 'get';
export type TaskOperation = 'create' | 'list' | 'get' | 'update' | 'delete' | 'move' | 'unassign' | 'list_all_uncompleted';

export interface MotionProjectsArgs {
  operation: ProjectOperation;
  // Common params
  projectId?: string;
  workspaceId?: string;
  workspaceName?: string;
  allWorkspaces?: boolean;
  // Create params
  name?: string;
  description?: string;
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
  // List-only params
  includeAllStatuses?: boolean;
  // Create/Update params
  name?: string;
  description?: string;
  // status accepts an array for list (multi-status filter) but only string for create/update
  status?: string | string[];
  priority?: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate?: string;
  duration?: string | number;
  labels?: string[];
  autoScheduled?: object | string | null;
  // Move params
  targetWorkspaceId?: string;
}

export interface MotionUsersArgs {
  operation: 'list' | 'current';
  workspaceId?: string;
  workspaceName?: string;
  teamId?: string;
}

export interface MotionCommentsArgs {
  operation: 'list' | 'create';
  taskId?: string;
  content?: string;
  cursor?: string;
}

export interface MotionCustomFieldsArgs {
  operation: 'list' | 'create' | 'delete' | 'add_to_project' | 'remove_from_project' | 'add_to_task' | 'remove_from_task';
  fieldId?: string;
  valueId?: string;
  workspaceId?: string;
  workspaceName?: string;
  name?: string;
  field?: 'text' | 'url' | 'date' | 'person' | 'multiPerson' | 'phone' | 'select' | 'multiSelect' | 'number' | 'email' | 'checkbox' | 'relatedTo';
  options?: string[];
  required?: boolean;
  projectId?: string;
  taskId?: string;
  value?: string | number | boolean | string[] | null;
}

export interface MotionRecurringTasksArgs {
  operation: 'list' | 'create' | 'delete';
  recurringTaskId?: string;
  workspaceId?: string;
  workspaceName?: string;
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
  // The Motion API GET /schedules accepts no query parameters
}

export interface MotionStatusesArgs {
  workspaceId?: string;
}

// New consolidated tool argument types
export type WorkspaceOperation = 'list' | 'get';
export interface MotionWorkspacesArgs {
  operation: WorkspaceOperation;
  workspaceId?: string;
}

export type SearchOperation = 'content';
export interface MotionSearchArgs {
  operation: SearchOperation;
  query?: string;
  searchScope?: 'tasks' | 'projects' | 'both';
  limit?: number;
  workspaceId?: string;
  workspaceName?: string;
}

