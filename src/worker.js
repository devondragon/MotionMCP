// Cloudflare Worker with MCP HTTP Stream Transport support
import MotionApiService from './services/motionApiWorker.js';

// MCP Server implementation for Cloudflare Workers
class MotionMCPServer {
  constructor(apiKey) {
    this.motionService = new MotionApiService(apiKey);
    this.serverInfo = {
      name: "motion-mcp-server",
      version: "1.0.0"
    };
    this.capabilities = {
      tools: {}
    };
  }

  // MCP Tool definitions - same as the stdio version
  getToolDefinitions() {
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
        description: "List all projects in Motion. If no workspace is specified, will use the default workspace. You can ask the user which workspace they prefer.",
        inputSchema: {
          type: "object",
          properties: {
            workspaceId: {
              type: "string",
              description: "Optional workspace ID to filter projects. If not provided, uses default workspace."
            },
            workspaceName: {
              type: "string",
              description: "Optional workspace name to filter projects (alternative to workspaceId)."
            }
          },
          additionalProperties: false
        }
      },
      {
        name: "get_motion_project",
        description: "Get a specific project by ID from Motion",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "The project ID to retrieve"
            }
          },
          required: ["projectId"]
        }
      },
      {
        name: "update_motion_project",
        description: "Update an existing project in Motion",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "The project ID to update"
            },
            name: {
              type: "string",
              description: "Updated project name (optional)"
            },
            description: {
              type: "string",
              description: "Updated project description (optional)"
            },
            color: {
              type: "string",
              description: "Updated project color in hex format (optional)"
            },
            status: {
              type: "string",
              description: "Updated project status (optional)"
            }
          },
          required: ["projectId"]
        }
      },
      {
        name: "delete_motion_project",
        description: "Delete a project from Motion",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "The project ID to delete"
            }
          },
          required: ["projectId"]
        }
      },
      {
        name: "create_motion_task",
        description: "Create a new task in Motion. A workspaceId is required - if not provided, will use the default workspace. If projectId is not specified but a project name is mentioned, will try to find the project in the workspace.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Task name (required)"
            },
            description: {
              type: "string",
              description: "Task description (optional, supports Markdown)"
            },
            workspaceId: {
              type: "string",
              description: "Workspace ID where the task should be created. If not provided, will use the default workspace."
            },
            workspaceName: {
              type: "string",
              description: "Workspace name (alternative to workspaceId). Will be resolved to workspaceId."
            },
            projectId: {
              type: "string",
              description: "Project ID to assign task to (optional). If not provided, task will be created without a project."
            },
            projectName: {
              type: "string",
              description: "Project name (alternative to projectId). Will be resolved to projectId within the specified workspace."
            },
            status: {
              type: "string",
              description: "Task status (optional). If not provided, uses workspace default status."
            },
            priority: {
              type: "string",
              description: "Task priority: ASAP, HIGH, MEDIUM, or LOW (optional, defaults to MEDIUM)"
            },
            dueDate: {
              type: "string",
              description: "Task due date in ISO 8601 format (optional, required for scheduled tasks)"
            },
            duration: {
              type: ["string", "number"],
              description: "Task duration in minutes (number) or 'NONE' or 'REMINDER' (optional)"
            },
            assigneeId: {
              type: "string",
              description: "User ID to assign task to (optional)"
            },
            labels: {
              type: "array",
              items: { type: "string" },
              description: "Array of label names to add to the task (optional)"
            },
            autoScheduled: {
              type: ["object", "null"],
              description: "Auto-scheduling settings (optional). Set to null to disable auto-scheduling."
            }
          },
          required: ["name"]
        }
      },
      {
        name: "list_motion_tasks",
        description: "List tasks in Motion with optional filters. If no workspace is specified, will use the default workspace.",
        inputSchema: {
          type: "object",
          properties: {
            workspaceId: {
              type: "string",
              description: "Optional workspace ID to filter tasks. If not provided, uses default workspace."
            },
            workspaceName: {
              type: "string",
              description: "Optional workspace name to filter tasks (alternative to workspaceId)."
            },
            projectId: {
              type: "string",
              description: "Filter tasks by project ID (optional)"
            },
            status: {
              type: "string",
              description: "Filter tasks by status (optional)"
            },
            assigneeId: {
              type: "string",
              description: "Filter tasks by assignee ID (optional)"
            }
          },
          additionalProperties: false
        }
      },
      {
        name: "get_motion_task",
        description: "Get a specific task by ID from Motion",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "The task ID to retrieve"
            }
          },
          required: ["taskId"]
        }
      },
      {
        name: "update_motion_task",
        description: "Update an existing task in Motion",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "The task ID to update"
            },
            name: {
              type: "string",
              description: "Updated task name (optional)"
            },
            description: {
              type: "string",
              description: "Updated task description (optional)"
            },
            status: {
              type: "string",
              description: "Updated task status (optional)"
            },
            priority: {
              type: "string",
              description: "Updated task priority (optional)"
            },
            dueDate: {
              type: "string",
              description: "Updated task due date in ISO format (optional)"
            },
            projectId: {
              type: "string",
              description: "Updated project ID (optional)"
            },
            assigneeId: {
              type: "string",
              description: "Updated assignee ID (optional)"
            }
          },
          required: ["taskId"]
        }
      },
      {
        name: "delete_motion_task",
        description: "Delete a task from Motion",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "The task ID to delete"
            }
          },
          required: ["taskId"]
        }
      },
      {
        name: "list_motion_workspaces",
        description: "List all workspaces in Motion. Use this to show users available workspaces so they can choose which one to work with.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: "list_motion_users",
        description: "List all users in Motion",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: "get_motion_context",
        description: "Get current Motion context and intelligent defaults. This tool provides the LLM with comprehensive context about the user's Motion workspace, including default workspace, recent activity, and smart suggestions. Use this tool first to understand the user's current state.",
        inputSchema: {
          type: "object",
          properties: {
            includeRecentActivity: {
              type: "boolean",
              description: "Include recent tasks and projects (optional, defaults to true)"
            },
            includeWorkloadSummary: {
              type: "boolean",
              description: "Include workload and task distribution summary (optional, defaults to true)"
            },
            includeSuggestions: {
              type: "boolean",
              description: "Include intelligent suggestions for next actions (optional, defaults to true)"
            }
          },
          additionalProperties: false
        }
      },
      {
        name: "search_motion_content",
        description: "Perform intelligent search across tasks and projects by content, keywords, or semantic meaning. This goes beyond simple name matching to search task descriptions, project details, and related content.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query - can be keywords, phrases, or semantic descriptions"
            },
            searchScope: {
              type: "string",
              enum: ["tasks", "projects", "both"],
              description: "What to search (optional, defaults to 'both')"
            },
            workspaceId: {
              type: "string",
              description: "Limit search to specific workspace (optional, defaults to all accessible workspaces)"
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (optional, defaults to 20)"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "analyze_motion_workload",
        description: "Analyze current workload, overdue tasks, upcoming deadlines, and provide insights about task distribution and priorities. Helpful for understanding user's current situation and providing intelligent suggestions.",
        inputSchema: {
          type: "object",
          properties: {
            workspaceId: {
              type: "string",
              description: "Workspace to analyze (optional, defaults to all workspaces)"
            },
            timeframe: {
              type: "string",
              enum: ["today", "this_week", "this_month", "next_week"],
              description: "Time period to analyze (optional, defaults to 'this_week')"
            },
            includeProjects: {
              type: "boolean",
              description: "Include project-level analysis (optional, defaults to true)"
            }
          },
          additionalProperties: false
        }
      },
      {
        name: "suggest_next_actions",
        description: "Provide intelligent suggestions for next actions based on current workload, priorities, deadlines, and project status. Helps LLM provide proactive assistance.",
        inputSchema: {
          type: "object",
          properties: {
            workspaceId: {
              type: "string",
              description: "Workspace to analyze for suggestions (optional, uses default workspace)"
            },
            context: {
              type: "string",
              description: "Current context or goal (optional, e.g., 'daily planning', 'project review', 'end of week')"
            },
            maxSuggestions: {
              type: "number",
              description: "Maximum number of suggestions to return (optional, defaults to 5)"
            }
          },
          additionalProperties: false
        }
      },
      {
        name: "create_project_template",
        description: "Create a new project with a predefined template including common tasks, structure, and best practices. Templates can be customized based on project type and user preferences.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Project name"
            },
            templateType: {
              type: "string",
              enum: ["software_development", "marketing_campaign", "research_project", "event_planning", "content_creation", "general"],
              description: "Type of project template to use"
            },
            workspaceId: {
              type: "string",
              description: "Workspace where project should be created (optional, uses default)"
            },
            customizations: {
              type: "object",
              description: "Template customizations (optional)",
              properties: {
                includeTaskTemplates: {
                  type: "boolean",
                  description: "Whether to create template tasks (defaults to true)"
                },
                projectDuration: {
                  type: "string",
                  description: "Expected project duration (e.g., '2 weeks', '3 months')"
                },
                teamSize: {
                  type: "number",
                  description: "Expected team size for task assignment"
                }
              }
            }
          },
          required: ["name", "templateType"]
        }
      },
      {
        name: "bulk_update_tasks",
        description: "Update multiple tasks at once with the same changes. Useful for batch operations like changing status, priority, or assignee for multiple tasks.",
        inputSchema: {
          type: "object",
          properties: {
            taskIds: {
              type: "array",
              items: { type: "string" },
              description: "Array of task IDs to update"
            },
            updates: {
              type: "object",
              description: "Updates to apply to all tasks",
              properties: {
                status: { type: "string" },
                priority: { type: "string" },
                assigneeId: { type: "string" },
                projectId: { type: "string" },
                dueDate: { type: "string" }
              }
            },
            workspaceId: {
              type: "string",
              description: "Workspace ID for validation (optional, uses default)"
            }
          },
          required: ["taskIds", "updates"]
        }
      },
      {
        name: "smart_schedule_tasks",
        description: "Intelligently schedule multiple tasks based on priorities, deadlines, estimated durations, and availability. Provides optimal scheduling suggestions.",
        inputSchema: {
          type: "object",
          properties: {
            taskIds: {
              type: "array",
              items: { type: "string" },
              description: "Array of task IDs to schedule (optional, will auto-select unscheduled tasks if not provided)"
            },
            workspaceId: {
              type: "string",
              description: "Workspace to schedule tasks in (optional, uses default)"
            },
            schedulingPreferences: {
              type: "object",
              description: "Scheduling preferences (optional)",
              properties: {
                prioritizeDeadlines: {
                  type: "boolean",
                  description: "Prioritize tasks with deadlines (defaults to true)"
                },
                respectPriorities: {
                  type: "boolean",
                  description: "Schedule higher priority tasks first (defaults to true)"
                },
                includeBufferTime: {
                  type: "boolean",
                  description: "Add buffer time between tasks (defaults to true)"
                }
              }
            }
          },
          additionalProperties: false
        }
      }
    ];
  }

  // Handle MCP tool calls - same logic as stdio version
  async handleToolCall(toolName, args) {
    try {
      switch (toolName) {
        case "create_motion_project":
          return await this.handleCreateProject(args);
        case "list_motion_projects":
          return await this.handleListProjects(args);
        case "get_motion_project":
          return await this.handleGetProject(args);
        case "update_motion_project":
          return await this.handleUpdateProject(args);
        case "delete_motion_project":
          return await this.handleDeleteProject(args);
        case "create_motion_task":
          return await this.handleCreateTask(args);
        case "list_motion_tasks":
          return await this.handleListTasks(args);
        case "get_motion_task":
          return await this.handleGetTask(args);
        case "update_motion_task":
          return await this.handleUpdateTask(args);
        case "delete_motion_task":
          return await this.handleDeleteTask(args);
        case "list_motion_workspaces":
          return await this.handleListWorkspaces();
        case "list_motion_users":
          return await this.handleListUsers();
        case "get_motion_context":
          return await this.handleGetContext(args);
        case "search_motion_content":
          return await this.handleSearchContent(args);
        case "analyze_motion_workload":
          return await this.handleAnalyzeWorkload(args);
        case "suggest_next_actions":
          return await this.handleSuggestNextActions(args);
        case "create_project_template":
          return await this.handleCreateProjectTemplate(args);
        case "bulk_update_tasks":
          return await this.handleBulkUpdateTasks(args);
        case "smart_schedule_tasks":
          return await this.handleSmartScheduleTasks(args);
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  // Tool handler methods - adapted from stdio version
  async handleCreateProject(args) {
    const project = await this.motionService.createProject(args);
    return {
      content: [
        {
          type: "text",
          text: `Successfully created project "${project.name}" with ID: ${project.id}`
        }
      ]
    };
  }

  async handleListProjects(args = {}) {
    let workspaceId = args.workspaceId;
    let workspaceName = null;

    // If workspace name provided instead of ID, look it up
    if (!workspaceId && args.workspaceName) {
      try {
        const workspace = await this.motionService.getWorkspaceByName(args.workspaceName);
        workspaceId = workspace.id;
        workspaceName = workspace.name;
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Could not find workspace "${args.workspaceName}". Available workspaces can be listed with list_motion_workspaces.`
            }
          ],
          isError: true
        };
      }
    }

    // Get projects for the specified or default workspace
    const projects = await this.motionService.getProjects(workspaceId);

    // Get workspace info for context
    if (!workspaceName && workspaceId) {
      try {
        const workspaces = await this.motionService.getWorkspaces();
        const workspace = workspaces.find(w => w.id === workspaceId);
        workspaceName = workspace ? workspace.name : 'Unknown';
      } catch (error) {
        workspaceName = 'Unknown';
      }
    } else if (!workspaceName) {
      try {
        const defaultWorkspace = await this.motionService.getDefaultWorkspace();
        workspaceName = defaultWorkspace.name;
        workspaceId = defaultWorkspace.id;
      } catch (error) {
        workspaceName = 'Default';
      }
    }

    const projectList = projects.map(p => `- ${p.name} (ID: ${p.id})`).join('\n');

    let responseText = `Found ${projects.length} projects in workspace "${workspaceName}"`;
    if (workspaceId) {
      responseText += ` (ID: ${workspaceId})`;
    }
    responseText += `:\n${projectList}`;

    // If no workspace was specified and there are multiple workspaces, suggest the user can specify one
    if (!args.workspaceId && !args.workspaceName) {
      responseText += `\n\nNote: This shows projects from the default workspace. You can specify a different workspace using the workspaceId or workspaceName parameter, or use list_motion_workspaces to see all available workspaces.`;
    }

    return {
      content: [
        {
          type: "text",
          text: responseText
        }
      ]
    };
  }

  async handleGetProject(args) {
    const project = await this.motionService.getProject(args.projectId);
    return {
      content: [
        {
          type: "text",
          text: `Project Details:\n- Name: ${project.name}\n- ID: ${project.id}\n- Description: ${project.description || 'N/A'}\n- Status: ${project.status || 'N/A'}`
        }
      ]
    };
  }

  async handleUpdateProject(args) {
    const { projectId, ...updateData } = args;
    const project = await this.motionService.updateProject(projectId, updateData);
    return {
      content: [
        {
          type: "text",
          text: `Successfully updated project "${project.name}" (ID: ${project.id})`
        }
      ]
    };
  }

  async handleDeleteProject(args) {
    await this.motionService.deleteProject(args.projectId);
    return {
      content: [
        {
          type: "text",
          text: `Successfully deleted project with ID: ${args.projectId}`
        }
      ]
    };
  }

  async handleCreateTask(args) {
    try {
      // Resolve workspace ID if needed
      let workspaceId = args.workspaceId;
      if (!workspaceId && args.workspaceName) {
        const workspace = await this.motionService.getWorkspaceByName(args.workspaceName);
        workspaceId = workspace.id;
      } else if (!workspaceId) {
        const defaultWorkspace = await this.motionService.getDefaultWorkspace();
        workspaceId = defaultWorkspace.id;
      }

      // Resolve project ID if needed
      let projectId = args.projectId;
      if (!projectId && args.projectName) {
        try {
          const project = await this.motionService.getProjectByName(args.projectName, workspaceId);
          projectId = project.id;
        } catch (projectError) {
          throw new Error(`Project "${args.projectName}" not found in workspace`);
        }
      }

      // Build task data with required workspaceId
      const taskData = {
        name: args.name,
        workspaceId, // Required by Motion API
        ...(args.description && { description: args.description }),
        ...(projectId && { projectId }),
        ...(args.status && { status: args.status }),
        ...(args.priority && { priority: args.priority }),
        ...(args.dueDate && { dueDate: args.dueDate }),
        ...(args.duration && { duration: args.duration }),
        ...(args.assigneeId && { assigneeId: args.assigneeId }),
        ...(args.labels && { labels: args.labels }),
        ...(args.autoScheduled !== undefined && { autoScheduled: args.autoScheduled })
      };

      const task = await this.motionService.createTask(taskData);

      return {
        content: [
          {
            type: "text",
            text: `Successfully created task "${task.name}" with ID: ${task.id}${projectId ? ` in project ${projectId}` : ''} in workspace ${workspaceId}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to create task: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  async handleListTasks(args = {}) {
    const tasks = await this.motionService.getTasks(args);
    const taskList = tasks.map(t => `- ${t.name} (ID: ${t.id}) - Status: ${t.status || 'N/A'}`).join('\n');
    return {
      content: [
        {
          type: "text",
          text: `Found ${tasks.length} tasks:\n${taskList}`
        }
      ]
    };
  }

  async handleGetTask(args) {
    const task = await this.motionService.getTask(args.taskId);
    return {
      content: [
        {
          type: "text",
          text: `Task Details:\n- Name: ${task.name}\n- ID: ${task.id}\n- Description: ${task.description || 'N/A'}\n- Status: ${task.status || 'N/A'}\n- Priority: ${task.priority || 'N/A'}`
        }
      ]
    };
  }

  async handleUpdateTask(args) {
    const { taskId, ...updateData } = args;
    const task = await this.motionService.updateTask(taskId, updateData);
    return {
      content: [
        {
          type: "text",
          text: `Successfully updated task "${task.name}" (ID: ${task.id})`
        }
      ]
    };
  }

  async handleDeleteTask(args) {
    await this.motionService.deleteTask(args.taskId);
    return {
      content: [
        {
          type: "text",
          text: `Successfully deleted task with ID: ${args.taskId}`
        }
      ]
    };
  }

  async handleListWorkspaces() {
    const workspaces = await this.motionService.getWorkspaces();
    const defaultWorkspace = await this.motionService.getDefaultWorkspace();

    const workspaceList = workspaces.map(w => {
      const isDefault = w.id === defaultWorkspace.id ? ' (DEFAULT)' : '';
      return `- ${w.name} (ID: ${w.id})${isDefault} - Type: ${w.type}`;
    }).join('\n');

    return {
      content: [
        {
          type: "text",
          text: `Found ${workspaces.length} workspaces:\n${workspaceList}\n\nYou can use either the workspace name or ID when specifying which workspace to work with in other commands.`
        }
      ]
    };
  }

  async handleListUsers() {
    const users = await this.motionService.getUsers();
    const userList = users.map(u => `- ${u.name} (ID: ${u.id}) - ${u.email || 'No email'}`).join('\n');
    return {
      content: [
        {
          type: "text",
          text: `Found ${users.length} users:\n${userList}`
        }
      ]
    };
  }

  async handleGetContext(args) {
    const includeRecentActivity = args.includeRecentActivity !== false;
    const includeWorkloadSummary = args.includeWorkloadSummary !== false;
    const includeSuggestions = args.includeSuggestions !== false;

    try {
      const context = await this.motionService.getMotionContext({
        includeRecentActivity,
        includeWorkloadSummary,
        includeSuggestions
      });

      let responseText = "Current Motion Context:\n";

      if (context.defaultWorkspace) {
        responseText += `- Default Workspace: ${context.defaultWorkspace.name} (ID: ${context.defaultWorkspace.id})\n`;
      }

      if (context.recentActivity && context.recentActivity.length > 0) {
        responseText += `- Recent Tasks:\n`;
        context.recentActivity.forEach(activity => {
          responseText += `  - ${activity.name} (ID: ${activity.id}) - Status: ${activity.status || 'N/A'}\n`;
        });
      }

      if (context.suggestions && context.suggestions.length > 0) {
        responseText += `- Suggestions:\n`;
        context.suggestions.forEach(suggestion => {
          responseText += `  - ${suggestion}\n`;
        });
      }

      return {
        content: [
          {
            type: "text",
            text: responseText
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to get context: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  async handleSearchContent(args) {
    const { query, searchScope = "both", workspaceId, limit = 20 } = args;

    const results = await this.motionService.searchContent({
      query,
      searchScope,
      workspaceId,
      limit
    });

    const formattedResults = results.map(result => {
      const type = result.projectId ? "task" : "project";
      return `- [${type}] ${result.name} (ID: ${result.id})`;
    }).join('\n');

    return {
      content: [
        {
          type: "text",
          text: `Search Results for "${query}" (Limit: ${limit}):\n${formattedResults}`
        }
      ]
    };
  }

  async handleAnalyzeWorkload(args) {
    const { workspaceId, timeframe = "this_week", includeProjects = true } = args;

    const analysis = await this.motionService.analyzeWorkload({
      workspaceId,
      timeframe,
      includeProjects
    });

    let responseText = `Workload Analysis (${timeframe}):\n`;
    responseText += `- Total Tasks: ${analysis.totalTasks}\n`;
    responseText += `- Overdue Tasks: ${analysis.overdueTasks}\n`;
    responseText += `- Upcoming Deadlines: ${analysis.upcomingDeadlines}\n`;
    responseText += `- Task Distribution: ${JSON.stringify(analysis.taskDistribution, null, 2)}\n`;

    if (includeProjects) {
      responseText += `- Project Insights: ${JSON.stringify(analysis.projectInsights, null, 2)}\n`;
    }

    return {
      content: [
        {
          type: "text",
          text: responseText
        }
      ]
    };
  }

  async handleSuggestNextActions(args) {
    const { workspaceId, context, maxSuggestions = 5 } = args;

    // Get current workload and tasks
    const tasks = await this.motionService.getTasks({ workspaceId });
    const projects = await this.motionService.getProjects(workspaceId);

    // Analyze tasks and projects to suggest next actions
    const suggestions = this.generateSuggestions(tasks, projects, context, maxSuggestions);

    return {
      content: [
        {
          type: "text",
          text: `Suggested Next Actions:\n${suggestions.join('\n')}`
        }
      ]
    };
  }

  generateSuggestions(tasks, projects, context, maxSuggestions) {
    // Simple heuristic: suggest based on priority and due date
    const now = new Date();
    const sortedTasks = tasks
      .filter(task => task.dueDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const highPriorityTasks = sortedTasks.filter(task => task.priority === 'ASAP' || task.priority === 'HIGH');
    const upcomingDeadlines = sortedTasks.filter(task => new Date(task.dueDate) <= new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000));

    let suggestions = [];

    // Suggest high priority tasks first
    suggestions.push(...highPriorityTasks.map(task => `✅ ${task.name} (ID: ${task.id}) - Due: ${task.dueDate}`));

    // Then suggest tasks with upcoming deadlines
    suggestions.push(...upcomingDeadlines.map(task => `⏰ ${task.name} (ID: ${task.id}) - Due: ${task.dueDate}`));

    // Add project-related suggestions if context is project review
    if (context && context.includes('project review')) {
      const stalledProjects = projects.filter(project => project.status === 'stalled' || project.status === 'on hold');
      suggestions.push(...stalledProjects.map(project => `🔄 Review project: ${project.name} (ID: ${project.id})`));
    }

    return suggestions.slice(0, maxSuggestions);
  }

  async handleCreateProjectTemplate(args) {
    const { name, templateType, workspaceId, customizations } = args;

    const project = await this.motionService.createProject({
      name,
      workspaceId,
      description: `Project created from ${templateType} template`,
      status: 'active'
    });

    return {
      content: [
        {
          type: "text",
          text: `Successfully created project "${project.name}" with ID: ${project.id} from ${templateType} template`
        }
      ]
    };
  }

  async handleBulkUpdateTasks(args) {
    const { taskIds, updates, workspaceId } = args;

    await this.motionService.bulkUpdateTasks(taskIds, updates);

    return {
      content: [
        {
          type: "text",
          text: `Successfully updated ${taskIds.length} tasks`
        }
      ]
    };
  }

  async handleSmartScheduleTasks(args) {
    const { taskIds, workspaceId, schedulingPreferences } = args;

    let finalWorkspaceId = workspaceId;
    if (!finalWorkspaceId) {
      const defaultWorkspace = await this.motionService.getDefaultWorkspace();
      finalWorkspaceId = defaultWorkspace.id;
    }

    const schedule = await this.motionService.smartScheduleTasks(taskIds, finalWorkspaceId, schedulingPreferences);

    let responseText = `Scheduled ${taskIds?.length || 0} tasks:\n`;
    schedule.forEach(s => {
      responseText += `- Task ID: ${s.taskId} -> Scheduled Time: ${s.scheduledTime}\n`;
    });

    return {
      content: [
        {
          type: "text",
          text: responseText
        }
      ]
    };
  }
}

// CORS headers
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// MCP HTTP Stream Transport response helpers
function createMCPResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}

function createMCPError(error, id = null) {
  return new Response(JSON.stringify({
    jsonrpc: "2.0",
    error: {
      code: -32603,
      message: error.message || error
    },
    id
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}

// Main request handler
async function handleRequest(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  // Health check endpoint
  if (path === '/health') {
    return new Response(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      hasApiKey: !!env.MOTION_API_KEY
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  }

  // MCP HTTP Stream Transport endpoint
  if (path === '/mcp' && request.method === 'POST') {
    if (!env.MOTION_API_KEY) {
      return createMCPError('Motion API key not configured');
    }

    try {
      const mcpServer = new MotionMCPServer(env.MOTION_API_KEY);
      const requestData = await request.json();

      // Handle MCP protocol messages
      if (requestData.method === 'initialize') {
        return createMCPResponse({
          jsonrpc: "2.0",
          result: {
            protocolVersion: "2024-11-05",
            capabilities: mcpServer.capabilities,
            serverInfo: mcpServer.serverInfo
          },
          id: requestData.id
        });
      }

      if (requestData.method === 'tools/list') {
        return createMCPResponse({
          jsonrpc: "2.0",
          result: {
            tools: mcpServer.getToolDefinitions()
          },
          id: requestData.id
        });
      }

      if (requestData.method === 'tools/call') {
        const { name, arguments: args } = requestData.params;
        const result = await mcpServer.handleToolCall(name, args);
        
        return createMCPResponse({
          jsonrpc: "2.0",
          result: result,
          id: requestData.id
        });
      }

      return createMCPError(`Unknown method: ${requestData.method}`, requestData.id);

    } catch (error) {
      console.error('MCP Error:', error);
      return createMCPError(error.message || 'Internal server error', requestData?.id);
    }
  }

  // Legacy REST API endpoints (maintained for backwards compatibility)
  if (path.startsWith('/api/motion/')) {
    if (!env.MOTION_API_KEY) {
      return new Response(JSON.stringify({ error: 'Motion API key not configured' }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders()
        }
      });
    }

    const motionService = new MotionApiService(env.MOTION_API_KEY);
    const apiPath = path.replace('/api/motion', '');
    const method = request.method;

    try {
      // Handle basic REST API endpoints for backwards compatibility
      if (apiPath === '/projects' && method === 'GET') {
        const projects = await motionService.getProjects();
        return new Response(JSON.stringify(projects), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders() }
        });
      }

      if (apiPath === '/tasks' && method === 'GET') {
        const tasks = await motionService.getTasks();
        return new Response(JSON.stringify(tasks), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders() }
        });
      }

      if (apiPath === '/workspaces' && method === 'GET') {
        const workspaces = await motionService.getWorkspaces();
        return new Response(JSON.stringify(workspaces), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders() }
        });
      }

      if (apiPath === '/users' && method === 'GET') {
        const users = await motionService.getUsers();
        return new Response(JSON.stringify(users), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders() }
        });
      }

      return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });

    } catch (error) {
      console.error('API Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }
  }

  return new Response('Not Found', { status: 404, headers: corsHeaders() });
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};