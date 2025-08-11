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

export interface MotionCustomField {
  id: string;
  name: string;
  type: string;
  options?: string[];
}

export interface MotionRecurringTask {
  id: string;
  name: string;
  pattern: string;
  nextOccurrence?: string;
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