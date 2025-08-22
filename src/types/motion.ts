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

/**
 * Pagination metadata for Motion API responses
 */
export interface MotionPaginationMeta {
  nextCursor?: string;
  pageSize: number;
}

/**
 * Generic paginated response structure for Motion API
 */
export interface MotionPaginatedResponse<T> {
  data: T[];
  meta: MotionPaginationMeta;
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
  taskId: string;
  content: string;
  createdAt: string;
  creator: AssigneeReference;
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
  field: 'text' | 'url' | 'date' | 'person' | 'multiPerson' | 
         'phone' | 'select' | 'multiSelect' | 'number' |
         'email' | 'checkbox' | 'relatedTo';
}

export interface CreateCustomFieldData {
  name: string;
  field: 'text' | 'url' | 'date' | 'person' | 'multiPerson' | 
        'phone' | 'select' | 'multiSelect' | 'number' |
        'email' | 'checkbox' | 'relatedTo';
  metadata?: Record<string, unknown>;
}

export interface MotionRecurringTask {
  id: string;
  name: string;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  project: {
    id: string;
    name: string;
    description: string;
    workspaceId: string;
    status: {
      name: string;
      isDefaultStatus: boolean;
      isResolvedStatus: boolean;
    };
    customFieldValues?: Record<string, unknown>;
  };
  workspace: {
    id: string;
    name: string;
    teamId: string;
    type: string;
    labels: Array<{name: string}>;
    statuses: Array<{
      name: string;
      isDefaultStatus: boolean;
      isResolvedStatus: boolean;
    }>;
  };
  status: {
    name: string;
    isDefaultStatus: boolean;
    isResolvedStatus: boolean;
  };
  priority: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';
  labels: Array<{name: string}>;
}

export interface CreateRecurringTaskData {
  name: string;
  workspaceId: string;
  projectId?: string;
  assigneeId: string;
  frequency: {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    endDate?: string;
  };
  description?: string;
  deadlineType?: 'HARD' | 'SOFT';
  duration?: number | 'REMINDER';
  startingOn?: string;
  idealTime?: string;
  schedule?: string;
  priority?: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface MotionStatus {
  name: string;
  isDefaultStatus: boolean;
  isResolvedStatus: boolean;
}

export interface MotionTimeSlot {
  start: string;  // "HH:MM" format
  end: string;    // "HH:MM" format
}

export interface MotionScheduleDetails {
  monday?: MotionTimeSlot[];
  tuesday?: MotionTimeSlot[];
  wednesday?: MotionTimeSlot[];
  thursday?: MotionTimeSlot[];
  friday?: MotionTimeSlot[];
  saturday?: MotionTimeSlot[];
  sunday?: MotionTimeSlot[];
}

export interface MotionSchedule {
  name: string;
  isDefaultTimezone: boolean;
  timezone: string;
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