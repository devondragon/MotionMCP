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
        projectId: taskData.projectId
      });
      const response = await this.client.post('/tasks', taskData);
      mcpLog('info', 'Successfully created task', {
        method: 'createTask',
        taskId: response.data?.id,
        taskName: response.data?.name,
        projectId: taskData.projectId
      });
      return response.data;
    } catch (error) {
      mcpLog('error', 'Failed to create task', {
        method: 'createTask',
        taskName: taskData.name,
        projectId: taskData.projectId,
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
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
}

module.exports = MotionApiService;
