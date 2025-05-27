const axios = require('axios');

// MCP-compliant logger: outputs structured JSON to stderr
const mcpLog = (level, message, extra = {}) => {
  const logEntry = {
    level,
    msg: message,
    time: new Date().toISOString(),
    ...extra
  };

  // MCP servers should log to stderr in JSON format
  console.error(JSON.stringify(logEntry));
};

class MotionApiService {
  constructor() {
    this.apiKey = process.env.MOTION_API_KEY;
    this.baseUrl = 'https://api.usemotion.com/v1';

    if (!this.apiKey) {
      mcpLog('error', 'Motion API key not found in environment variables', {
        component: 'MotionApiService',
        method: 'constructor'
      });
      throw new Error('MOTION_API_KEY environment variable is required');
    }

    mcpLog('info', 'Initializing Motion API service', {
      component: 'MotionApiService',
      baseUrl: this.baseUrl
    });

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-API-Key': `${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    this.client.interceptors.response.use(
      response => {
        mcpLog('info', 'Motion API response successful', {
          url: response.config?.url,
          method: response.config?.method?.toUpperCase(),
          status: response.status,
          component: 'MotionApiService'
        });
        return response;
      },
      error => {
        const errorDetails = {
          url: error.config?.url,
          method: error.config?.method?.toUpperCase(),
          status: error.response?.status,
          statusText: error.response?.statusText,
          apiMessage: error.response?.data?.message,
          errorMessage: error.message,
          component: 'MotionApiService'
        };

        mcpLog('error', 'Motion API request failed', errorDetails);
        throw error;
      }
    );
  }

  async getProjects(workspaceId = null) {
    try {
      mcpLog('debug', 'Fetching projects from Motion API', {
        method: 'getProjects',
        workspaceId
      });

      // If no workspace ID provided, try to get the first available workspace
      if (!workspaceId) {
        try {
          const workspaces = await this.getWorkspaces();
          if (workspaces && workspaces.length > 0) {
            workspaceId = workspaces[0].id;
            mcpLog('info', 'Using first available workspace for projects', {
              method: 'getProjects',
              workspaceId,
              workspaceName: workspaces[0].name
            });
          }
        } catch (workspaceError) {
          mcpLog('warn', 'Could not fetch workspace for projects', {
            method: 'getProjects',
            error: workspaceError.message
          });
        }
      }

      // Build the query string with workspace ID if available
      const params = new URLSearchParams();
      if (workspaceId) {
        params.append('workspaceId', workspaceId);
      }

      const url = `/projects${params.toString() ? '?' + params.toString() : ''}`;
      const response = await this.client.get(url);

      // Handle Motion API response structure - projects are wrapped in a projects array
      const projects = response.data?.projects || response.data || [];

      mcpLog('info', 'Successfully fetched projects', {
        method: 'getProjects',
        count: projects.length,
        workspaceId,
        responseStructure: response.data?.projects ? 'wrapped' : 'direct'
      });
      return projects;
    } catch (error) {
      mcpLog('error', 'Failed to fetch projects', {
        method: 'getProjects',
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message,
        workspaceId
      });
      throw new Error(`Failed to fetch projects: ${error.response?.data?.message || error.message}`);
    }
  }

  async createProject(projectData) {
    try {
      mcpLog('debug', 'Creating new project in Motion API', {
        method: 'createProject',
        projectName: projectData.name
      });

      // If no workspace ID provided, try to get the default workspace
      if (!projectData.workspaceId) {
        try {
          const defaultWorkspace = await this.getDefaultWorkspace();
          projectData = { ...projectData, workspaceId: defaultWorkspace.id };
          mcpLog('info', 'Using default workspace for new project', {
            method: 'createProject',
            workspaceId: defaultWorkspace.id,
            workspaceName: defaultWorkspace.name
          });
        } catch (workspaceError) {
          mcpLog('warn', 'Could not get default workspace for project creation', {
            method: 'createProject',
            error: workspaceError.message
          });
        }
      }

      const response = await this.client.post('/projects', projectData);
      mcpLog('info', 'Successfully created project', {
        method: 'createProject',
        projectId: response.data?.id,
        projectName: response.data?.name,
        workspaceId: projectData.workspaceId
      });
      return response.data;
    } catch (error) {
      mcpLog('error', 'Failed to create project', {
        method: 'createProject',
        projectName: projectData.name,
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to create project: ${error.response?.data?.message || error.message}`);
    }
  }

  async getProject(projectId) {
    try {
      mcpLog('debug', 'Fetching project details from Motion API', {
        method: 'getProject',
        projectId
      });
      const response = await this.client.get(`/projects/${projectId}`);
      mcpLog('info', 'Successfully fetched project details', {
        method: 'getProject',
        projectId,
        projectName: response.data?.name
      });
      return response.data;
    } catch (error) {
      mcpLog('error', 'Failed to fetch project', {
        method: 'getProject',
        projectId,
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to fetch project: ${error.response?.data?.message || error.message}`);
    }
  }

  async updateProject(projectId, projectData) {
    try {
      mcpLog('debug', 'Updating project in Motion API', {
        method: 'updateProject',
        projectId,
        updateFields: Object.keys(projectData)
      });
      const response = await this.client.patch(`/projects/${projectId}`, projectData);
      mcpLog('info', 'Successfully updated project', {
        method: 'updateProject',
        projectId,
        projectName: response.data?.name
      });
      return response.data;
    } catch (error) {
      mcpLog('error', 'Failed to update project', {
        method: 'updateProject',
        projectId,
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to update project: ${error.response?.data?.message || error.message}`);
    }
  }

  async deleteProject(projectId) {
    try {
      mcpLog('debug', 'Deleting project from Motion API', {
        method: 'deleteProject',
        projectId
      });
      await this.client.delete(`/projects/${projectId}`);
      mcpLog('info', 'Successfully deleted project', {
        method: 'deleteProject',
        projectId
      });
      return { success: true };
    } catch (error) {
      mcpLog('error', 'Failed to delete project', {
        method: 'deleteProject',
        projectId,
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to delete project: ${error.response?.data?.message || error.message}`);
    }
  }

  async getTasks(options = {}) {
    try {
      mcpLog('debug', 'Fetching tasks from Motion API', {
        method: 'getTasks',
        filters: options
      });
      const params = new URLSearchParams();
      if (options.projectId) params.append('projectId', options.projectId);
      if (options.status) params.append('status', options.status);
      if (options.assigneeId) params.append('assigneeId', options.assigneeId);

      const response = await this.client.get(`/tasks?${params}`);

      // Handle Motion API response structure - tasks are wrapped in a tasks array
      const tasks = response.data?.tasks || response.data || [];

      mcpLog('info', 'Successfully fetched tasks', {
        method: 'getTasks',
        count: tasks.length,
        filters: options,
        responseStructure: response.data?.tasks ? 'wrapped' : 'direct'
      });
      return tasks;
    } catch (error) {
      mcpLog('error', 'Failed to fetch tasks', {
        method: 'getTasks',
        filters: options,
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to fetch tasks: ${error.response?.data?.message || error.message}`);
    }
  }

  async createTask(taskData) {
    try {
      mcpLog('debug', 'Creating new task in Motion API', {
        method: 'createTask',
        taskName: taskData.name,
        projectId: taskData.projectId,
        workspaceId: taskData.workspaceId
      });

      // Ensure workspaceId is present (required by Motion API)
      if (!taskData.workspaceId) {
        try {
          const defaultWorkspace = await this.getDefaultWorkspace();
          taskData = { ...taskData, workspaceId: defaultWorkspace.id };
          mcpLog('info', 'Using default workspace for new task', {
            method: 'createTask',
            workspaceId: defaultWorkspace.id,
            workspaceName: defaultWorkspace.name
          });
        } catch (workspaceError) {
          throw new Error('workspaceId is required to create a task and no default workspace could be found');
        }
      }

      // Validate required fields according to Motion API
      if (!taskData.name) {
        throw new Error('Task name is required');
      }

      // Log the final task data being sent to API
      mcpLog('debug', 'Sending task data to Motion API', {
        method: 'createTask',
        taskData: {
          name: taskData.name,
          workspaceId: taskData.workspaceId,
          projectId: taskData.projectId || 'none',
          status: taskData.status || 'default',
          priority: taskData.priority || 'not_set'
        }
      });

      const response = await this.client.post('/tasks', taskData);

      mcpLog('info', 'Successfully created task', {
        method: 'createTask',
        taskId: response.data?.id,
        taskName: response.data?.name,
        projectId: taskData.projectId,
        workspaceId: taskData.workspaceId
      });

      return response.data;
    } catch (error) {
      mcpLog('error', 'Failed to create task', {
        method: 'createTask',
        taskName: taskData.name,
        projectId: taskData.projectId,
        workspaceId: taskData.workspaceId,
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message,
        apiErrors: error.response?.data?.errors
      });

      // Provide more specific error messages
      if (error.response?.status === 400) {
        const apiMessage = error.response?.data?.message || '';
        if (apiMessage.includes('workspaceId')) {
          throw new Error('Invalid or missing workspaceId. Please provide a valid workspace ID.');
        } else if (apiMessage.includes('projectId')) {
          throw new Error('Invalid projectId. Please check that the project exists in the specified workspace.');
        }
      }

      throw new Error(`Failed to create task: ${error.response?.data?.message || error.message}`);
    }
  }

  async getTask(taskId) {
    try {
      mcpLog('debug', 'Fetching task details from Motion API', {
        method: 'getTask',
        taskId
      });
      const response = await this.client.get(`/tasks/${taskId}`);
      mcpLog('info', 'Successfully fetched task details', {
        method: 'getTask',
        taskId,
        taskName: response.data?.name
      });
      return response.data;
    } catch (error) {
      mcpLog('error', 'Failed to fetch task', {
        method: 'getTask',
        taskId,
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to fetch task: ${error.response?.data?.message || error.message}`);
    }
  }

  async updateTask(taskId, taskData) {
    try {
      mcpLog('debug', 'Updating task in Motion API', {
        method: 'updateTask',
        taskId,
        updateFields: Object.keys(taskData)
      });
      const response = await this.client.patch(`/tasks/${taskId}`, taskData);
      mcpLog('info', 'Successfully updated task', {
        method: 'updateTask',
        taskId,
        taskName: response.data?.name
      });
      return response.data;
    } catch (error) {
      mcpLog('error', 'Failed to update task', {
        method: 'updateTask',
        taskId,
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to update task: ${error.response?.data?.message || error.message}`);
    }
  }

  async deleteTask(taskId) {
    try {
      mcpLog('debug', 'Deleting task from Motion API', {
        method: 'deleteTask',
        taskId
      });
      await this.client.delete(`/tasks/${taskId}`);
      mcpLog('info', 'Successfully deleted task', {
        method: 'deleteTask',
        taskId
      });
      return { success: true };
    } catch (error) {
      mcpLog('error', 'Failed to delete task', {
        method: 'deleteTask',
        taskId,
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to delete task: ${error.response?.data?.message || error.message}`);
    }
  }

  async getWorkspaces() {
    try {
      mcpLog('debug', 'Fetching workspaces from Motion API', { method: 'getWorkspaces' });
      const response = await this.client.get('/workspaces');

      // Motion API returns workspaces wrapped in a "workspaces" property
      let workspaces = response.data;

      if (workspaces && workspaces.workspaces && Array.isArray(workspaces.workspaces)) {
        // Expected structure: { workspaces: [...] }
        workspaces = workspaces.workspaces;
        mcpLog('info', 'Successfully fetched workspaces', {
          method: 'getWorkspaces',
          count: workspaces.length,
          responseStructure: 'wrapped_array',
          workspaceNames: workspaces.map(w => w.name)
        });
      } else if (Array.isArray(workspaces)) {
        // Fallback: if it's already an array
        mcpLog('info', 'Successfully fetched workspaces', {
          method: 'getWorkspaces',
          count: workspaces.length,
          responseStructure: 'direct_array',
          workspaceNames: workspaces.map(w => w.name)
        });
      } else {
        // Unexpected structure
        mcpLog('warn', 'Unexpected workspace response structure', {
          method: 'getWorkspaces',
          responseData: workspaces,
          responseType: typeof workspaces
        });
        workspaces = [];
      }

      return workspaces;
    } catch (error) {
      mcpLog('error', 'Failed to fetch workspaces', {
        method: 'getWorkspaces',
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to fetch workspaces: ${error.response?.data?.message || error.message}`);
    }
  }

  async getUsers() {
    try {
      mcpLog('debug', 'Fetching users from Motion API', { method: 'getUsers' });
      const response = await this.client.get('/users');

      // Handle different response structures from Motion API
      let users = response.data;

      // If response.data is not an array, check if it's wrapped in a property
      if (!Array.isArray(users)) {
        if (users && users.users && Array.isArray(users.users)) {
          users = users.users;
        } else if (users && typeof users === 'object') {
          // If it's a single user object, wrap it in an array
          users = [users];
        } else {
          // If we can't determine the structure, log it and return empty array
          mcpLog('warn', 'Unexpected users response structure', {
            method: 'getUsers',
            responseData: users,
            responseType: typeof users
          });
          users = [];
        }
      }

      mcpLog('info', 'Successfully fetched users', {
        method: 'getUsers',
        count: users.length,
        responseStructure: Array.isArray(response.data) ? 'array' : 'object'
      });
      return users;
    } catch (error) {
      mcpLog('error', 'Failed to fetch users', {
        method: 'getUsers',
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to fetch users: ${error.response?.data?.message || error.message}`);
    }
  }

  async getDefaultWorkspace() {
    try {
      const workspaces = await this.getWorkspaces();

      if (!workspaces || workspaces.length === 0) {
        throw new Error('No workspaces available');
      }

      // Log all available workspaces for debugging
      mcpLog('debug', 'Available workspaces', {
        method: 'getDefaultWorkspace',
        workspaces: workspaces.map(w => ({ id: w.id, name: w.name, type: w.type }))
      });

      // Prefer the first workspace, but could add logic here to prefer certain types
      // For example, prefer "INDIVIDUAL" type workspaces over team workspaces
      let defaultWorkspace = workspaces[0];

      // Look for a personal or individual workspace first
      const personalWorkspace = workspaces.find(w =>
        w.type === 'INDIVIDUAL' &&
        (w.name.toLowerCase().includes('personal') || w.name.toLowerCase().includes('my'))
      );

      if (personalWorkspace) {
        defaultWorkspace = personalWorkspace;
        mcpLog('info', 'Selected personal workspace as default', {
          method: 'getDefaultWorkspace',
          workspaceId: defaultWorkspace.id,
          workspaceName: defaultWorkspace.name,
          type: defaultWorkspace.type
        });
      } else {
        mcpLog('info', 'Selected first available workspace as default', {
          method: 'getDefaultWorkspace',
          workspaceId: defaultWorkspace.id,
          workspaceName: defaultWorkspace.name,
          type: defaultWorkspace.type
        });
      }

      return defaultWorkspace;
    } catch (error) {
      mcpLog('error', 'Failed to get default workspace', {
        method: 'getDefaultWorkspace',
        error: error.message
      });
      throw error;
    }
  }

  async getWorkspaceByName(workspaceName) {
    try {
      const workspaces = await this.getWorkspaces();
      const workspace = workspaces.find(w => w.name.toLowerCase() === workspaceName.toLowerCase());

      if (!workspace) {
        throw new Error(`Workspace with name "${workspaceName}" not found`);
      }

      mcpLog('info', 'Found workspace by name', {
        method: 'getWorkspaceByName',
        workspaceName,
        workspaceId: workspace.id
      });

      return workspace;
    } catch (error) {
      mcpLog('error', 'Failed to find workspace by name', {
        method: 'getWorkspaceByName',
        workspaceName,
        error: error.message
      });
      throw error;
    }
  }

  async getTaskStatuses(workspaceId = null) {
    try {
      if (!workspaceId) {
        const defaultWorkspace = await this.getDefaultWorkspace();
        workspaceId = defaultWorkspace.id;
      }

      const workspaces = await this.getWorkspaces();
      const workspace = workspaces.find(w => w.id === workspaceId);

      if (!workspace) {
        throw new Error(`Workspace with ID "${workspaceId}" not found`);
      }

      mcpLog('info', 'Retrieved task statuses for workspace', {
        method: 'getTaskStatuses',
        workspaceId,
        workspaceName: workspace.name,
        statusCount: workspace.taskStatuses?.length || 0
      });

      return workspace.taskStatuses || [];
    } catch (error) {
      mcpLog('error', 'Failed to get task statuses', {
        method: 'getTaskStatuses',
        workspaceId,
        error: error.message
      });
      throw error;
    }
  }

  async getWorkspaceLabels(workspaceId = null) {
    try {
      if (!workspaceId) {
        const defaultWorkspace = await this.getDefaultWorkspace();
        workspaceId = defaultWorkspace.id;
      }

      const workspaces = await this.getWorkspaces();
      const workspace = workspaces.find(w => w.id === workspaceId);

      if (!workspace) {
        throw new Error(`Workspace with ID "${workspaceId}" not found`);
      }

      mcpLog('info', 'Retrieved labels for workspace', {
        method: 'getWorkspaceLabels',
        workspaceId,
        workspaceName: workspace.name,
        labelCount: workspace.labels?.length || 0
      });

      return workspace.labels || [];
    } catch (error) {
      mcpLog('error', 'Failed to get workspace labels', {
        method: 'getWorkspaceLabels',
        workspaceId,
        error: error.message
      });
      throw error;
    }
  }

  async getProjectByName(projectName, workspaceId = null) {
    try {
      if (!workspaceId) {
        const defaultWorkspace = await this.getDefaultWorkspace();
        workspaceId = defaultWorkspace.id;
      }

      const projects = await this.getProjects(workspaceId);
      const project = projects.find(p =>
        p.name.toLowerCase() === projectName.toLowerCase() ||
        p.name.toLowerCase().includes(projectName.toLowerCase())
      );

      if (!project) {
        throw new Error(`Project "${projectName}" not found in workspace`);
      }

      mcpLog('info', 'Found project by name', {
        method: 'getProjectByName',
        projectName,
        projectId: project.id,
        workspaceId
      });

      return project;
    } catch (error) {
      mcpLog('error', 'Failed to find project by name', {
        method: 'getProjectByName',
        projectName,
        workspaceId,
        error: error.message
      });
      throw error;
    }
  }

  // Enhanced Intelligence Methods

  async getMotionContext(options = {}) {
    try {
      const {
        includeRecentActivity = true,
        includeWorkloadSummary = true,
        includeSuggestions = true
      } = options;

      mcpLog('info', 'Fetching Motion context', {
        method: 'getMotionContext',
        includeRecentActivity,
        includeWorkloadSummary,
        includeSuggestions
      });

      const context = {
        timestamp: new Date().toISOString(),
        user: null,
        defaultWorkspace: null,
        workspaces: [],
        recentActivity: [],
        workloadSummary: {},
        suggestions: []
      };

      // Get user info and workspaces
      try {
        const [users, workspaces] = await Promise.all([
          this.getUsers(),
          this.getWorkspaces()
        ]);

        context.user = users[0] || null; // Assume first user is current user
        context.workspaces = workspaces;
        context.defaultWorkspace = await this.getDefaultWorkspace();
      } catch (error) {
        mcpLog('warn', 'Could not fetch user or workspace info for context', {
          method: 'getMotionContext',
          error: error.message
        });
      }

      // Get recent activity if requested
      if (includeRecentActivity && context.defaultWorkspace) {
        try {
          const recentTasks = await this.getTasks({
            workspaceId: context.defaultWorkspace.id,
            limit: 10
          });

          context.recentActivity = recentTasks
            .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
            .slice(0, 5)
            .map(task => ({
              type: 'task',
              id: task.id,
              name: task.name,
              status: task.status,
              priority: task.priority,
              updatedAt: task.updatedAt || task.createdAt
            }));
        } catch (error) {
          mcpLog('warn', 'Could not fetch recent activity for context', {
            method: 'getMotionContext',
            error: error.message
          });
        }
      }

      // Generate workload summary if requested
      if (includeWorkloadSummary && context.defaultWorkspace) {
        try {
          context.workloadSummary = await this.generateWorkloadSummary(context.defaultWorkspace.id);
        } catch (error) {
          mcpLog('warn', 'Could not generate workload summary for context', {
            method: 'getMotionContext',
            error: error.message
          });
        }
      }

      // Generate suggestions if requested
      if (includeSuggestions && context.defaultWorkspace) {
        try {
          context.suggestions = await this.generateContextSuggestions(context.defaultWorkspace.id);
        } catch (error) {
          mcpLog('warn', 'Could not generate suggestions for context', {
            method: 'getMotionContext',
            error: error.message
          });
        }
      }

      mcpLog('info', 'Successfully generated Motion context', {
        method: 'getMotionContext',
        workspaceCount: context.workspaces.length,
        recentActivityCount: context.recentActivity.length,
        suggestionsCount: context.suggestions.length
      });

      return context;
    } catch (error) {
      mcpLog('error', 'Failed to get Motion context', {
        method: 'getMotionContext',
        error: error.message
      });
      throw error;
    }
  }

  async searchContent(options) {
    try {
      const { query, searchScope = "both", workspaceId, limit = 20 } = options;

      mcpLog('info', 'Searching Motion content', {
        method: 'searchContent',
        query,
        searchScope,
        workspaceId,
        limit
      });

      let results = [];

      // Search tasks if scope includes tasks
      if (searchScope === "tasks" || searchScope === "both") {
        try {
          const tasks = await this.getTasks({ workspaceId });
          const taskResults = tasks
            .filter(task =>
              task.name.toLowerCase().includes(query.toLowerCase()) ||
              (task.description && task.description.toLowerCase().includes(query.toLowerCase()))
            )
            .map(task => ({
              ...task,
              type: 'task',
              relevance: this.calculateRelevance(task, query)
            }));

          results.push(...taskResults);
        } catch (error) {
          mcpLog('warn', 'Error searching tasks', {
            method: 'searchContent',
            error: error.message
          });
        }
      }

      // Search projects if scope includes projects
      if (searchScope === "projects" || searchScope === "both") {
        try {
          const projects = await this.getProjects(workspaceId);
          const projectResults = projects
            .filter(project =>
              project.name.toLowerCase().includes(query.toLowerCase()) ||
              (project.description && project.description.toLowerCase().includes(query.toLowerCase()))
            )
            .map(project => ({
              ...project,
              type: 'project',
              relevance: this.calculateRelevance(project, query)
            }));

          results.push(...projectResults);
        } catch (error) {
          mcpLog('warn', 'Error searching projects', {
            method: 'searchContent',
            error: error.message
          });
        }
      }

      // Sort by relevance and limit results
      results = results
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);

      mcpLog('info', 'Search completed', {
        method: 'searchContent',
        query,
        resultsCount: results.length
      });

      return results;
    } catch (error) {
      mcpLog('error', 'Failed to search content', {
        method: 'searchContent',
        error: error.message
      });
      throw error;
    }
  }

  calculateRelevance(item, query) {
    const queryLower = query.toLowerCase();
    let score = 0;

    // Exact name match gets highest score
    if (item.name.toLowerCase() === queryLower) {
      score += 100;
    }
    // Name contains query
    else if (item.name.toLowerCase().includes(queryLower)) {
      score += 50;
    }

    // Description contains query
    if (item.description && item.description.toLowerCase().includes(queryLower)) {
      score += 25;
    }

    // Boost score for high priority items
    if (item.priority === 'ASAP') score += 20;
    else if (item.priority === 'HIGH') score += 10;

    return score;
  }

  async analyzeWorkload(options) {
    try {
      const { workspaceId, timeframe = "this_week", includeProjects = true } = options;

      mcpLog('info', 'Analyzing workload', {
        method: 'analyzeWorkload',
        workspaceId,
        timeframe,
        includeProjects
      });

      const wsId = workspaceId || (await this.getDefaultWorkspace()).id;
      const tasks = await this.getTasks({ workspaceId: wsId });

      const now = new Date();
      const analysis = {
        totalTasks: tasks.length,
        overdueTasks: 0,
        upcomingDeadlines: 0,
        taskDistribution: {
          byStatus: {},
          byPriority: {},
          byProject: {}
        },
        projectInsights: {}
      };

      // Analyze tasks
      tasks.forEach(task => {
        // Count overdue tasks
        if (task.dueDate && new Date(task.dueDate) < now) {
          analysis.overdueTasks++;
        }

        // Count upcoming deadlines (next 7 days)
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          const daysUntilDue = (dueDate - now) / (1000 * 60 * 60 * 24);
          if (daysUntilDue >= 0 && daysUntilDue <= 7) {
            analysis.upcomingDeadlines++;
          }
        }

        // Task distribution by status
        analysis.taskDistribution.byStatus[task.status] =
          (analysis.taskDistribution.byStatus[task.status] || 0) + 1;

        // Task distribution by priority
        analysis.taskDistribution.byPriority[task.priority || 'NONE'] =
          (analysis.taskDistribution.byPriority[task.priority || 'NONE'] || 0) + 1;

        // Task distribution by project
        const projectKey = task.projectId || 'No Project';
        analysis.taskDistribution.byProject[projectKey] =
          (analysis.taskDistribution.byProject[projectKey] || 0) + 1;
      });

      // Project insights if requested
      if (includeProjects) {
        try {
          const projects = await this.getProjects(wsId);
          analysis.projectInsights = {
            totalProjects: projects.length,
            activeProjects: projects.filter(p => p.status === 'active').length,
            completedProjects: projects.filter(p => p.status === 'completed').length
          };
        } catch (error) {
          mcpLog('warn', 'Could not fetch project insights', {
            method: 'analyzeWorkload',
            error: error.message
          });
        }
      }

      mcpLog('info', 'Workload analysis completed', {
        method: 'analyzeWorkload',
        totalTasks: analysis.totalTasks,
        overdueTasks: analysis.overdueTasks,
        upcomingDeadlines: analysis.upcomingDeadlines
      });

      return analysis;
    } catch (error) {
      mcpLog('error', 'Failed to analyze workload', {
        method: 'analyzeWorkload',
        error: error.message
      });
      throw error;
    }
  }

  async generateWorkloadSummary(workspaceId) {
    const tasks = await this.getTasks({ workspaceId });
    const now = new Date();

    return {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed' || t.status === 'done').length,
      inProgress: tasks.filter(t => t.status === 'in-progress' || t.status === 'in_progress').length,
      overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < now).length,
      highPriority: tasks.filter(t => t.priority === 'ASAP' || t.priority === 'HIGH').length
    };
  }

  async generateContextSuggestions(workspaceId) {
    const tasks = await this.getTasks({ workspaceId });
    const suggestions = [];

    // Find overdue tasks
    const overdueTasks = tasks.filter(t =>
      t.dueDate && new Date(t.dueDate) < new Date()
    );

    if (overdueTasks.length > 0) {
      suggestions.push(`You have ${overdueTasks.length} overdue task(s) that need attention`);
    }

    // Find high priority tasks
    const highPriorityTasks = tasks.filter(t =>
      t.priority === 'ASAP' || t.priority === 'HIGH'
    );

    if (highPriorityTasks.length > 0) {
      suggestions.push(`Consider focusing on ${highPriorityTasks.length} high-priority task(s)`);
    }

    // Find tasks due soon
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    const tasksDueSoon = tasks.filter(t =>
      t.dueDate && new Date(t.dueDate) <= soon && new Date(t.dueDate) >= new Date()
    );

    if (tasksDueSoon.length > 0) {
      suggestions.push(`${tasksDueSoon.length} task(s) are due within 24 hours`);
    }

    return suggestions;
  }

  async bulkUpdateTasks(taskIds, updates) {
    try {
      mcpLog('info', 'Starting bulk task update', {
        method: 'bulkUpdateTasks',
        taskCount: taskIds.length,
        updates
      });

      const updatePromises = taskIds.map(taskId =>
        this.updateTask(taskId, updates)
      );

      const results = await Promise.allSettled(updatePromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      mcpLog('info', 'Bulk task update completed', {
        method: 'bulkUpdateTasks',
        successful,
        failed,
        total: taskIds.length
      });

      if (failed > 0) {
        const failures = results
          .filter(r => r.status === 'rejected')
          .map(r => r.reason.message);

        throw new Error(`${failed} task updates failed: ${failures.join(', ')}`);
      }

      return { successful, failed };
    } catch (error) {
      mcpLog('error', 'Failed to bulk update tasks', {
        method: 'bulkUpdateTasks',
        error: error.message
      });
      throw error;
    }
  }

  async smartScheduleTasks(taskIds, workspaceId, preferences = {}) {
    try {
      mcpLog('info', 'Starting smart task scheduling', {
        method: 'smartScheduleTasks',
        taskCount: taskIds?.length || 0,
        workspaceId,
        preferences
      });

      // Get tasks to schedule
      let tasksToSchedule = [];
      if (taskIds && taskIds.length > 0) {
        // Get specific tasks
        const taskPromises = taskIds.map(id => this.getTask(id));
        const taskResults = await Promise.allSettled(taskPromises);
        tasksToSchedule = taskResults
          .filter(r => r.status === 'fulfilled')
          .map(r => r.value);
      } else {
        // Get all unscheduled tasks in workspace
        const allTasks = await this.getTasks({ workspaceId });
        tasksToSchedule = allTasks.filter(task =>
          !task.scheduledStart || task.status === 'todo'
        );
      }

      // Sort tasks by priority and deadline
      const sortedTasks = tasksToSchedule.sort((a, b) => {
        // Priority order: ASAP > HIGH > MEDIUM > LOW
        const priorityOrder = { 'ASAP': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        const aPriority = priorityOrder[a.priority] || 1;
        const bPriority = priorityOrder[b.priority] || 1;

        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }

        // If same priority, sort by due date
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate) - new Date(b.dueDate);
        }

        return 0;
      });

      // Generate schedule (simplified - in reality, this would use Motion's auto-scheduling)
      const schedule = sortedTasks.map((task, index) => {
        const startTime = new Date();
        startTime.setHours(9 + index, 0, 0, 0); // Start at 9 AM, one hour apart

        return {
          taskId: task.id,
          taskName: task.name,
          scheduledTime: startTime.toISOString(),
          priority: task.priority,
          estimatedDuration: task.duration || 60
        };
      });

      mcpLog('info', 'Smart scheduling completed', {
        method: 'smartScheduleTasks',
        scheduledCount: schedule.length
      });

      return schedule;
    } catch (error) {
      mcpLog('error', 'Failed to smart schedule tasks', {
        method: 'smartScheduleTasks',
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = MotionApiService;
