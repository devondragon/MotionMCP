// AUTO-GENERATED — DO NOT EDIT MANUALLY
// Source: scripts/generate-types.ts  |  Run: npm run generate:types

import { FrequencyObject } from './motion';

export type ProjectsOperation = 'create' | 'list' | 'get';

export interface MotionProjectsArgs {
  operation: ProjectsOperation;
  projectId?: string;
  workspaceId?: string;
  workspaceName?: string;
  name?: string;
  description?: string;
  allWorkspaces?: boolean;
}

export type TasksOperation = 'create' | 'list' | 'get' | 'update' | 'delete' | 'move' | 'unassign' | 'list_all_uncompleted';

export interface MotionTasksArgs {
  operation: TasksOperation;
  taskId?: string;
  workspaceId?: string;
  workspaceName?: string;
  projectId?: string;
  projectName?: string;
  status?: string | string[];
  includeAllStatuses?: boolean;
  assigneeId?: string;
  assignee?: string;
  priority?: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate?: string;
  labels?: string[];
  name?: string;
  description?: string;
  duration?: 'NONE' | 'REMINDER' | number;
  autoScheduled?: {
    schedule: string;
    startDate?: string;
    deadlineType?: 'HARD' | 'SOFT' | 'NONE';
  } | null | string;
  targetWorkspaceId?: string;
  limit?: number;
}

export type WorkspacesOperation = 'list' | 'get';

export interface MotionWorkspacesArgs {
  operation: WorkspacesOperation;
  workspaceId?: string;
}

export interface MotionSearchArgs {
  operation: 'content';
  query?: string;
  searchScope?: 'tasks' | 'projects' | 'both';
  workspaceId?: string;
  workspaceName?: string;
  limit?: number;
}

export type UsersOperation = 'list' | 'current';

export interface MotionUsersArgs {
  operation: UsersOperation;
  workspaceId?: string;
  workspaceName?: string;
  teamId?: string;
}

export type CommentsOperation = 'list' | 'create';

export interface MotionCommentsArgs {
  operation: CommentsOperation;
  taskId: string;
  content?: string;
  cursor?: string;
}

export type CustomFieldsOperation = 'list' | 'create' | 'delete' | 'add_to_project' | 'remove_from_project' | 'add_to_task' | 'remove_from_task';

export interface MotionCustomFieldsArgs {
  operation: CustomFieldsOperation;
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

export type RecurringTasksOperation = 'list' | 'create' | 'delete';

export interface MotionRecurringTasksArgs {
  operation: RecurringTasksOperation;
  recurringTaskId?: string;
  workspaceId?: string;
  workspaceName?: string;
  name?: string;
  description?: string;
  projectId?: string;
  assigneeId?: string;
  frequency?: FrequencyObject;
  deadlineType?: 'HARD' | 'SOFT';
  duration?: number | 'REMINDER';
  startingOn?: string;
  idealTime?: string;
  schedule?: string;
  priority?: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface MotionSchedulesArgs {
  operation?: 'list';
}

export interface MotionStatusesArgs {
  workspaceId?: string;
}
