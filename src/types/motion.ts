export interface MotionWorkspace {
  id: string;
  name: string;
  type: string;
}

// Minimal interfaces for nested object references

/**
 * A minimal reference to a Motion Project, typically used in nested objects
 */
export interface ProjectReference {
  id: string;
  name: string;
  workspaceId?: string;
}

/**
 * A minimal reference to a Motion Workspace, typically used in nested objects
 */
export interface WorkspaceReference {
  id: string;
  name: string;
  type?: string;
}

/**
 * A minimal reference to a Motion User/Assignee, typically used in nested objects
 */
export interface AssigneeReference {
  id: string;
  name: string;
  email?: string;
}

/**
 * A time chunk reference in Motion, representing a scheduled time block
 */
export interface ChunkReference {
  id: string;
  /** ISO 8601 date-time string for the start of the chunk */
  start: string;
  /** ISO 8601 date-time string for the end of the chunk */
  end: string;
  [key: string]: unknown;
}

export interface MotionProject {
  id: string;
  name: string;
  description?: string;
  workspaceId: string;
  color?: string;
  status?: string | {
    name: string;
    isDefaultStatus?: boolean;
    isResolvedStatus?: boolean;
  };
  createdTime?: string;
  updatedTime?: string;
  customFieldValues?: Record<string, unknown>;
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
  autoScheduled?: Record<string, unknown> | null;
  completed?: boolean;
  completedTime?: string;
  createdTime?: string;
  updatedTime?: string;
  startOn?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  deadlineType?: string;
  parentRecurringTaskId?: string;
  creator?: AssigneeReference;
  project?: ProjectReference;
  workspace?: WorkspaceReference;
  assignees?: AssigneeReference[];
  schedulingIssue?: boolean;
  lastInteractedTime?: string;
  customFieldValues?: Record<string, unknown>;
  chunks?: ChunkReference[];
}

export interface MotionComment {
  id: string;
  content: string;
  authorId: string;
  taskId?: string;
  projectId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCommentData {
  content: string;
  taskId?: string;
  projectId?: string;
  authorId?: string;
}

export interface MotionUser {
  id: string;
  name: string;
  email?: string;
}

export interface MotionCustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox';
  options?: string[];
  required?: boolean;
  workspaceId?: string;
}

export interface CreateCustomFieldData {
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox';
  workspaceId?: string;
  options?: string[];
  required?: boolean;
}

export interface MotionRecurringTask {
  id: string;
  name: string;
  description?: string;
  workspaceId: string;
  projectId?: string;
  recurrence: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval?: number;
    daysOfWeek?: number[];  // 0-6 for Sunday-Saturday
    dayOfMonth?: number;    // 1-31 for monthly recurrence
    endDate?: string;       // ISO 8601 format
  };
  nextOccurrence?: string;
  createdTime?: string;
  updatedTime?: string;
}

export interface CreateRecurringTaskData {
  name: string;
  description?: string;
  workspaceId?: string;
  projectId?: string;
  recurrence: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    endDate?: string;
  };
}

export interface MotionStatus {
  id: string;
  name: string;
  color?: string;
  isCompleted: boolean;
}

export interface MotionScheduleDetails {
  startDate: string;
  endDate: string;
  recurrence?: {
    pattern: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    daysOfWeek?: number[];  // 0-6, Sunday to Saturday
    dayOfMonth?: number;
    endDate?: string;
  };
  blockedTimes?: Array<{
    start: string;
    end: string;
    reason?: string;
  }>;
  workingHours?: {
    start: string;  // e.g., "09:00"
    end: string;    // e.g., "17:00"
    timezone: string;
    daysOfWeek?: number[];
  };
}

export interface MotionSchedule {
  id: string;
  userId: string;
  schedule: MotionScheduleDetails;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status?: number;
}

export interface ListResponse<T> {
  items?: T[];
  projects?: T[];
  tasks?: T[];
  workspaces?: T[];
  users?: T[];
  comments?: T[];
  customFields?: T[];
  recurringTasks?: T[];
  schedules?: T[];
}

export interface MotionApiErrorResponse {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  statusCode?: number;
}

export interface MotionApiError extends Error {
  response?: {
    status: number;
    statusText: string;
    data?: MotionApiErrorResponse;
  };
}