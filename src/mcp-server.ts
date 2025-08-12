#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MotionApiService } from './services/motionApi';
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
  mcpLog,
  LOG_LEVELS
} from './utils';
import { InputValidator } from './utils/validator';
import { McpToolResponse, McpToolDefinition } from './types/mcp';
import * as ToolArgs from './types/mcp-tool-args';
import { MotionProjectsArgs, MotionTasksArgs } from './types/mcp-tool-args';
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
              type: ["string", "number"],
              description: "Minutes or 'NONE'/'REMINDER'"
            },
            labels: {
              type: "array",
              items: { type: "string" },
              description: "Task labels"
            },
            autoScheduled: {
              type: ["object", "null"],
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
          toolsMap.get('motion_tasks')!,
          toolsMap.get('motion_projects')!,
          toolsMap.get('list_motion_workspaces')!
        ].filter(Boolean);
      
      case 'essential':
        // Consolidated tools plus commonly needed tools
        return [
          toolsMap.get('motion_tasks')!,
          toolsMap.get('motion_projects')!,
          toolsMap.get('list_motion_workspaces')!,
          toolsMap.get('list_motion_users')!,
          toolsMap.get('search_motion_content')!,
          toolsMap.get('get_motion_context')!
        ].filter(Boolean);
      
      case 'all':
        // Return all tools
        return allTools;
      
      default:
        // Handle custom configuration (already validated in validateToolsConfig)
        if (this.toolsConfig.startsWith('custom:')) {
          const customTools = this.toolsConfig.substring(7).split(',').map(s => s.trim());
          return customTools
            .map(name => toolsMap.get(name))
            .filter(Boolean) as McpToolDefinition[];
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
        if (!params.taskId || !params.targetProjectId) {
          return formatMcpError(new Error("Task ID and target project ID are required for move operation"));
        }
        // TODO: Implement move task handler (see task-2.4)
        return formatMcpError(new Error("Move operation is not yet implemented. This will be added in a future update."));
      case 'unassign':
        if (!params.taskId) {
          return formatMcpError(new Error("Task ID is required for unassign operation"));
        }
        // TODO: Implement unassign task handler (see task-2.4)
        return formatMcpError(new Error("Unassign operation is not yet implemented. This will be added in a future update."));
      default:
        return formatMcpError(new Error(`Unknown operation: ${operation}`));
    }
  }
  
  // Original handler methods
  private async handleCreateProject(args: ToolArgs.CreateProjectArgs) {
    if (!this.motionService || !this.workspaceResolver) {
      return formatMcpError(new Error("Service not initialized"));
    }

    const projectData = parseProjectArgs(args as unknown as Record<string, unknown>);
    
    // Resolve workspace
    const workspace = await this.workspaceResolver.resolveWorkspace({
      workspaceId: projectData.workspaceId,
      workspaceName: projectData.workspaceName
    });

    const project = await this.motionService.createProject({
      ...projectData,
      workspaceId: workspace.id
    });

    return formatMcpSuccess(`Successfully created project "${project.name}" (ID: ${project.id})`);
  }

  private async handleListProjects(args: ToolArgs.ListProjectsArgs) {
    if (!this.motionService || !this.workspaceResolver) {
      return formatMcpError(new Error("Service not initialized"));
    }

    const workspace = await this.workspaceResolver.resolveWorkspace(args);
    const projects = await this.motionService.getProjects(workspace.id);
    
    return formatProjectList(projects, workspace.name, workspace.id);
  }

  private async handleGetProject(args: ToolArgs.GetProjectArgs) {
    if (!this.motionService) {
      return formatMcpError(new Error("Service not initialized"));
    }

    const { projectId } = args;
    if (!projectId) {
      return formatMcpError(new Error("Project ID is required"));
    }

    try {
      const project = await this.motionService.getProject(projectId);
      
      return formatDetailResponse(project, 'Project', [
        'id', 'name', 'description', 'status', 'color', 
        'workspaceId', 'createdTime', 'updatedTime'
      ]);
    } catch (error) {
      return formatMcpError(error instanceof Error ? error : new Error(String(error)));
    }
  }


  private async handleCreateTask(args: ToolArgs.CreateTaskArgs) {
    if (!this.motionService || !this.workspaceResolver) {
      return formatMcpError(new Error("Service not initialized"));
    }

    const taskData = parseTaskArgs(args as unknown as Record<string, unknown>);
    
    // Resolve workspace
    const workspace = await this.workspaceResolver.resolveWorkspace({
      workspaceId: taskData.workspaceId,
      workspaceName: taskData.workspaceName
    });

    // Resolve project if name provided
    if (taskData.projectName && !taskData.projectId) {
      const project = await this.motionService.getProjectByName(taskData.projectName, workspace.id);
      if (project) {
        taskData.projectId = project.id;
      }
    }

    const task = await this.motionService.createTask({
      ...taskData,
      workspaceId: workspace.id
    });

    return formatMcpSuccess(`Successfully created task "${task.name}" (ID: ${task.id})`);
  }

  private async handleListTasks(args: ToolArgs.ListTasksArgs) {
    if (!this.motionService || !this.workspaceResolver) {
      return formatMcpError(new Error("Service not initialized"));
    }

    const workspace = await this.workspaceResolver.resolveWorkspace(args);
    
    // Resolve project if name provided
    let projectId = args.projectId;
    if (args.projectName && !projectId) {
      const project = await this.motionService.getProjectByName(args.projectName, workspace.id);
      if (project) {
        projectId = project.id;
      }
    }

    const tasks = await this.motionService.getTasks(workspace.id, projectId);
    
    return formatTaskList(tasks, {
      workspaceName: workspace.name,
      projectName: args.projectName,
      status: args.status
    });
  }

  private async handleGetTask(args: ToolArgs.GetTaskArgs) {
    if (!this.motionService) {
      return formatMcpError(new Error("Service not initialized"));
    }

    const { taskId } = args;
    if (!taskId) {
      return formatMcpError(new Error("Task ID is required"));
    }

    try {
      const task = await this.motionService.getTask(taskId);
      
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
    if (!this.motionService) {
      return formatMcpError(new Error("Service not initialized"));
    }

    const { taskId, ...updates } = args;
    if (!taskId) {
      return formatMcpError(new Error("Task ID is required"));
    }

    const task = await this.motionService.updateTask(taskId, updates);
    return formatMcpSuccess(`Successfully updated task "${task.name}"`);
  }

  private async handleDeleteTask(args: ToolArgs.DeleteTaskArgs) {
    if (!this.motionService) {
      return formatMcpError(new Error("Service not initialized"));
    }

    const { taskId } = args;
    if (!taskId) {
      return formatMcpError(new Error("Task ID is required"));
    }

    await this.motionService.deleteTask(taskId);
    return formatMcpSuccess(`Successfully deleted task ${taskId}`);
  }

  private async handleListWorkspaces(_args: ToolArgs.ListWorkspacesArgs): Promise<McpToolResponse> {
    if (!this.motionService) {
      return formatMcpError(new Error("Service not initialized"));
    }

    const workspaces = await this.motionService.getWorkspaces();
    return formatWorkspaceList(workspaces);
  }

  private async handleListUsers(args: ToolArgs.ListUsersArgs): Promise<McpToolResponse> {
    if (!this.motionService || !this.workspaceResolver) {
      return formatMcpError(new Error("Service not initialized"));
    }

    const workspace = await this.workspaceResolver.resolveWorkspace(args);
    const users = await this.motionService.getUsers(workspace.id);
    
    const userList = users.map(u => `- ${u.name} (ID: ${u.id})`).join('\n');
    return formatMcpSuccess(`Users in workspace "${workspace.name}":\n${userList}`);
  }

  private async handleSearchContent(args: ToolArgs.SearchContentArgs): Promise<McpToolResponse> {
    if (!this.motionService || !this.workspaceResolver) {
      return formatMcpError(new Error("Service not initialized"));
    }

    const { query, entityTypes = ['projects', 'tasks'] } = args;
    const limit = 20;
    
    const workspace = await this.workspaceResolver.resolveWorkspace(args);
    
    let results: Array<any> = [];
    
    if (entityTypes?.includes('tasks')) {
      const tasks = await this.motionService.searchTasks(query, workspace.id);
      results.push(...tasks.slice(0, limit));
    }
    
    if (entityTypes?.includes('projects')) {
      const projects = await this.motionService.searchProjects(query, workspace.id);
      results.push(...projects.slice(0, limit));
    }
    
    return formatSearchResults(results.slice(0, limit), query, { limit, searchScope: entityTypes?.join(',') || 'both' });
  }

  private async handleGetContext(args: ToolArgs.GetContextArgs): Promise<McpToolResponse> {
    if (!this.motionService) {
      return formatMcpError(new Error("Service not initialized"));
    }

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