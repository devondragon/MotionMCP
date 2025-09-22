import { McpToolDefinition } from '../types/mcp';

export const TOOL_NAMES = {
  PROJECTS: 'motion_projects',
  TASKS: 'motion_tasks',
  WORKSPACES: 'motion_workspaces',
  SEARCH: 'motion_search',
  USERS: 'motion_users',
  COMMENTS: 'motion_comments',
  CUSTOM_FIELDS: 'motion_custom_fields',
  RECURRING_TASKS: 'motion_recurring_tasks',
  SCHEDULES: 'motion_schedules',
  STATUSES: 'motion_statuses'
} as const;

export const projectsToolDefinition: McpToolDefinition = {
  name: TOOL_NAMES.PROJECTS,
  description: "Manage Motion projects - supports create, list, and get operations",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["create", "list", "get"],
        description: "Operation to perform"
      },
      projectId: {
        type: "string",
        description: "Project ID (required for get operation)"
      },
      workspaceId: {
        type: "string",
        description: "Workspace ID"
      },
      workspaceName: {
        type: "string",
        description: "Workspace name (alternative to ID)"
      },
      name: {
        type: "string",
        description: "Project name"
      },
      description: {
        type: "string",
        description: "Project description"
      },
      color: {
        type: "string",
        description: "Hex color code"
      },
      status: {
        type: "string",
        description: "Project status"
      },
      allWorkspaces: {
        type: "boolean",
        description: "List projects from all workspaces (for list operation only). When true and no workspace is specified, returns projects from all workspaces."
      }
    },
    required: ["operation"]
  }
};

export const tasksToolDefinition: McpToolDefinition = {
  name: TOOL_NAMES.TASKS,
  description: "Manage Motion tasks - supports create, list, get, update, delete, move, unassign, and list_all_uncompleted operations",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["create", "list", "get", "update", "delete", "move", "unassign", "list_all_uncompleted"],
        description: "Operation to perform"
      },
      taskId: {
        type: "string",
        description: "Task ID (required for get/update/delete/move/unassign)"
      },
      workspaceId: {
        type: "string",
        description: "Filter by workspace (for list)"
      },
      workspaceName: {
        type: "string",
        description: "Filter by workspace name (for list)"
      },
      projectId: {
        type: "string",
        description: "Filter by project (for list)"
      },
      projectName: {
        type: "string",
        description: "Project name (alternative to projectId)"
      },
      status: {
        type: "string",
        description: "Filter by status (for list)"
      },
      assigneeId: {
        type: "string",
        description: "Filter by assignee (for list)"
      },
      assignee: {
        type: "string",
        description: "Filter by assignee name, email, or 'me' shortcut (for list). Resolved to an ID automatically"
      },
      priority: {
        type: "string",
        description: "Filter by priority level (for list): ASAP, HIGH, MEDIUM, LOW",
        enum: ["ASAP", "HIGH", "MEDIUM", "LOW"]
      },
      dueDate: {
        type: "string",
        description: "Due date (for create/update) or filter (for list). Date-only values are stored as end-of-day UTC. Format: YYYY-MM-DD or relative like 'today', 'tomorrow'"
      },
      labels: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Filter by labels (for list). Array of label names"
      },
      name: {
        type: "string",
        description: "Task name (required for create)"
      },
      description: {
        type: "string",
        description: "Task description"
      },
      duration: {
        oneOf: [
          { type: "string", enum: ["NONE", "REMINDER"] },
          { type: "number", minimum: 0 }
        ],
        description: "Minutes (as number) or 'NONE'/'REMINDER' (as string)"
      },
      autoScheduled: {
        oneOf: [
          {
            type: "object",
            properties: {
              schedule: {
                type: "string",
                description: "Name of the schedule to use for auto-scheduling (e.g., 'Work Hours')"
              },
              startDate: {
                type: "string",
                description: "Optional start date for auto-scheduling (ISO 8601 format)"
              },
              deadlineType: {
                type: "string",
                enum: ["HARD", "SOFT", "NONE"],
                description: "Deadline type for auto-scheduling (default: SOFT)"
              }
            },
            required: ["schedule"]
          },
          { type: "null" },
          { type: "string", description: "Schedule name (shorthand for {schedule: 'name'})" }
        ],
        description: "Auto-scheduling configuration. Requires a schedule name. Use motion_schedules to see available schedules. Examples: 'Work Hours' or {schedule: 'Work Hours', deadlineType: 'SOFT'}"
      },
      targetProjectId: {
        type: "string",
        description: "Target project for move operation"
      },
      targetWorkspaceId: {
        type: "string",
        description: "Target workspace for move operation"
      },
      limit: {
        type: "number",
        description: "Maximum number of tasks to return (for list and list_all_uncompleted)"
      }
    },
    required: ["operation"]
  }
};

export const workspacesToolDefinition: McpToolDefinition = {
  name: TOOL_NAMES.WORKSPACES,
  description: "Manage Motion workspaces - supports list, get, and set_default operations",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["list", "get", "set_default"],
        description: "Operation to perform"
      },
      workspaceId: {
        type: "string",
        description: "Workspace ID (required for get and set_default operations)"
      }
    },
    required: ["operation"]
  }
};

export const searchToolDefinition: McpToolDefinition = {
  name: TOOL_NAMES.SEARCH,
  description: "Search and context utilities for Motion - supports content, context, and smart operations",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["content", "context", "smart"],
        description: "Operation to perform"
      },
      query: {
        type: "string",
        description: "Search query (required for content and smart operations)"
      },
      searchScope: {
        type: "string",
        enum: ["tasks", "projects", "both"],
        description: "What to search for content operation (default: both)"
      },
      workspaceId: {
        type: "string",
        description: "Workspace ID to limit search/context"
      },
      workspaceName: {
        type: "string",
        description: "Workspace name (alternative to workspaceId)"
      },
      limit: {
        type: "number",
        description: "Maximum number of results for content operation"
      },
      includeProjects: {
        type: "boolean",
        description: "Include project information for context operation"
      },
      includeTasks: {
        type: "boolean",
        description: "Include task information for context operation"
      },
      includeUsers: {
        type: "boolean",
        description: "Include user information for context operation"
      },
      entityType: {
        type: "string",
        enum: ["project", "task"],
        description: "Entity type for smart operation"
      },
      entityId: {
        type: "string",
        description: "Entity ID for smart operation"
      },
      includeRelated: {
        type: "boolean",
        description: "Include related entities for smart operation"
      }
    },
    required: ["operation"]
  }
};

export const usersToolDefinition: McpToolDefinition = {
  name: TOOL_NAMES.USERS,
  description: "Manage users and get current user information",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["list", "current"],
        description: "Operation to perform"
      },
      workspaceId: {
        type: "string",
        description: "Workspace ID (optional for list operation, ignored for current)"
      },
      workspaceName: {
        type: "string",
        description: "Workspace name (alternative to workspaceId, ignored for current)"
      }
    },
    required: ["operation"]
  }
};

export const commentsToolDefinition: McpToolDefinition = {
  name: TOOL_NAMES.COMMENTS,
  description: "Manage comments on tasks",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["list", "create"],
        description: "Operation to perform"
      },
      taskId: {
        type: "string",
        description: "Task ID to comment on or fetch comments from (required)"
      },
      content: {
        type: "string",
        description: "Comment content (required for create operation)"
      },
      cursor: {
        type: "string",
        description: "Pagination cursor for list operation (optional)"
      }
    },
    required: ["operation", "taskId"]
  }
};

export const customFieldsToolDefinition: McpToolDefinition = {
  name: TOOL_NAMES.CUSTOM_FIELDS,
  description: "Manage custom fields for tasks and projects",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["list", "create", "delete", "add_to_project", "remove_from_project", "add_to_task", "remove_from_task"],
        description: "Operation to perform"
      },
      fieldId: {
        type: "string",
        description: "Custom field ID"
      },
      workspaceId: {
        type: "string",
        description: "Workspace ID"
      },
      name: {
        type: "string",
        description: "Field name (for create)"
      },
      field: {
        type: "string",
        enum: ["text", "url", "date", "person", "multiPerson", "phone", "select", "multiSelect", "number", "email", "checkbox", "relatedTo"],
        description: "Field type (for create)"
      },
      options: {
        type: "array",
        items: { type: "string" },
        description: "Options for select/multiselect fields"
      },
      required: {
        type: "boolean",
        description: "Whether field is required"
      },
      projectId: {
        type: "string",
        description: "Project ID (for add/remove operations)"
      },
      taskId: {
        type: "string",
        description: "Task ID (for add/remove operations)"
      },
      value: {
        type: ["string", "number", "boolean", "array", "null"],
        description: "Field value"
      }
    },
    required: ["operation", "workspaceId"]
  }
};

export const recurringTasksToolDefinition: McpToolDefinition = {
  name: TOOL_NAMES.RECURRING_TASKS,
  description: "Manage recurring tasks",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["list", "create", "delete"],
        description: "Operation to perform"
      },
      recurringTaskId: {
        type: "string",
        description: "Recurring task ID (for delete)"
      },
      workspaceId: {
        type: "string",
        description: "Workspace ID"
      },
      name: {
        type: "string",
        description: "Task name (for create)"
      },
      description: {
        type: "string",
        description: "Task description"
      },
      projectId: {
        type: "string",
        description: "Project ID"
      },
      assigneeId: {
        type: "string",
        description: "User ID to assign the recurring task to (required for create)"
      },
      frequency: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly", "custom"],
            description: "Frequency type - supports all Motion API patterns including biweekly and quarterly"
          },
          daysOfWeek: {
            type: "array",
            items: { type: "number" },
            description: "0-6 for Sunday-Saturday. Used with daily/weekly/biweekly for specific days, and with monthly/quarterly patterns (e.g., monthly_first_MO, quarterly_first_MO) for specifying days in those recurrence types"
          },
          dayOfMonth: {
            type: "number",
            description: "1-31 for monthly recurrence on specific day of month"
          },
          weekOfMonth: {
            type: "string",
            enum: ["first", "second", "third", "fourth", "last"],
            description: "Which week of month/quarter for monthly/quarterly patterns; daysOfWeek is optional (e.g., monthly_any_day_first_week or monthly_monday_first_week)"
          },
          monthOfQuarter: {
            type: "number",
            enum: [1, 2, 3],
            description: "Which month of quarter (1-3) for quarterly patterns"
          },
          interval: {
            type: "number",
            description: "Legacy support: weekly with interval:2 maps to biweekly patterns"
          },
          customPattern: {
            type: "string",
            description: "Direct Motion API frequency pattern string (e.g., 'monthly_any_week_day_first_week')"
          },
          endDate: {
            type: "string",
            description: "ISO 8601 format end date for the recurring task"
          }
        },
        required: ["type"],
        description: "Frequency configuration (required for create)"
      },
      deadlineType: {
        type: "string",
        enum: ["HARD", "SOFT"],
        description: "Deadline type (default: SOFT)"
      },
      duration: {
        oneOf: [
          { type: "number" },
          { type: "string", enum: ["REMINDER"] }
        ],
        description: "Task duration in minutes or REMINDER"
      },
      startingOn: {
        type: "string",
        description: "Start date (ISO 8601 format)"
      },
      idealTime: {
        type: "string",
        description: "Ideal time in HH:mm format"
      },
      schedule: {
        type: "string",
        description: "Schedule name (default: Work Hours)"
      },
      priority: {
        type: "string",
        enum: ["ASAP", "HIGH", "MEDIUM", "LOW"],
        description: "Task priority (default: MEDIUM)"
      }
    },
    required: ["operation"]
  }
};

export const schedulesToolDefinition: McpToolDefinition = {
  name: TOOL_NAMES.SCHEDULES,
  description: "Get user schedules showing their weekly working hours and time zones",
  inputSchema: {
    type: "object",
    properties: {
      userId: {
        type: "string",
        description: "User ID to get schedule for (optional, returns all schedules if not specified)"
      },
      startDate: {
        type: "string",
        description: "Start date for filtering schedules (optional)"
      },
      endDate: {
        type: "string",
        description: "End date for filtering schedules (optional)"
      }
    },
    additionalProperties: false
  }
};

export const statusesToolDefinition: McpToolDefinition = {
  name: TOOL_NAMES.STATUSES,
  description: "Get available task/project statuses for a workspace",
  inputSchema: {
    type: "object",
    properties: {
      workspaceId: {
        type: "string",
        description: "Workspace ID to get statuses for (optional, returns all statuses if not specified)"
      }
    },
    additionalProperties: false
  }
};

// Combined tool definitions array
export const allToolDefinitions: McpToolDefinition[] = [
  projectsToolDefinition,
  tasksToolDefinition,
  workspacesToolDefinition,
  searchToolDefinition,
  usersToolDefinition,
  commentsToolDefinition,
  customFieldsToolDefinition,
  recurringTasksToolDefinition,
  schedulesToolDefinition,
  statusesToolDefinition
];
