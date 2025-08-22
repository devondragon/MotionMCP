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
  teamId: string; // Added required teamId field
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
  duration: number;
  /** ISO 8601 date-time string for the start of the chunk */
  scheduledStart: string;
  /** ISO 8601 date-time string for the end of the chunk */
  scheduledEnd: string;
  completedTime?: string;
  isFixed: boolean;
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
  description?: string; // Optional in CREATE, may be empty string in responses
  workspaceId: string;
  color?: string;
  status?: string | {
    name: string;
    isDefaultStatus: boolean;
    isResolvedStatus: boolean;
  };
  createdTime?: string;
  updatedTime?: string;
  customFieldValues?: Record<string, MotionCustomFieldValue>;
}

/**
 * A custom field value in Motion, with type and value information
 */
export interface MotionCustomFieldValue {
  type: string; // e.g., 'SELECT', 'TEXT', 'NUMBER', 'DATE', etc.
  value: any;   // The actual value, which can be of various types
}

export interface MotionTask {
  id: string;
  name: string;
  description?: string;
  workspaceId: string;
  projectId?: string;
  status?: string | {
    name: string;
    isDefaultStatus: boolean;
    isResolvedStatus: boolean;
  };
  priority?: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate?: string;
  duration?: number | 'REMINDER';
  assigneeId?: string;
  labels?: Array<{name: string}>;
  autoScheduled?: Record<string, unknown> | null;
  completed?: boolean;
  completedTime?: string;
  createdTime?: string;
  updatedTime?: string;
  startOn?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  deadlineType?: 'HARD' | 'SOFT' | 'NONE';
  parentRecurringTaskId?: string;
  
  // Full nested objects with complete field definitions
  creator?: {
    id: string;
    name: string;
    email: string;
  };
  
  project?: {
    id: string;
    name: string;
    description?: string;
    workspaceId: string;
    status?: {
      name: string;
      isDefaultStatus: boolean;
      isResolvedStatus: boolean;
    };
  };
  
  workspace: {
    id: string;
    name: string;
    teamId: string; // Added required teamId field
    type: string;
  };
  
  assignees?: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  
  schedulingIssue?: boolean;
  lastInteractedTime?: string;
  customFieldValues?: Record<string, MotionCustomFieldValue>;
  chunks?: Array<{
    id: string;
    duration: number;
    scheduledStart: string; // Fixed field name from 'start'
    scheduledEnd: string;   // Fixed field name from 'end'
    completedTime?: string;
    isFixed: boolean;       // Added missing isFixed field
  }>;
}

export interface MotionComment {
  id: string;
  taskId: string;
  content: string;
  createdAt: string;
  creator: AssigneeReference;
}

export interface CreateCommentData {
  taskId: string;
  content: string;
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
    customFieldValues?: Record<string, MotionCustomFieldValue>;
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