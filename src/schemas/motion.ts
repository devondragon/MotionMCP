/**
 * Runtime validation schemas for Motion API responses using Zod
 * These schemas ensure API responses match expected TypeScript types
 */

import { z } from 'zod';

// Base Motion Workspace schema - Updated to match API documentation
export const MotionWorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  teamId: z.string().nullable(),
  type: z.string(),
  labels: z.array(z.union([
    z.string(),
    z.object({ name: z.string() })
  ])),
  statuses: z.array(z.object({
    name: z.string(),
    isDefaultStatus: z.boolean(),
    isResolvedStatus: z.boolean()
  })).optional()
});

// Motion Status schema
export const MotionStatusSchema = z.object({
  name: z.string(),
  isDefaultStatus: z.boolean(),
  isResolvedStatus: z.boolean()
});

// Time slot schema
export const MotionTimeSlotSchema = z.object({
  start: z.string(),  // "HH:MM" format
  end: z.string()     // "HH:MM" format
});

// Schedule details schema
export const MotionScheduleDetailsSchema = z.object({
  monday: z.array(MotionTimeSlotSchema).optional(),
  tuesday: z.array(MotionTimeSlotSchema).optional(),
  wednesday: z.array(MotionTimeSlotSchema).optional(),
  thursday: z.array(MotionTimeSlotSchema).optional(),
  friday: z.array(MotionTimeSlotSchema).optional(),
  saturday: z.array(MotionTimeSlotSchema).optional(),
  sunday: z.array(MotionTimeSlotSchema).optional()
});

// Motion Schedule schema
export const MotionScheduleSchema = z.object({
  name: z.string(),
  isDefaultTimezone: z.boolean(),
  timezone: z.string(),
  schedule: MotionScheduleDetailsSchema
});

// Pagination metadata schema
export const MotionPaginationMetaSchema = z.object({
  nextCursor: z.string().optional(),
  pageSize: z.number()
});

// Wrapped response schemas (with pagination)
export const WorkspacesResponseSchema = z.object({
  meta: MotionPaginationMetaSchema.optional(),
  workspaces: z.array(MotionWorkspaceSchema)
});

// Direct array response schemas (no pagination wrapper) - union for backward compatibility
export const SchedulesResponseSchema = z.union([
  z.array(MotionScheduleSchema),
  z.object({
    schedules: z.array(MotionScheduleSchema)
  })
]);

export const StatusesResponseSchema = z.union([
  z.array(MotionStatusSchema),
  z.object({
    statuses: z.array(MotionStatusSchema)
  })
]);

export const WorkspacesListResponseSchema = z.union([
  WorkspacesResponseSchema,
  z.array(MotionWorkspaceSchema)
]);

export const SchedulesListResponseSchema = z.union([
  SchedulesResponseSchema,
  z.array(MotionScheduleSchema)
]);

export const StatusesListResponseSchema = z.union([
  StatusesResponseSchema,
  z.array(MotionStatusSchema)
]);

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
