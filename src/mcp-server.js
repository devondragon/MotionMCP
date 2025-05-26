#!/usr/bin/env node

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const MotionApiService = require('./services/motionApi.js');
require('dotenv').config();

class MotionMCPServer {
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
    this.setupHandlers();
  }

  async initialize() {
    try {
      this.motionService = new MotionApiService();
    } catch (error) {
      console.error("Failed to initialize Motion API service:", error.message);
      process.exit(1);
    }
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
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
                  description: "Task description (optional)"
                },
                status: {
                  type: "string",
                  description: "Task status (optional, e.g., TODO, IN_PROGRESS, DONE)"
                },
                priority: {
                  type: "string",
                  description: "Task priority (optional, e.g., LOW, MEDIUM, HIGH, URGENT)"
                },
                dueDate: {
                  type: "string",
                  description: "Task due date in ISO format (optional)"
                },
                projectId: {
                  type: "string",
                  description: "Project ID to assign task to (optional)"
                },
                assigneeId: {
                  type: "string",
                  description: "User ID to assign task to (optional)"
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
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
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

          default:
            throw new Error(`Unknown tool: ${name}`);
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
    });
  }

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
    const task = await this.motionService.createTask(args);
    return {
      content: [
        {
          type: "text",
          text: `Successfully created task "${task.name}" with ID: ${task.id}`
        }
      ]
    };
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

  async run() {
    await this.initialize();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error("Motion MCP Server running on stdio");
  }
}

if (require.main === module) {
  const server = new MotionMCPServer();
  server.run().catch((error) => {
    console.error("Failed to run server:", error);
    process.exit(1);
  });
}

module.exports = MotionMCPServer;
