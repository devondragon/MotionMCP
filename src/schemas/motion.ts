/**
 * Runtime validation schemas for Motion API responses using Zod
 * These schemas ensure API responses match expected TypeScript types
 */

import { z } from 'zod';

// Base Motion Workspace schema
export const MotionWorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

// Base Motion Project schema
export const MotionProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  workspaceId: z.string(),
  color: z.string().optional(),
  status: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

// Base Motion Task schema
export const MotionTaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  workspaceId: z.string(),
  projectId: z.string().optional(),
  status: z.string().optional(),
  priority: z.enum(['ASAP', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  dueDate: z.string().optional(),
  duration: z.union([
    z.number(),
    z.literal('NONE'),
    z.literal('REMINDER')
  ]).optional(),
  assigneeId: z.string().optional(),
  labels: z.array(z.string()).optional(),
  autoScheduled: z.object({}).nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

// Motion User schema
export const MotionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().optional()
});

// Motion Comment schema
export const MotionCommentSchema = z.object({
  id: z.string(),
  taskId: z.string().optional(),
  projectId: z.string().optional(),
  content: z.string(),
  authorId: z.string(),
  createdAt: z.string()
});

// Motion Status schema
export const MotionStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  isCompleted: z.boolean()
});

// Schedule details schema
export const MotionScheduleDetailsSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  recurrence: z.object({
    pattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    interval: z.number(),
    daysOfWeek: z.array(z.number()).optional(),
    dayOfMonth: z.number().optional(),
    endDate: z.string().optional()
  }).optional(),
  blockedTimes: z.array(z.object({
    start: z.string(),
    end: z.string(),
    reason: z.string().optional()
  })).optional(),
  workingHours: z.object({
    start: z.string(),
    end: z.string(),
    timezone: z.string(),
    daysOfWeek: z.array(z.number()).optional()
  }).optional()
});

// Motion Schedule schema
export const MotionScheduleSchema = z.object({
  id: z.string(),
  userId: z.string(),
  schedule: MotionScheduleDetailsSchema
});

// List response schemas
export const ProjectsListResponseSchema = z.union([
  z.object({
    projects: z.array(MotionProjectSchema)
  }),
  z.array(MotionProjectSchema)
]);

export const TasksListResponseSchema = z.union([
  z.object({
    tasks: z.array(MotionTaskSchema)
  }),
  z.array(MotionTaskSchema)
]);

export const WorkspacesListResponseSchema = z.union([
  z.object({
    workspaces: z.array(MotionWorkspaceSchema)
  }),
  z.array(MotionWorkspaceSchema)
]);

export const UsersListResponseSchema = z.union([
  z.object({
    users: z.array(MotionUserSchema)
  }),
  z.array(MotionUserSchema)
]);

export const SchedulesListResponseSchema = z.union([
  z.object({
    schedules: z.array(MotionScheduleSchema)
  }),
  z.array(MotionScheduleSchema)
]);

// Type inference from schemas
export type MotionWorkspaceValidated = z.infer<typeof MotionWorkspaceSchema>;
export type MotionProjectValidated = z.infer<typeof MotionProjectSchema>;
export type MotionTaskValidated = z.infer<typeof MotionTaskSchema>;
export type MotionUserValidated = z.infer<typeof MotionUserSchema>;
export type MotionScheduleValidated = z.infer<typeof MotionScheduleSchema>;

// Validation configuration
export const VALIDATION_CONFIG = {
  // Strict mode: throw on validation errors
  // Lenient mode: log warnings and filter invalid items
  // Off: no runtime validation
  mode: process.env.VALIDATION_MODE || 'lenient' as 'strict' | 'lenient' | 'off',
  
  // Log validation errors even in lenient mode
  logErrors: true,
  
  // Include raw data in error logs (be careful with sensitive data)
  includeDataInLogs: process.env.NODE_ENV === 'development'
};