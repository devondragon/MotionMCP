#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MotionApiService } from './services/motionApi';
import { CreateCommentData, CreateCustomFieldData, CreateRecurringTaskData } from './types/motion';
import { 
  WorkspaceResolver,
  formatMcpError,
  formatMcpSuccess,
  formatProjectList,
  formatTaskList,
  formatDetailResponse,
  parseTaskArgs,
  parseProjectArgs,
  formatWorkspaceList,
  formatSearchResults,
  formatCommentList,
  formatCommentDetail,
  formatCustomFieldList,
  formatCustomFieldDetail,
  formatCustomFieldSuccess,
  formatRecurringTaskList,
  formatRecurringTaskDetail,
  formatScheduleList,
  mcpLog,
  LOG_LEVELS,
  LIMITS
} from './utils';
import { InputValidator } from './utils/validator';
import { McpToolResponse, McpToolDefinition } from './types/mcp';
import * as ToolArgs from './types/mcp-tool-args';
import { MotionProjectsArgs, MotionTasksArgs, MotionSchedulesArgs } from './types/mcp-tool-args';
import * as dotenv from 'dotenv';

dotenv.config();

class MotionMCPServer {
  private server: Server;
  private motionService: MotionApiService | null;
  private workspaceResolver: WorkspaceResolver | null;
  private validator: InputValidator;
  private toolsConfig: string;

  constructor() {
    this.server = new Server(
      {
        name: "motion-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.motionService = null;
    this.workspaceResolver = null;
    this.validator = new InputValidator();
    this.toolsConfig = process.env.MOTION_MCP_TOOLS || 'essential';
    this.setupHandlers();
  }

  async initialize(): Promise<void> {
    try {
      // Validate tools configuration
      this.validateToolsConfig();
      
      this.motionService = new MotionApiService();
      this.workspaceResolver = new WorkspaceResolver(this.motionService);
      
      // Initialize validators with tool definitions
      this.validator.initializeValidators(this.getEnabledTools());
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      mcpLog(LOG_LEVELS.ERROR, "Failed to initialize Motion API service", { error: errorMessage });
      process.exit(1);
    }
  }

  private validateToolsConfig(): void {
    const validConfigs = ['minimal', 'essential', 'all'];
    
    // Check if it's a valid preset or custom configuration
    if (!validConfigs.includes(this.toolsConfig) && !this.toolsConfig.startsWith('custom:')) {
      mcpLog(LOG_LEVELS.ERROR, `Invalid MOTION_MCP_TOOLS configuration: "${this.toolsConfig}"`, {
        validOptions: [...validConfigs, 'custom:tool1,tool2,...'],
        defaulting: 'essential'
      });
      
      // Still default to essential, but log it prominently
      mcpLog(LOG_LEVELS.WARN, 'Defaulting to "essential" configuration');
      this.toolsConfig = 'essential';
    }
    
    // For custom configurations, validate tool names exist
    if (this.toolsConfig.startsWith('custom:')) {
      const customTools = this.toolsConfig.substring(7).split(',').map(s => s.trim());
      const allToolNames = this.getAllToolDefinitions().map(t => t.name);
      const invalidTools = customTools.filter(name => !allToolNames.includes(name));
      
      if (invalidTools.length > 0) {
        mcpLog(LOG_LEVELS.ERROR, 'Invalid tool names in custom configuration', {
          invalidTools,
          availableTools: allToolNames
        });
        throw new Error(`Invalid tool names in custom configuration: ${invalidTools.join(', ')}`);
      }
      
      if (customTools.length === 0) {
        throw new Error('Custom configuration must specify at least one tool');
      }
    }
    
    mcpLog(LOG_LEVELS.INFO, `Tool configuration validated: ${this.toolsConfig}`);
  }

  setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getEnabledTools()
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.motionService || !this.workspaceResolver) {
        return formatMcpError(new Error("Server not initialized"));
      }

      try {
        const { name, arguments: args } = request.params;
        
        // Runtime validation
        const validation = this.validator.validateInput(name, args);
        if (!validation.valid) {
          return formatMcpError(
            new Error(`Invalid arguments for ${name}: ${validation.errors}`)
          );
        }
        
        switch (name) {
          // Consolidated tools
          case "motion_projects":
            return await this.handleMotionProjects(args as unknown as MotionProjectsArgs);
          case "motion_tasks":
            return await this.handleMotionTasks(args as unknown as MotionTasksArgs);
          // Legacy individual tools (kept for backward compatibility if needed)
          case "create_motion_project":
            return await this.handleCreateProject(args as unknown as ToolArgs.CreateProjectArgs);
          case "list_motion_projects":
            return await this.handleListProjects(args as unknown as ToolArgs.ListProjectsArgs || {});
          case "get_motion_project":
            return await this.handleGetProject(args as unknown as ToolArgs.GetProjectArgs);
          case "create_motion_task":
            return await this.handleCreateTask(args as unknown as ToolArgs.CreateTaskArgs);
          case "list_motion_tasks":
            return await this.handleListTasks(args as unknown as ToolArgs.ListTasksArgs || {});
          case "get_motion_task":
            return await this.handleGetTask(args as unknown as ToolArgs.GetTaskArgs);
          case "update_motion_task":
            return await this.handleUpdateTask(args as unknown as ToolArgs.UpdateTaskArgs);
          case "delete_motion_task":
            return await this.handleDeleteTask(args as unknown as ToolArgs.DeleteTaskArgs);
          // Other tools remain unchanged
          case "list_motion_workspaces":
            return await this.handleListWorkspaces({});
          case "list_motion_users":
            return await this.handleListUsers(args as unknown as ToolArgs.ListUsersArgs || {});
          case "search_motion_content":
            return await this.handleSearchContent(args as unknown as ToolArgs.SearchContentArgs);
          case "get_motion_context":
            return await this.handleGetContext(args as unknown as ToolArgs.GetContextArgs);
          case "motion_comments":
            return await this.handleMotionComments(args as unknown as ToolArgs.MotionCommentsArgs);
          case "motion_custom_fields":
            return await this.handleMotionCustomFields(args as unknown as ToolArgs.MotionCustomFieldsArgs);
          case "motion_recurring_tasks":
            return await this.handleMotionRecurringTasks(args as unknown as ToolArgs.MotionRecurringTasksArgs);
          case "motion_schedules":
            return await this.handleMotionSchedules(args as unknown as MotionSchedulesArgs);
          default:
            return formatMcpError(new Error(`Unknown tool: ${name}`));
        }
      } catch (error: unknown) {
        return formatMcpError(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private getAllToolDefinitions(): McpToolDefinition[] {
    return [
      // Consolidated tools
      {
        name: "motion_projects",
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
            }
          },
          required: ["operation"]
        }
      },
      {
        name: "motion_tasks",
        description: "Manage Motion tasks - supports create, list, get, update, delete, move, and unassign operations",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["create", "list", "get", "update", "delete", "move", "unassign"],
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
            name: {
              type: "string",
              description: "Task name (required for create)"
            },
            description: {
              type: "string",
              description: "Task description"
            },
            priority: {
              type: "string",
              enum: ["ASAP", "HIGH", "MEDIUM", "LOW"],
              description: "Task priority"
            },
            dueDate: {
              type: "string",
              description: "ISO 8601 format"
            },
            duration: {
              oneOf: [
                { type: "string", enum: ["NONE", "REMINDER"] },
                { type: "number", minimum: 0 }
              ],
              description: "Minutes (as number) or 'NONE'/'REMINDER' (as string)"
            },
            labels: {
              type: "array",
              items: { type: "string" },
              description: "Task labels"
            },
            autoScheduled: {
              oneOf: [
                { type: "object" },
                { type: "null" }
              ],
              description: "Auto-scheduling configuration"
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
              description: "Maximum number of tasks to return (for list)"
            }
          },
          required: ["operation"]
        }
      },
      // Legacy individual tools (kept for compatibility)
      {
        name: "create_motion_project",
        description: "Create a new project in Motion",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Project name (required)"
            },
            description: {
              type: "string",
              description: "Project description (optional)"
            },
            workspaceId: {
              type: "string",
              description: "Workspace ID (optional, uses default if not provided)"
            },
            workspaceName: {
              type: "string",
              description: "Workspace name (alternative to workspaceId)"
            },
            color: {
              type: "string",
              description: "Project color in hex format (optional, e.g., #FF5733)"
            },
            status: {
              type: "string",
              description: "Project status (optional)"
            }
          },
          required: ["name"]
        }
      },
      {
        name: "list_motion_projects",
        description: "List all projects in Motion. If no workspace is specified, will use the default workspace.",
        inputSchema: {
          type: "object",
          properties: {
            workspaceId: {
              type: "string",
              description: "Optional workspace ID to filter projects"
            },
            workspaceName: {
              type: "string",
              description: "Optional workspace name to filter projects"
            }
          },
          additionalProperties: false
        }
      },
      {
        name: "get_motion_project",
        description: "Get details of a specific project",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID (required)"
            }
          },
          required: ["projectId"]
        }
      },
      {
        name: "create_motion_task",
        description: "Create a new task in Motion",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Task name (required)"
            },
            description: {
              type: "string",
              description: "Task description"
            },
            workspaceId: {
              type: "string",
              description: "Workspace ID (required)"
            },
            workspaceName: {
              type: "string",
              description: "Workspace name (alternative to workspaceId)"
            },
            projectId: {
              type: "string",
              description: "Project ID to add the task to"
            },
            projectName: {
              type: "string",
              description: "Project name (alternative to projectId)"
            },
            status: {
              type: "string",
              description: "Task status"
            },
            priority: {
              type: "string",
              enum: ["ASAP", "HIGH", "MEDIUM", "LOW"],
              description: "Task priority"
            },
            dueDate: {
              type: "string",
              description: "Due date in ISO format"
            },
            assigneeId: {
              type: "string",
              description: "User ID to assign the task to"
            }
          },
          required: ["name"]
        }
      },
      {
        name: "list_motion_tasks",
        description: "List tasks in Motion",
        inputSchema: {
          type: "object",
          properties: {
            workspaceId: {
              type: "string",
              description: "Workspace ID to filter tasks"
            },
            workspaceName: {
              type: "string",
              description: "Workspace name (alternative to workspaceId)"
            },
            projectId: {
              type: "string",
              description: "Project ID to filter tasks"
            },
            projectName: {
              type: "string",
              description: "Project name (alternative to projectId)"
            },
            status: {
              type: "string",
              description: "Filter by task status"
            },
            assigneeId: {
              type: "string",
              description: "Filter by assignee"
            },
            limit: {
              type: "number",
              description: "Maximum number of tasks to return"
            }
          },
          additionalProperties: false
        }
      },
      {
        name: "get_motion_task",
        description: "Get details of a specific task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID (required)"
            }
          },
          required: ["taskId"]
        }
      },
      {
        name: "update_motion_task",
        description: "Update an existing task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID (required)"
            },
            name: {
              type: "string",
              description: "New task name"
            },
            description: {
              type: "string",
              description: "New task description"
            },
            status: {
              type: "string",
              description: "New task status"
            },
            priority: {
              type: "string",
              enum: ["ASAP", "HIGH", "MEDIUM", "LOW"],
              description: "New task priority"
            },
            dueDate: {
              type: "string",
              description: "New due date in ISO format"
            },
            assigneeId: {
              type: "string",
              description: "New assignee user ID"
            }
          },
          required: ["taskId"]
        }
      },
      {
        name: "delete_motion_task",
        description: "Delete a task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID (required)"
            }
          },
          required: ["taskId"]
        }
      },
      {
        name: "list_motion_workspaces",
        description: "List all available workspaces",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: "list_motion_users",
        description: "List users in a workspace",
        inputSchema: {
          type: "object",
          properties: {
            workspaceId: {
              type: "string",
              description: "Workspace ID (optional, uses default if not provided)"
            },
            workspaceName: {
              type: "string",
              description: "Workspace name (alternative to workspaceId)"
            }
          },
          additionalProperties: false
        }
      },
      {
        name: "search_motion_content",
        description: "Search for tasks and projects in Motion",
        inputSchema: {
          type: "object",
          properties: {
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
          required: ["query"]
        }
      },
      {
        name: "get_motion_context",
        description: "Get contextual information about current work state",
        inputSchema: {
          type: "object",
          properties: {
            workspaceId: {
              type: "string",
              description: "Workspace ID"
            },
            workspaceName: {
              type: "string",
              description: "Workspace name (alternative to workspaceId)"
            },
            includeProjects: {
              type: "boolean",
              description: "Include project information"
            },
            includeTasks: {
              type: "boolean",
              description: "Include task information"
            },
            includeUsers: {
              type: "boolean",
              description: "Include user information"
            }
          },
          additionalProperties: false
        }
      },
      {
        name: "motion_comments",
        description: "Manage comments on tasks and projects",
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
              description: "Task ID to comment on or fetch comments from"
            },
            projectId: {
              type: "string",
              description: "Project ID to comment on or fetch comments from"
            },
            content: {
              type: "string",
              description: "Comment content (required for create)"
            },
            authorId: {
              type: "string",
              description: "Author user ID (optional)"
            }
          },
          required: ["operation"]
        }
      },
      {
        name: "motion_custom_fields",
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
            type: {
              type: "string",
              enum: ["text", "number", "date", "select", "multiselect", "checkbox"],
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
          required: ["operation"]
        }
      },
      {
        name: "motion_recurring_tasks",
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
            recurrence: {
              type: "object",
              properties: {
                frequency: {
                  type: "string",
                  enum: ["daily", "weekly", "monthly", "yearly"]
                },
                interval: {
                  type: "number",
                  description: "Repeat every N periods"
                },
                daysOfWeek: {
                  type: "array",
                  items: { type: "number" },
                  description: "0-6 for Sunday-Saturday"
                },
                dayOfMonth: {
                  type: "number",
                  description: "1-31 for monthly recurrence"
                },
                endDate: {
                  type: "string",
                  description: "ISO 8601 format"
                }
              },
              required: ["frequency"]
            }
          },
          required: ["operation"]
        }
      },
      {
        name: "motion_schedules",
        description: "Get user schedules and calendar view",
        inputSchema: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              description: "User ID to get schedule for"
            },
            startDate: {
              type: "string",
              description: "Start date (ISO 8601)"
            },
            endDate: {
              type: "string",
              description: "End date (ISO 8601)"
            }
          }
        }
      }
    ];
  }

  private getEnabledTools(): McpToolDefinition[] {
    const allTools = this.getAllToolDefinitions();
    const toolsMap = new Map(allTools.map(tool => [tool.name, tool]));
    
    switch(this.toolsConfig) {
      case 'minimal':
        // Only consolidated tools and essential workspace tool
        return [
          toolsMap.get('motion_tasks'),
          toolsMap.get('motion_projects'),
          toolsMap.get('list_motion_workspaces')
        ].filter((tool): tool is McpToolDefinition => tool !== undefined);
      
      case 'essential':
        // Consolidated tools plus commonly needed tools
        return [
          toolsMap.get('motion_tasks'),
          toolsMap.get('motion_projects'),
          toolsMap.get('motion_comments'),
          toolsMap.get('motion_custom_fields'),
          toolsMap.get('motion_recurring_tasks'),
          toolsMap.get('motion_schedules'),
          toolsMap.get('list_motion_workspaces'),
          toolsMap.get('list_motion_users'),
          toolsMap.get('search_motion_content'),
          toolsMap.get('get_motion_context')
        ].filter((tool): tool is McpToolDefinition => tool !== undefined);
      
      case 'all':
        // Return all tools
        return allTools;
      
      default:
        // Handle custom configuration (already validated in validateToolsConfig)
        if (this.toolsConfig.startsWith('custom:')) {
          const customTools = this.toolsConfig.substring(7).split(',').map(s => s.trim());
          return customTools
            .map(name => toolsMap.get(name))
            .filter((tool): tool is McpToolDefinition => tool !== undefined);
        }
        // This should never happen since we validate in initialize()
        // But if it does, throw an error instead of silently defaulting
        throw new Error(`Unexpected tools configuration: ${this.toolsConfig}`);
    }
  }

  // Handler methods
  
  // Consolidated handlers for resource-based tools
  private async handleMotionProjects(args: MotionProjectsArgs): Promise<McpToolResponse> {
    const { operation, ...params } = args;
    
    switch(operation) {
      case 'create':
        return this.handleCreateProject(params as ToolArgs.CreateProjectArgs);
      case 'list':
        return this.handleListProjects(params as ToolArgs.ListProjectsArgs);
      case 'get':
        if (!params.projectId) {
          return formatMcpError(new Error("Project ID is required for get operation"));
        }
        return this.handleGetProject({ projectId: params.projectId });
      default:
        return formatMcpError(new Error(`Unknown operation: ${operation}`));
    }
  }

  private async handleMotionTasks(args: MotionTasksArgs): Promise<McpToolResponse> {
    const { operation, ...params } = args;
    
    switch(operation) {
      case 'create':
        return this.handleCreateTask(params as ToolArgs.CreateTaskArgs);
      case 'list':
        return this.handleListTasks(params as ToolArgs.ListTasksArgs);
      case 'get':
        if (!params.taskId) {
          return formatMcpError(new Error("Task ID is required for get operation"));
        }
        return this.handleGetTask({ taskId: params.taskId });
      case 'update':
        if (!params.taskId) {
          return formatMcpError(new Error("Task ID is required for update operation"));
        }
        return this.handleUpdateTask(params as ToolArgs.UpdateTaskArgs);
      case 'delete':
        if (!params.taskId) {
          return formatMcpError(new Error("Task ID is required for delete operation"));
        }
        return this.handleDeleteTask({ taskId: params.taskId });
      case 'move':
        if (!params.taskId) {
          return formatMcpError(new Error("Task ID is required for move operation"));
        }
        if (!params.targetProjectId && !params.targetWorkspaceId) {
          return formatMcpError(new Error("Either target project ID or target workspace ID is required for move operation"));
        }
        return this.handleMoveTask({
          taskId: params.taskId,
          targetProjectId: params.targetProjectId,
          targetWorkspaceId: params.targetWorkspaceId
        });
      case 'unassign':
        if (!params.taskId) {
          return formatMcpError(new Error("Task ID is required for unassign operation"));
        }
        return this.handleUnassignTask({ taskId: params.taskId });
      default:
        return formatMcpError(new Error(`Unknown operation: ${operation}`));
    }
  }
  
  // Original handler methods
  private async handleCreateProject(args: ToolArgs.CreateProjectArgs) {
    const motionService = this.motionService;
    const workspaceResolver = this.workspaceResolver;
    if (!motionService || !workspaceResolver) {
      return formatMcpError(new Error("Services not available"));
    }

    const projectData = parseProjectArgs(args as unknown as Record<string, unknown>);
    
    // Resolve workspace
    const workspace = await workspaceResolver.resolveWorkspace({
      workspaceId: projectData.workspaceId,
      workspaceName: projectData.workspaceName
    });

    const project = await motionService.createProject({
      ...projectData,
      workspaceId: workspace.id
    });

    return formatMcpSuccess(`Successfully created project "${project.name}" (ID: ${project.id})`);
  }

  private async handleListProjects(args: ToolArgs.ListProjectsArgs) {
    const motionService = this.motionService;
    const workspaceResolver = this.workspaceResolver;
    if (!motionService || !workspaceResolver) {
      return formatMcpError(new Error("Services not available"));
    }

    const workspace = await workspaceResolver.resolveWorkspace(args);
    const projects = await motionService.getProjects(workspace.id);
    
    return formatProjectList(projects, workspace.name, workspace.id);
  }

  private async handleGetProject(args: ToolArgs.GetProjectArgs) {
    const motionService = this.motionService;
    if (!motionService) {
      return formatMcpError(new Error("Motion service not available"));
    }

    const { projectId } = args;
    if (!projectId) {
      return formatMcpError(new Error("Project ID is required"));
    }

    try {
      const project = await motionService.getProject(projectId);
      
      return formatDetailResponse(project, 'Project', [
        'id', 'name', 'description', 'status', 'color', 
        'workspaceId', 'createdTime', 'updatedTime'
      ]);
    } catch (error) {
      return formatMcpError(error instanceof Error ? error : new Error(String(error)));
    }
  }


  private async handleCreateTask(args: ToolArgs.CreateTaskArgs) {
    const motionService = this.motionService;
    const workspaceResolver = this.workspaceResolver;
    if (!motionService || !workspaceResolver) {
      return formatMcpError(new Error("Services not available"));
    }

    const taskData = parseTaskArgs(args as unknown as Record<string, unknown>);
    
    // Resolve workspace
    const workspace = await workspaceResolver.resolveWorkspace({
      workspaceId: taskData.workspaceId,
      workspaceName: taskData.workspaceName
    });

    // Resolve project if name provided
    if (taskData.projectName && !taskData.projectId) {
      const project = await motionService.getProjectByName(taskData.projectName, workspace.id);
      if (project) {
        taskData.projectId = project.id;
      }
    }

    const task = await motionService.createTask({
      ...taskData,
      workspaceId: workspace.id
    });

    return formatMcpSuccess(`Successfully created task "${task.name}" (ID: ${task.id})`);
  }

  private async handleListTasks(args: ToolArgs.ListTasksArgs) {
    const motionService = this.motionService;
    const workspaceResolver = this.workspaceResolver;
    if (!motionService || !workspaceResolver) {
      return formatMcpError(new Error("Services not available"));
    }

    const workspace = await workspaceResolver.resolveWorkspace(args);
    
    // Resolve project if name provided
    let projectId = args.projectId;
    if (args.projectName && !projectId) {
      const project = await motionService.getProjectByName(args.projectName, workspace.id);
      if (project) {
        projectId = project.id;
      }
    }

    const tasks = await motionService.getTasks(workspace.id, projectId);
    
    return formatTaskList(tasks, {
      workspaceName: workspace.name,
      projectName: args.projectName,
      status: args.status
    });
  }

  private async handleGetTask(args: ToolArgs.GetTaskArgs) {
    const motionService = this.motionService;
    if (!motionService) {
      return formatMcpError(new Error("Motion service not available"));
    }

    const { taskId } = args;
    if (!taskId) {
      return formatMcpError(new Error("Task ID is required"));
    }

    try {
      const task = await motionService.getTask(taskId);
      
      return formatDetailResponse(task, 'Task', [
        'id', 'name', 'description', 'status', 'priority', 
        'dueDate', 'assigneeId', 'projectId', 'workspaceId',
        'completed', 'createdTime', 'updatedTime', 'scheduledStart', 
        'scheduledEnd', 'labels'
      ]);
    } catch (error) {
      return formatMcpError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async handleUpdateTask(args: ToolArgs.UpdateTaskArgs) {
    const motionService = this.motionService;
    if (!motionService) {
      return formatMcpError(new Error("Motion service not available"));
    }

    const { taskId, ...updates } = args;
    if (!taskId) {
      return formatMcpError(new Error("Task ID is required"));
    }

    const task = await motionService.updateTask(taskId, updates);
    return formatMcpSuccess(`Successfully updated task "${task.name}"`);
  }

  private async handleDeleteTask(args: ToolArgs.DeleteTaskArgs) {
    const motionService = this.motionService;
    if (!motionService) {
      return formatMcpError(new Error("Motion service not available"));
    }

    const { taskId } = args;
    if (!taskId) {
      return formatMcpError(new Error("Task ID is required"));
    }

    await motionService.deleteTask(taskId);
    return formatMcpSuccess(`Successfully deleted task ${taskId}`);
  }

  private async handleMoveTask(args: { taskId: string; targetProjectId?: string; targetWorkspaceId?: string }) {
    const motionService = this.motionService;
    if (!motionService) {
      return formatMcpError(new Error("Motion service not available"));
    }

    const { taskId, targetProjectId, targetWorkspaceId } = args;
    // Validation already performed in handleMotionTasks

    try {
      const task = await motionService.moveTask(taskId, targetProjectId, targetWorkspaceId);
      return formatMcpSuccess(`Successfully moved task "${task.name}" (ID: ${task.id})`);
    } catch (error) {
      return formatMcpError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async handleUnassignTask(args: { taskId: string }) {
    const motionService = this.motionService;
    if (!motionService) {
      return formatMcpError(new Error("Motion service not available"));
    }

    const { taskId } = args;
    // Validation already performed in handleMotionTasks

    try {
      const task = await motionService.unassignTask(taskId);
      return formatMcpSuccess(`Successfully unassigned task "${task.name}" (ID: ${task.id})`);
    } catch (error) {
      return formatMcpError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async handleListWorkspaces(_args: ToolArgs.ListWorkspacesArgs): Promise<McpToolResponse> {
    const motionService = this.motionService;
    if (!motionService) {
      return formatMcpError(new Error("Motion service not available"));
    }

    const workspaces = await motionService.getWorkspaces();
    return formatWorkspaceList(workspaces);
  }

  private async handleListUsers(args: ToolArgs.ListUsersArgs): Promise<McpToolResponse> {
    const motionService = this.motionService;
    const workspaceResolver = this.workspaceResolver;
    if (!motionService || !workspaceResolver) {
      return formatMcpError(new Error("Services not available"));
    }

    const workspace = await workspaceResolver.resolveWorkspace(args);
    const users = await motionService.getUsers(workspace.id);
    
    const userList = users.map(u => `- ${u.name} (ID: ${u.id})`).join('\n');
    return formatMcpSuccess(`Users in workspace "${workspace.name}":\n${userList}`);
  }

  private async handleSearchContent(args: ToolArgs.SearchContentArgs): Promise<McpToolResponse> {
    const motionService = this.motionService;
    const workspaceResolver = this.workspaceResolver;
    if (!motionService || !workspaceResolver) {
      return formatMcpError(new Error("Services not available"));
    }

    const { query, entityTypes = ['projects', 'tasks'] } = args;
    const limit = 20;
    
    const workspace = await workspaceResolver.resolveWorkspace(args);
    
    let results: Array<any> = [];
    
    if (entityTypes?.includes('tasks')) {
      const tasks = await motionService.searchTasks(query, workspace.id);
      results.push(...tasks.slice(0, limit));
    }
    
    if (entityTypes?.includes('projects')) {
      const projects = await motionService.searchProjects(query, workspace.id);
      results.push(...projects.slice(0, limit));
    }
    
    return formatSearchResults(results.slice(0, limit), query, { limit, searchScope: entityTypes?.join(',') || 'both' });
  }

  private async handleGetContext(args: ToolArgs.GetContextArgs): Promise<McpToolResponse> {
    const { entityType, entityId, includeRelated = false } = args;
    
    let contextText = `Context for ${entityType} ${entityId}:\n\n`;
    
    // For now, return a simple context message as Motion API doesn't have specific context endpoints
    if (entityType === 'project') {
      contextText += `Project ID: ${entityId}\n`;
      if (includeRelated) {
        contextText += `Related tasks would be listed here (when available)\n`;
      }
    } else if (entityType === 'task') {
      contextText += `Task ID: ${entityId}\n`;
      if (includeRelated) {
        contextText += `Related project and subtasks would be listed here (when available)\n`;
      }
    }
    
    return formatMcpSuccess(contextText);
  }

  private async handleMotionComments(args: ToolArgs.MotionCommentsArgs): Promise<McpToolResponse> {
    const motionService = this.motionService;
    if (!motionService) {
      return formatMcpError(new Error("Motion service is not available"));
    }

    const { operation, taskId, projectId, content, authorId } = args;
    
    try {
      switch (operation) {
        case 'list':
          if (!taskId && !projectId) {
            return formatMcpError(new Error('Either taskId or projectId is required for list operation'));
          }
          if (taskId && projectId) {
            return formatMcpError(new Error('Provide either taskId or projectId, not both'));
          }
          
          const comments = await motionService.getComments(taskId, projectId);
          return formatCommentList(comments);
          
        case 'create':
          const trimmedContent = content?.trim();
          if (!trimmedContent) {
            return formatMcpError(new Error('Content is required and cannot be empty for create operation'));
          }
          if (trimmedContent.length > LIMITS.COMMENT_MAX_LENGTH) {
            return formatMcpError(new Error(`Comment content exceeds maximum length of ${LIMITS.COMMENT_MAX_LENGTH} characters`));
          }
          if (!taskId && !projectId) {
            return formatMcpError(new Error('Either taskId or projectId is required for create operation'));
          }
          if (taskId && projectId) {
            return formatMcpError(new Error('Provide either taskId or projectId, not both'));
          }
          
          const commentData: CreateCommentData = { content: trimmedContent };
          if (taskId) commentData.taskId = taskId;
          if (projectId) commentData.projectId = projectId;
          if (authorId) commentData.authorId = authorId;
          
          const newComment = await motionService.createComment(commentData);
          return formatCommentDetail(newComment);
          
        default:
          return formatMcpError(new Error(`Unknown operation: ${operation}`));
      }
    } catch (error: unknown) {
      return formatMcpError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async handleMotionCustomFields(args: ToolArgs.MotionCustomFieldsArgs): Promise<McpToolResponse> {
    const motionService = this.motionService;
    if (!motionService) {
      return formatMcpError(new Error("Motion service is not available"));
    }

    const { operation, fieldId, workspaceId, name, type, options, required, projectId, taskId, value } = args;
    
    try {
      switch (operation) {
        case 'list':
          const fields = await motionService.getCustomFields(workspaceId);
          return formatCustomFieldList(fields);
          
        case 'create':
          if (!name || !type) {
            return formatMcpError(new Error('Name and type are required for create operation'));
          }
          
          // Validate custom field name length
          if (name.length > LIMITS.CUSTOM_FIELD_NAME_MAX_LENGTH) {
            return formatMcpError(new Error(`Field name exceeds ${LIMITS.CUSTOM_FIELD_NAME_MAX_LENGTH} characters`));
          }
          
          // Validate options array size for select fields
          if (options && options.length > LIMITS.CUSTOM_FIELD_OPTIONS_MAX_COUNT) {
            return formatMcpError(new Error(`Options array exceeds ${LIMITS.CUSTOM_FIELD_OPTIONS_MAX_COUNT} items`));
          }
          
          const fieldData: CreateCustomFieldData = {
            name,
            type,
            ...(workspaceId && { workspaceId }),
            ...(options && { options }),
            ...(required !== undefined && { required })
          };
          
          const newField = await motionService.createCustomField(fieldData);
          return formatCustomFieldDetail(newField);
          
        case 'delete':
          if (!fieldId) {
            return formatMcpError(new Error('Field ID is required for delete operation'));
          }
          
          await motionService.deleteCustomField(fieldId);
          return formatCustomFieldSuccess('deleted');
          
        case 'add_to_project':
          if (!projectId || !fieldId) {
            return formatMcpError(new Error('Project ID and field ID are required for add_to_project operation'));
          }
          
          await motionService.addCustomFieldToProject(projectId, fieldId, value);
          return formatCustomFieldSuccess('added', 'project', projectId);
          
        case 'remove_from_project':
          if (!projectId || !fieldId) {
            return formatMcpError(new Error('Project ID and field ID are required for remove_from_project operation'));
          }
          
          await motionService.removeCustomFieldFromProject(projectId, fieldId);
          return formatCustomFieldSuccess('removed', 'project', projectId);
          
        case 'add_to_task':
          if (!taskId || !fieldId) {
            return formatMcpError(new Error('Task ID and field ID are required for add_to_task operation'));
          }
          
          await motionService.addCustomFieldToTask(taskId, fieldId, value);
          return formatCustomFieldSuccess('added', 'task', taskId);
          
        case 'remove_from_task':
          if (!taskId || !fieldId) {
            return formatMcpError(new Error('Task ID and field ID are required for remove_from_task operation'));
          }
          
          await motionService.removeCustomFieldFromTask(taskId, fieldId);
          return formatCustomFieldSuccess('removed', 'task', taskId);
          
        default:
          return formatMcpError(new Error(`Unknown operation: ${operation}`));
      }
    } catch (error: unknown) {
      return formatMcpError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async handleMotionRecurringTasks(args: ToolArgs.MotionRecurringTasksArgs): Promise<McpToolResponse> {
    const motionService = this.motionService;
    const workspaceResolver = this.workspaceResolver;
    if (!motionService || !workspaceResolver) {
      return formatMcpError(new Error("Services not available"));
    }

    const { operation, recurringTaskId, workspaceId, name, description, projectId, recurrence } = args;
    
    try {
      switch (operation) {
        case 'list':
          const recurringTasks = await motionService.getRecurringTasks(workspaceId);
          return formatRecurringTaskList(recurringTasks);
          
        case 'create':
          if (!name || !recurrence) {
            return formatMcpError(new Error('Name and recurrence are required for create operation'));
          }
          
          // Validate recurrence fields
          if (recurrence.interval !== undefined && (!Number.isInteger(recurrence.interval) || recurrence.interval < 1)) {
            return formatMcpError(new Error('Recurrence interval must be a positive integer'));
          }
          if (recurrence.daysOfWeek && !recurrence.daysOfWeek.every(day => day >= 0 && day <= 6)) {
            return formatMcpError(new Error('daysOfWeek must contain values between 0-6 (Sunday-Saturday)'));
          }
          if (recurrence.dayOfMonth !== undefined && (recurrence.dayOfMonth < 1 || recurrence.dayOfMonth > 31)) {
            return formatMcpError(new Error('dayOfMonth must be between 1-31'));
          }
          if (recurrence.endDate !== undefined) {
            // Validate endDate is a valid ISO 8601 format and in the future
            const endDateObj = new Date(recurrence.endDate);
            if (isNaN(endDateObj.getTime())) {
              return formatMcpError(new Error('endDate must be a valid ISO 8601 date format'));
            }
            if (endDateObj <= new Date()) {
              return formatMcpError(new Error('endDate must be in the future'));
            }
          }
          
          // Cross-field validation for recurrence consistency
          switch (recurrence.frequency) {
            case 'weekly':
              if (!recurrence.daysOfWeek || recurrence.daysOfWeek.length === 0) {
                return formatMcpError(new Error('daysOfWeek is required for weekly recurrence'));
              }
              if (recurrence.dayOfMonth !== undefined) {
                return formatMcpError(new Error('dayOfMonth should not be set for weekly recurrence'));
              }
              break;
            case 'monthly':
              if (recurrence.dayOfMonth === undefined) {
                return formatMcpError(new Error('dayOfMonth is required for monthly recurrence'));
              }
              if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
                return formatMcpError(new Error('daysOfWeek should not be set for monthly recurrence'));
              }
              break;
            case 'daily':
            case 'yearly':
              if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
                return formatMcpError(new Error(`daysOfWeek should not be set for ${recurrence.frequency} recurrence`));
              }
              if (recurrence.dayOfMonth !== undefined) {
                return formatMcpError(new Error(`dayOfMonth should not be set for ${recurrence.frequency} recurrence`));
              }
              break;
          }
          
          // Resolve workspace
          const workspace = await workspaceResolver.resolveWorkspace({ workspaceId });
          
          const taskData: CreateRecurringTaskData = {
            name,
            workspaceId: workspace.id, // Ensure workspace is always set
            ...(description && { description }),
            ...(projectId && { projectId }),
            recurrence
          };
          
          const newTask = await motionService.createRecurringTask(taskData);
          return formatRecurringTaskDetail(newTask);
          
        case 'delete':
          if (!recurringTaskId) {
            return formatMcpError(new Error('Recurring task ID is required for delete operation'));
          }
          
          await motionService.deleteRecurringTask(recurringTaskId);
          return formatMcpSuccess(`Recurring task ${recurringTaskId} deleted successfully`);
          
        default:
          return formatMcpError(new Error(`Unknown operation: ${operation}`));
      }
    } catch (error: unknown) {
      return formatMcpError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async handleMotionSchedules(args: MotionSchedulesArgs): Promise<McpToolResponse> {
    const motionService = this.motionService;
    if (!motionService) {
      return formatMcpError(new Error("Motion service not available"));
    }

    const { userId, startDate, endDate } = args;
    
    try {
      const schedules = await motionService.getSchedules(userId, startDate, endDate);
      return formatScheduleList(schedules);
    } catch (error: unknown) {
      return formatMcpError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async run(): Promise<void> {
    await this.initialize();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    mcpLog(LOG_LEVELS.INFO, "Motion MCP Server running on stdio");
  }
}

// Main execution
if (require.main === module) {
  const server = new MotionMCPServer();
  server.run().catch((error) => {
    console.error("Failed to run server:", error);
    process.exit(1);
  });
}

export default MotionMCPServer;