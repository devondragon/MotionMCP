/**
 * Runtime validation schemas for Motion API responses using Zod
 * These schemas ensure API responses match expected TypeScript types
 */

import { z } from 'zod';

// Base Motion Workspace schema - Updated to match API documentation
export const MotionWorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  teamId: z.string(),
  type: z.string(),
  labels: z.array(z.object({
    name: z.string()
  })),
  statuses: z.array(z.object({
    name: z.string(),
    isDefaultStatus: z.boolean(),
    isResolvedStatus: z.boolean()
  }))
});

// Base Motion Project schema - Updated to match API documentation
export const MotionProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(), // Required according to API docs
  workspaceId: z.string(),
  status: z.union([
    z.string(),
    z.object({
      name: z.string(),
      isDefaultStatus: z.boolean(),
      isResolvedStatus: z.boolean()
    })
  ]).optional(),
  createdTime: z.string().optional(),
  updatedTime: z.string().optional(),
  customFieldValues: z.record(z.object({
    type: z.string(),
    value: z.unknown()
  })).optional()
});

// Base Motion Task schema - Updated to match API documentation and interface changes
export const MotionTaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  workspaceId: z.string(),
  projectId: z.string().optional(),
  status: z.union([
    z.string(),
    z.object({
      name: z.string(),
      isDefaultStatus: z.boolean(),
      isResolvedStatus: z.boolean()
    })
  ]).optional(),
  priority: z.enum(['ASAP', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  dueDate: z.string().optional(),
  duration: z.union([
    z.number(),
    z.literal('NONE'),
    z.literal('REMINDER')
  ]).optional(),
  deadlineType: z.enum(['HARD', 'SOFT', 'NONE']),
  parentRecurringTaskId: z.string(),
  completed: z.boolean(),
  assigneeId: z.string().optional(),
  labels: z.array(z.object({
    name: z.string()
  })).optional(),
  autoScheduled: z.record(z.unknown()).nullable().optional(),
  completedTime: z.string().optional(),
  createdTime: z.string(),
  updatedTime: z.string().optional(),
  startOn: z.string().optional(),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  schedulingIssue: z.boolean(),
  lastInteractedTime: z.string().optional(),
  
  // Nested objects
  creator: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string()
  }).optional(),
  
  workspace: z.object({
    id: z.string(),
    name: z.string(),
    teamId: z.string(),
    type: z.string(),
    labels: z.array(z.object({
      name: z.string()
    })),
    statuses: z.array(z.object({
      name: z.string(),
      isDefaultStatus: z.boolean(),
      isResolvedStatus: z.boolean()
    }))
  }),
  
  project: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    workspaceId: z.string(),
    status: z.object({
      name: z.string(),
      isDefaultStatus: z.boolean(),
      isResolvedStatus: z.boolean()
    }).optional()
  }).optional(),
  
  assignees: z.array(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string()
  })),
  
  customFieldValues: z.record(z.object({
    type: z.string(),
    value: z.unknown()
  })).optional(),
  
  chunks: z.array(z.object({
    id: z.string(),
    duration: z.number(),
    scheduledStart: z.string(),
    scheduledEnd: z.string(),
    completedTime: z.string().optional(),
    isFixed: z.boolean()
  })).optional()
});

// Motion User schema
export const MotionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().optional()
});

// Motion Comment schema - Updated to match API documentation
export const MotionCommentSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  content: z.string(),
  createdAt: z.string(),
  creator: z.object({
    id: z.string(),
    name: z.string().optional(),
    email: z.string().optional()
  })
});

// Motion Custom Field schema - New schema for Custom Fields API
export const MotionCustomFieldSchema = z.object({
  id: z.string(),
  field: z.enum([
    'text', 'url', 'date', 'person', 'multiPerson',
    'phone', 'select', 'multiSelect', 'number',
    'email', 'checkbox', 'relatedTo'
  ])
});

// Motion Recurring Task schema - Updated to match API structure (returns task instances)
export const MotionRecurringTaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  creator: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string()
  }),
  assignee: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string()
  }).optional(),
  project: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    workspaceId: z.string(),
    status: z.object({
      name: z.string(),
      isDefaultStatus: z.boolean(),
      isResolvedStatus: z.boolean()
    }),
    customFieldValues: z.record(z.object({
      type: z.string(),
      value: z.unknown()
    })).optional()
  }),
  workspace: z.object({
    id: z.string(),
    name: z.string(),
    teamId: z.string(),
    type: z.string(),
    labels: z.array(z.object({
      name: z.string()
    })),
    statuses: z.array(z.object({
      name: z.string(),
      isDefaultStatus: z.boolean(),
      isResolvedStatus: z.boolean()
    }))
  }),
  status: z.object({
    name: z.string(),
    isDefaultStatus: z.boolean(),
    isResolvedStatus: z.boolean()
  }),
  priority: z.enum(['ASAP', 'HIGH', 'MEDIUM', 'LOW']),
  labels: z.array(z.object({
    name: z.string()
  }))
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
export const TasksResponseSchema = z.object({
  meta: MotionPaginationMetaSchema,
  tasks: z.array(MotionTaskSchema)
});

export const ProjectsResponseSchema = z.object({
  meta: MotionPaginationMetaSchema,
  projects: z.array(MotionProjectSchema)
});

export const CommentsResponseSchema = z.object({
  meta: MotionPaginationMetaSchema,
  comments: z.array(MotionCommentSchema)
});

export const WorkspacesResponseSchema = z.object({
  meta: MotionPaginationMetaSchema,
  workspaces: z.array(MotionWorkspaceSchema)
});

export const RecurringTasksResponseSchema = z.object({
  meta: MotionPaginationMetaSchema,
  tasks: z.array(MotionRecurringTaskSchema) // API returns "tasks" key for recurring tasks
});

export const CustomFieldsResponseSchema = z.object({
  meta: MotionPaginationMetaSchema,
  customFields: z.array(MotionCustomFieldSchema)
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

export const UsersResponseSchema = z.union([
  z.array(MotionUserSchema),
  z.object({
    users: z.array(MotionUserSchema)
  })
]);

// Legacy schemas for backward compatibility
export const ProjectsListResponseSchema = z.union([
  ProjectsResponseSchema,
  z.array(MotionProjectSchema)
]);

export const TasksListResponseSchema = z.union([
  TasksResponseSchema,
  z.array(MotionTaskSchema)
]);

export const WorkspacesListResponseSchema = z.union([
  WorkspacesResponseSchema,
  z.array(MotionWorkspaceSchema)
]);

export const UsersListResponseSchema = z.union([
  UsersResponseSchema,
  z.array(MotionUserSchema)
]);

export const SchedulesListResponseSchema = z.union([
  SchedulesResponseSchema,
  z.array(MotionScheduleSchema)
]);

export const StatusesListResponseSchema = z.union([
  StatusesResponseSchema,
  z.array(MotionStatusSchema)
]);

// Type inference from schemas
export type MotionWorkspaceValidated = z.infer<typeof MotionWorkspaceSchema>;
export type MotionProjectValidated = z.infer<typeof MotionProjectSchema>;
export type MotionTaskValidated = z.infer<typeof MotionTaskSchema>;
export type MotionUserValidated = z.infer<typeof MotionUserSchema>;
export type MotionCommentValidated = z.infer<typeof MotionCommentSchema>;
export type MotionCustomFieldValidated = z.infer<typeof MotionCustomFieldSchema>;
export type MotionRecurringTaskValidated = z.infer<typeof MotionRecurringTaskSchema>;
export type MotionScheduleValidated = z.infer<typeof MotionScheduleSchema>;
export type MotionStatusValidated = z.infer<typeof MotionStatusSchema>;
export type MotionPaginationMetaValidated = z.infer<typeof MotionPaginationMetaSchema>;

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