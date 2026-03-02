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
        description: "Project name (required for create)"
      },
      description: {
        type: "string",
        description: "Project description"
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
        oneOf: [
          { type: "string" },
          { type: "array", items: { type: "string" } }
        ],
        description: "Filter by status (for list). Single string or array of strings (e.g., [\"Todo\", \"Completed\"]). Without status or includeAllStatuses, only active (non-resolved) tasks are returned. Use motion_statuses to list valid values per workspace."
      },
      includeAllStatuses: {
        type: "boolean",
        description: "When true, returns tasks across all statuses including completed/resolved (for list). Cannot be combined with status filter."
      },
      assigneeId: {
        type: "string",
        description: "Filter by assignee (for list/list_all_uncompleted), set assignee (for create/update), or reassign (for move)"
      },
      assignee: {
        type: "string",
        description: "Filter by assignee name, email, or 'me' shortcut (for list and list_all_uncompleted). Resolved to an ID automatically"
      },
      priority: {
        type: "string",
        description: "Filter by priority level (for list, filtered client-side): ASAP, HIGH, MEDIUM, LOW",
        enum: ["ASAP", "HIGH", "MEDIUM", "LOW"]
      },
      dueDate: {
        type: "string",
        description: "Due date (for create/update) or filter (for list, filtered client-side — returns tasks due on or before this date). Date-only values are stored as end-of-day UTC. Format: YYYY-MM-DD or relative like 'today', 'tomorrow'"
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
        description: "Task name (required for create, optional for list as case-insensitive substring search)"
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
        description: "Auto-scheduling configuration. Can be either:\n- A schedule name string: \"Work Hours\" (simple, no start date)\n- An object for full control: {\"schedule\": \"Work Hours\", \"startDate\": \"2025-03-05\", \"deadlineType\": \"SOFT\"}\nWhen the user specifies a start date, you MUST use the object form.\nUse motion_schedules to see available schedule names."
      },
      targetWorkspaceId: {
        type: "string",
        description: "Target workspace ID (required for move operation). Move transfers a task between workspaces — project-level targeting is not supported by the Motion API."
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
  description: "Manage Motion workspaces - supports list and get operations",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["list", "get"],
        description: "Operation to perform"
      },
      workspaceId: {
        type: "string",
        description: "Workspace ID (required for get operation)"
      }
    },
    required: ["operation"]
  }
};

export const searchToolDefinition: McpToolDefinition = {
  name: TOOL_NAMES.SEARCH,
  description: "Search Motion tasks and projects by query",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["content"],
        description: "Operation to perform"
      },
      query: {
        type: "string",
        description: "Search query (required)"
      },
      searchScope: {
        type: "string",
        enum: ["tasks", "projects", "both"],
        description: "What to search (default: both)"
      },
      workspaceId: {
        type: "string",
        description: "Workspace ID to limit search"
      },
      workspaceName: {
        type: "string",
        description: "Workspace name (alternative to workspaceId)"
      },
      limit: {
        type: "number",
        description: "Maximum number of results"
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
      },
      teamId: {
        type: "string",
        description: "Team ID to filter users by (optional for list operation)"
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
  description: "Manage custom fields for tasks and projects. Required params per operation: list: workspaceId or workspaceName. create: workspaceId/workspaceName + name + field (type); options[] also required for select/multiSelect. delete: workspaceId/workspaceName + fieldId. add_to_project: projectId + fieldId. remove_from_project: projectId + valueId. add_to_task: taskId + fieldId. remove_from_task: taskId + valueId.",
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
        description: "Custom field definition ID. Required for: delete, add_to_project, add_to_task. For remove operations, use valueId instead."
      },
      valueId: {
        type: "string",
        description: "Custom field value assignment ID (not the field definition ID). Required for: remove_from_project, remove_from_task."
      },
      workspaceId: {
        type: "string",
        description: "Workspace ID. Required for: list, create, delete."
      },
      workspaceName: {
        type: "string",
        description: "Workspace name (alternative to workspaceId). Required for: list, create, delete."
      },
      name: {
        type: "string",
        description: "Field name. Required for: create."
      },
      field: {
        type: "string",
        enum: ["text", "url", "date", "person", "multiPerson", "phone", "select", "multiSelect", "number", "email", "checkbox", "relatedTo"],
        description: "Field type. Required for: create. Also needed for add_to_project/add_to_task when providing a non-null value."
      },
      options: {
        type: "array",
        items: { type: "string" },
        description: "Option labels. Required for: create when field is select or multiSelect."
      },
      required: {
        type: "boolean",
        description: "Whether field is required on tasks/projects."
      },
      projectId: {
        type: "string",
        description: "Project ID. Required for: add_to_project, remove_from_project."
      },
      taskId: {
        type: "string",
        description: "Task ID. Required for: add_to_task, remove_from_task."
      },
      value: {
        oneOf: [
          { type: "string" },
          { type: "number" },
          { type: "boolean" },
          { type: "array", items: { type: "string" } },
          { type: "null" }
        ],
        description: "Field value to set. Optional for add_to_project/add_to_task. When provided and non-null, the field param (type) is also required."
      }
    },
    required: ["operation"]
  }
};

export const recurringTasksToolDefinition: McpToolDefinition = {
  name: TOOL_NAMES.RECURRING_TASKS,
  description: "Manage recurring tasks. Required params per operation: list: workspaceId or workspaceName. create: workspaceId/workspaceName + name + assigneeId + frequency (with frequency.type). delete: recurringTaskId.",
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
        description: "Recurring task ID. Required for: delete."
      },
      workspaceId: {
        type: "string",
        description: "Workspace ID. Required for: list, create."
      },
      workspaceName: {
        type: "string",
        description: "Workspace name (alternative to workspaceId). Required for: list, create."
      },
      name: {
        type: "string",
        description: "Task name. Required for: create."
      },
      description: {
        type: "string",
        description: "Task description."
      },
      projectId: {
        type: "string",
        description: "Project ID."
      },
      assigneeId: {
        type: "string",
        description: "User ID to assign the recurring task to. Required for: create."
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
  description: "Get all schedules showing weekly working hours and time zones. The Motion API returns all schedules with no filtering options.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["list"],
        description: "Operation to perform"
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
