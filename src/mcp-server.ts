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
  parseTaskArgs,
  parseProjectArgs,
  formatWorkspaceList,
  formatSearchResults,
  mcpLog,
  LOG_LEVELS
} from './utils';
import { InputValidator } from './utils/validator';
import { McpToolResponse } from './types/mcp';
import * as ToolArgs from './types/mcp-tool-args';
import * as dotenv from 'dotenv';

dotenv.config();

class MotionMCPServer {
  private server: Server;
  private motionService: MotionApiService | null;
  private workspaceResolver: WorkspaceResolver | null;
  private validator: InputValidator;

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
    this.setupHandlers();
  }

  async initialize(): Promise<void> {
    try {
      this.motionService = new MotionApiService();
      this.workspaceResolver = new WorkspaceResolver(this.motionService);
      
      // Initialize validators with tool definitions
      this.validator.initializeValidators(this.getToolDefinitions());
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      mcpLog(LOG_LEVELS.ERROR, "Failed to initialize Motion API service", { error: errorMessage });
      process.exit(1);
    }
  }

  setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getToolDefinitions()
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
          case "create_motion_project":
            return await this.handleCreateProject(args as unknown as ToolArgs.CreateProjectArgs);
          case "list_motion_projects":
            return await this.handleListProjects(args as unknown as ToolArgs.ListProjectsArgs || {});
          case "get_motion_project":
            return await this.handleGetProject(args as unknown as ToolArgs.GetProjectArgs);
          case "update_motion_project":
            return await this.handleUpdateProject(args as unknown as ToolArgs.UpdateProjectArgs);
          case "delete_motion_project":
            return await this.handleDeleteProject(args as unknown as ToolArgs.DeleteProjectArgs);
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
          case "list_motion_workspaces":
            return await this.handleListWorkspaces({});
          case "list_motion_users":
            return await this.handleListUsers(args as unknown as ToolArgs.ListUsersArgs || {});
          case "search_motion_content":
            return await this.handleSearchContent(args as unknown as ToolArgs.SearchContentArgs);
          case "get_motion_context":
            return await this.handleGetContext(args as unknown as ToolArgs.GetContextArgs);
          case "suggest_next_action":
            return await this.handleSuggestNextAction(args as unknown as ToolArgs.SuggestNextActionArgs || {});
          case "analyze_workload":
            return await this.handleAnalyzeWorkload(args as unknown as ToolArgs.AnalyzeWorkloadArgs || {});
          case "smart_schedule_tasks":
            return await this.handleSmartScheduleTasks(args as unknown as ToolArgs.SmartScheduleTasksArgs);
          case "create_project_template":
            return await this.handleCreateProjectTemplate(args as unknown as ToolArgs.CreateProjectTemplateArgs);
          default:
            return formatMcpError(new Error(`Unknown tool: ${name}`));
        }
      } catch (error: unknown) {
        return formatMcpError(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private getToolDefinitions(): any[] {
    return [
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
        name: "update_motion_project",
        description: "Update an existing project",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID (required)"
            },
            name: {
              type: "string",
              description: "New project name"
            },
            description: {
              type: "string",
              description: "New project description"
            },
            color: {
              type: "string",
              description: "New project color"
            },
            status: {
              type: "string",
              description: "New project status"
            }
          },
          required: ["projectId"]
        }
      },
      {
        name: "delete_motion_project",
        description: "Delete a project",
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
        name: "suggest_next_action",
        description: "Get AI-powered suggestions for next actions",
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
            context: {
              type: "string",
              description: "Additional context for suggestions"
            },
            maxSuggestions: {
              type: "number",
              description: "Maximum number of suggestions"
            }
          },
          additionalProperties: false
        }
      },
      {
        name: "analyze_workload",
        description: "Analyze workload distribution and capacity",
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
            timeframe: {
              type: "string",
              enum: ["today", "this_week", "this_month"],
              description: "Timeframe for analysis"
            },
            userId: {
              type: "string",
              description: "Specific user to analyze"
            }
          },
          additionalProperties: false
        }
      },
      {
        name: "smart_schedule_tasks",
        description: "Intelligently schedule tasks based on priorities and constraints",
        inputSchema: {
          type: "object",
          properties: {
            taskIds: {
              type: "array",
              items: { type: "string" },
              description: "Task IDs to schedule"
            },
            workspaceId: {
              type: "string",
              description: "Workspace ID"
            },
            schedulingPreferences: {
              type: "object",
              description: "Scheduling preferences and constraints"
            }
          },
          required: ["taskIds"]
        }
      },
      {
        name: "create_project_template",
        description: "Create a project with predefined task templates",
        inputSchema: {
          type: "object",
          properties: {
            templateType: {
              type: "string",
              enum: ["sprint", "marketing_campaign", "product_launch", "custom"],
              description: "Type of project template"
            },
            projectName: {
              type: "string",
              description: "Name for the new project"
            },
            workspaceId: {
              type: "string",
              description: "Workspace ID"
            },
            workspaceName: {
              type: "string",
              description: "Workspace name (alternative to workspaceId)"
            },
            customTasks: {
              type: "array",
              items: { type: "object" },
              description: "Custom task definitions for template"
            }
          },
          required: ["templateType", "projectName"]
        }
      }
    ];
  }

  // Handler methods
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

    // Note: Motion API doesn't have a get single project endpoint, so we'd need to list and filter
    // For now, return a placeholder
    return formatMcpSuccess(`Project details for ID: ${projectId}`);
  }

  private async handleUpdateProject(args: ToolArgs.UpdateProjectArgs) {
    if (!this.motionService) {
      return formatMcpError(new Error("Service not initialized"));
    }

    const { projectId, ...updates } = args;
    if (!projectId) {
      return formatMcpError(new Error("Project ID is required"));
    }

    const project = await this.motionService.updateProject(projectId, updates);
    return formatMcpSuccess(`Successfully updated project "${project.name}"`);
  }

  private async handleDeleteProject(args: ToolArgs.DeleteProjectArgs) {
    if (!this.motionService) {
      return formatMcpError(new Error("Service not initialized"));
    }

    const { projectId } = args;
    if (!projectId) {
      return formatMcpError(new Error("Project ID is required"));
    }

    await this.motionService.deleteProject(projectId);
    return formatMcpSuccess(`Successfully deleted project ${projectId}`);
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

    // Note: Motion API doesn't have a get single task endpoint
    return formatMcpSuccess(`Task details for ID: ${taskId}`);
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

  private async handleSuggestNextAction(args: ToolArgs.SuggestNextActionArgs): Promise<McpToolResponse> {
    if (!this.motionService || !this.workspaceResolver) {
      return formatMcpError(new Error("Service not initialized"));
    }

    const workspace = await this.workspaceResolver.resolveWorkspace(args);
    const maxSuggestions = 5;
    
    // Get tasks to analyze
    const tasks = await this.motionService.getTasks(workspace.id);
    const activeTasks = tasks.filter(t => t.status !== 'COMPLETED');
    
    // Simple priority-based suggestions
    const suggestions: string[] = [];
    
    // ASAP tasks
    const asapTasks = activeTasks.filter(t => t.priority === 'ASAP');
    if (asapTasks.length > 0) {
      suggestions.push(`Focus on ASAP task: "${asapTasks[0].name}"`);
    }
    
    // Overdue tasks
    const now = new Date();
    const overdueTasks = activeTasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < now
    );
    if (overdueTasks.length > 0) {
      suggestions.push(`Address overdue task: "${overdueTasks[0].name}"`);
    }
    
    // High priority tasks
    const highPriorityTasks = activeTasks.filter(t => t.priority === 'HIGH');
    if (highPriorityTasks.length > 0) {
      suggestions.push(`Work on high priority: "${highPriorityTasks[0].name}"`);
    }
    
    // Tasks due soon
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dueSoonTasks = activeTasks.filter(t => 
      t.dueDate && new Date(t.dueDate) <= tomorrow && new Date(t.dueDate) >= now
    );
    if (dueSoonTasks.length > 0) {
      suggestions.push(`Complete task due soon: "${dueSoonTasks[0].name}"`);
    }
    
    // Generic suggestions if none of the above
    if (suggestions.length === 0 && activeTasks.length > 0) {
      suggestions.push(`Continue with: "${activeTasks[0].name}"`);
    }
    
    const limitedSuggestions = suggestions.slice(0, maxSuggestions);
    const responseText = limitedSuggestions.length > 0
      ? `Suggested next actions:\n${limitedSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : 'No specific actions suggested. Consider reviewing your task list.';
    
    return formatMcpSuccess(responseText);
  }

  private async handleAnalyzeWorkload(args: ToolArgs.AnalyzeWorkloadArgs): Promise<McpToolResponse> {
    if (!this.motionService || !this.workspaceResolver) {
      return formatMcpError(new Error("Service not initialized"));
    }

    const workspace = await this.workspaceResolver.resolveWorkspace(args);
    const { timeframe = 'this_week', userId } = args;
    
    const tasks = await this.motionService.getTasks(workspace.id);
    
    // Filter by timeframe
    const now = new Date();
    let endDate = new Date();
    
    switch (timeframe) {
      case 'today':
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'this_week':
        endDate.setDate(now.getDate() + (7 - now.getDay()));
        break;
      case 'this_month':
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
    }
    
    const relevantTasks = tasks.filter(t => {
      if (t.status === 'COMPLETED') return false;
      if (userId && t.assigneeId !== userId) return false;
      if (t.dueDate && new Date(t.dueDate) > endDate) return false;
      return true;
    });
    
    // Analyze by priority
    const priorityBreakdown = {
      ASAP: relevantTasks.filter(t => t.priority === 'ASAP').length,
      HIGH: relevantTasks.filter(t => t.priority === 'HIGH').length,
      MEDIUM: relevantTasks.filter(t => t.priority === 'MEDIUM').length,
      LOW: relevantTasks.filter(t => t.priority === 'LOW').length,
      NONE: relevantTasks.filter(t => !t.priority).length
    };
    
    let analysisText = `Workload Analysis for ${timeframe}:\n\n`;
    analysisText += `Total active tasks: ${relevantTasks.length}\n\n`;
    analysisText += 'Priority breakdown:\n';
    Object.entries(priorityBreakdown).forEach(([priority, count]) => {
      if (count > 0) {
        analysisText += `- ${priority}: ${count} tasks\n`;
      }
    });
    
    // Check for overdue
    const overdueTasks = relevantTasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < now
    );
    if (overdueTasks.length > 0) {
      analysisText += `\n⚠️ Overdue tasks: ${overdueTasks.length}\n`;
    }
    
    // Workload assessment
    const workloadScore = 
      priorityBreakdown.ASAP * 4 + 
      priorityBreakdown.HIGH * 3 + 
      priorityBreakdown.MEDIUM * 2 + 
      priorityBreakdown.LOW * 1;
    
    analysisText += '\nWorkload assessment: ';
    if (workloadScore > 20) {
      analysisText += 'Heavy - consider delegating or rescheduling';
    } else if (workloadScore > 10) {
      analysisText += 'Moderate - manageable with focus';
    } else {
      analysisText += 'Light - capacity for additional tasks';
    }
    
    return formatMcpSuccess(analysisText);
  }

  private async handleSmartScheduleTasks(args: ToolArgs.SmartScheduleTasksArgs): Promise<McpToolResponse> {
    const { taskIds } = args;
    
    if (!taskIds || taskIds.length === 0) {
      return formatMcpError(new Error("Task IDs are required"));
    }
    
    // This would integrate with Motion's scheduling API when available
    // For now, return a placeholder response
    return formatMcpSuccess(`Smart scheduling for ${taskIds.length} tasks initiated. This feature requires Motion's scheduling API.`);
  }

  private async handleCreateProjectTemplate(args: ToolArgs.CreateProjectTemplateArgs): Promise<McpToolResponse> {
    if (!this.motionService || !this.workspaceResolver) {
      return formatMcpError(new Error("Service not initialized"));
    }

    const { templateName, projectName, tasks = [] } = args;
    
    // Resolve workspace
    const workspace = await this.workspaceResolver.resolveWorkspace(args);
    
    // Create project
    const project = await this.motionService.createProject({
      name: projectName,
      description: `Created from ${templateName} template`,
      workspaceId: workspace.id
    });
    
    // Define template tasks based on type
    let templateTasks: Array<{name: string; priority?: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW'}> = [];
    
    switch (templateName) {
      case 'sprint':
        templateTasks = [
          { name: 'Sprint Planning', priority: 'HIGH' },
          { name: 'Development', priority: 'MEDIUM' },
          { name: 'Code Review', priority: 'MEDIUM' },
          { name: 'Testing', priority: 'HIGH' },
          { name: 'Sprint Retrospective', priority: 'LOW' }
        ];
        break;
      case 'marketing_campaign':
        templateTasks = [
          { name: 'Campaign Strategy', priority: 'HIGH' },
          { name: 'Content Creation', priority: 'MEDIUM' },
          { name: 'Design Assets', priority: 'MEDIUM' },
          { name: 'Launch Campaign', priority: 'HIGH' },
          { name: 'Performance Analysis', priority: 'LOW' }
        ];
        break;
      case 'product_launch':
        templateTasks = [
          { name: 'Product Finalization', priority: 'ASAP' },
          { name: 'Marketing Preparation', priority: 'HIGH' },
          { name: 'Documentation', priority: 'MEDIUM' },
          { name: 'Launch Event', priority: 'HIGH' },
          { name: 'Post-Launch Support', priority: 'MEDIUM' }
        ];
        break;
      case 'custom':
        templateTasks = tasks;
        break;
    }
    
    // Create tasks for the project
    const createdTasks = [];
    for (const taskData of templateTasks) {
      const task = await this.motionService.createTask({
        ...taskData,
        workspaceId: workspace.id,
        projectId: project.id
      });
      createdTasks.push(task);
    }
    
    return formatMcpSuccess(
      `Successfully created project "${projectName}" with ${createdTasks.length} tasks from ${templateName} template`
    );
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