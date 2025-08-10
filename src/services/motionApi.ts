import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { 
  MotionWorkspace, 
  MotionProject, 
  MotionTask, 
  MotionUser,
  ListResponse 
} from '../types/motion';
import { LogLevel, LOG_LEVELS } from '../utils/constants';

// MCP-compliant logger: outputs structured JSON to stderr
const mcpLog = (level: LogLevel, message: string, extra: Record<string, any> = {}): void => {
  const logEntry = {
    level,
    msg: message,
    time: new Date().toISOString(),
    ...extra
  };

  // MCP servers should log to stderr in JSON format
  console.error(JSON.stringify(logEntry));
};

export class MotionApiService {
  private apiKey: string;
  private baseUrl: string;
  private client: AxiosInstance;

  constructor() {
    const apiKey = process.env.MOTION_API_KEY;
    
    if (!apiKey) {
      mcpLog(LOG_LEVELS.ERROR, 'Motion API key not found in environment variables', {
        component: 'MotionApiService',
        method: 'constructor'
      });
      throw new Error('MOTION_API_KEY environment variable is required');
    }

    this.apiKey = apiKey;
    this.baseUrl = 'https://api.usemotion.com/v1';

    mcpLog(LOG_LEVELS.INFO, 'Initializing Motion API service', {
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
      (response: AxiosResponse) => {
        mcpLog(LOG_LEVELS.INFO, 'Motion API response successful', {
          url: response.config?.url,
          method: response.config?.method?.toUpperCase(),
          status: response.status,
          component: 'MotionApiService'
        });
        return response;
      },
      (error: AxiosError) => {
        const errorDetails = {
          url: error.config?.url,
          method: error.config?.method?.toUpperCase(),
          status: error.response?.status,
          statusText: error.response?.statusText,
          apiMessage: (error.response?.data as any)?.message,
          errorMessage: error.message,
          component: 'MotionApiService'
        };

        mcpLog(LOG_LEVELS.ERROR, 'Motion API request failed', errorDetails);
        throw error;
      }
    );
  }

  async getProjects(workspaceId?: string): Promise<MotionProject[]> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching projects from Motion API', {
        method: 'getProjects',
        workspaceId
      });

      // If no workspace ID provided, try to get the first available workspace
      if (!workspaceId) {
        try {
          const workspaces = await this.getWorkspaces();
          if (workspaces && workspaces.length > 0) {
            workspaceId = workspaces[0].id;
            mcpLog(LOG_LEVELS.INFO, 'Using first available workspace for projects', {
              method: 'getProjects',
              workspaceId,
              workspaceName: workspaces[0].name
            });
          }
        } catch (workspaceError: any) {
          mcpLog(LOG_LEVELS.WARN, 'Could not fetch workspace for projects', {
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

      const queryString = params.toString();
      const url = queryString ? `/projects?${queryString}` : '/projects';
      
      const response: AxiosResponse<ListResponse<MotionProject>> = await this.client.get(url);
      
      // The Motion API wraps the projects in a 'projects' array
      const projectsData = response.data?.projects || response.data || [];
      const projects = Array.isArray(projectsData) ? projectsData : [];
      
      mcpLog(LOG_LEVELS.INFO, 'Projects fetched successfully', {
        method: 'getProjects',
        count: projects.length,
        workspaceId
      });

      return projects;
    } catch (error: any) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch projects', {
        method: 'getProjects',
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to fetch projects: ${error.response?.data?.message || error.message}`);
    }
  }

  async createProject(projectData: Partial<MotionProject>): Promise<MotionProject> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Creating project in Motion API', {
        method: 'createProject',
        projectName: projectData.name,
        workspaceId: projectData.workspaceId
      });

      if (!projectData.workspaceId) {
        throw new Error('Workspace ID is required to create a project');
      }

      const response: AxiosResponse<MotionProject> = await this.client.post('/projects', projectData);
      
      mcpLog(LOG_LEVELS.INFO, 'Project created successfully', {
        method: 'createProject',
        projectId: response.data.id,
        projectName: response.data.name
      });

      return response.data;
    } catch (error: any) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to create project', {
        method: 'createProject',
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to create project: ${error.response?.data?.message || error.message}`);
    }
  }

  async updateProject(projectId: string, updates: Partial<MotionProject>): Promise<MotionProject> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Updating project in Motion API', {
        method: 'updateProject',
        projectId,
        updates: Object.keys(updates)
      });

      const response: AxiosResponse<MotionProject> = await this.client.patch(`/projects/${projectId}`, updates);
      
      mcpLog(LOG_LEVELS.INFO, 'Project updated successfully', {
        method: 'updateProject',
        projectId,
        projectName: response.data.name
      });

      return response.data;
    } catch (error: any) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to update project', {
        method: 'updateProject',
        projectId,
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to update project: ${error.response?.data?.message || error.message}`);
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Deleting project from Motion API', {
        method: 'deleteProject',
        projectId
      });

      await this.client.delete(`/projects/${projectId}`);
      
      mcpLog(LOG_LEVELS.INFO, 'Project deleted successfully', {
        method: 'deleteProject',
        projectId
      });
    } catch (error: any) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to delete project', {
        method: 'deleteProject',
        projectId,
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to delete project: ${error.response?.data?.message || error.message}`);
    }
  }

  async getTasks(workspaceId?: string, projectId?: string): Promise<MotionTask[]> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching tasks from Motion API', {
        method: 'getTasks',
        workspaceId,
        projectId
      });

      // If no workspace ID provided, try to get the first available workspace
      if (!workspaceId) {
        try {
          const workspaces = await this.getWorkspaces();
          if (workspaces && workspaces.length > 0) {
            workspaceId = workspaces[0].id;
            mcpLog(LOG_LEVELS.INFO, 'Using first available workspace for tasks', {
              method: 'getTasks',
              workspaceId,
              workspaceName: workspaces[0].name
            });
          }
        } catch (workspaceError: any) {
          mcpLog(LOG_LEVELS.WARN, 'Could not fetch workspace for tasks', {
            method: 'getTasks',
            error: workspaceError.message
          });
        }
      }

      const params = new URLSearchParams();
      if (workspaceId) {
        params.append('workspaceId', workspaceId);
      }
      if (projectId) {
        params.append('projectId', projectId);
      }

      const queryString = params.toString();
      const url = queryString ? `/tasks?${queryString}` : '/tasks';
      
      const response: AxiosResponse<ListResponse<MotionTask>> = await this.client.get(url);
      
      // The Motion API might wrap the tasks in a 'tasks' array
      const tasksData = response.data?.tasks || response.data || [];
      const tasks = Array.isArray(tasksData) ? tasksData : [];
      
      mcpLog(LOG_LEVELS.INFO, 'Tasks fetched successfully', {
        method: 'getTasks',
        count: tasks.length,
        workspaceId,
        projectId
      });

      return tasks;
    } catch (error: any) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch tasks', {
        method: 'getTasks',
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to fetch tasks: ${error.response?.data?.message || error.message}`);
    }
  }

  async createTask(taskData: Partial<MotionTask>): Promise<MotionTask> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Creating task in Motion API', {
        method: 'createTask',
        taskName: taskData.name,
        workspaceId: taskData.workspaceId,
        projectId: taskData.projectId
      });

      if (!taskData.workspaceId) {
        throw new Error('Workspace ID is required to create a task');
      }

      const response: AxiosResponse<MotionTask> = await this.client.post('/tasks', taskData);
      
      mcpLog(LOG_LEVELS.INFO, 'Task created successfully', {
        method: 'createTask',
        taskId: response.data.id,
        taskName: response.data.name
      });

      return response.data;
    } catch (error: any) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to create task', {
        method: 'createTask',
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to create task: ${error.response?.data?.message || error.message}`);
    }
  }

  async updateTask(taskId: string, updates: Partial<MotionTask>): Promise<MotionTask> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Updating task in Motion API', {
        method: 'updateTask',
        taskId,
        updates: Object.keys(updates)
      });

      const response: AxiosResponse<MotionTask> = await this.client.patch(`/tasks/${taskId}`, updates);
      
      mcpLog(LOG_LEVELS.INFO, 'Task updated successfully', {
        method: 'updateTask',
        taskId,
        taskName: response.data.name
      });

      return response.data;
    } catch (error: any) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to update task', {
        method: 'updateTask',
        taskId,
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to update task: ${error.response?.data?.message || error.message}`);
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Deleting task from Motion API', {
        method: 'deleteTask',
        taskId
      });

      await this.client.delete(`/tasks/${taskId}`);
      
      mcpLog(LOG_LEVELS.INFO, 'Task deleted successfully', {
        method: 'deleteTask',
        taskId
      });
    } catch (error: any) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to delete task', {
        method: 'deleteTask',
        taskId,
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to delete task: ${error.response?.data?.message || error.message}`);
    }
  }

  async getWorkspaces(): Promise<MotionWorkspace[]> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching workspaces from Motion API', {
        method: 'getWorkspaces'
      });

      const response: AxiosResponse<ListResponse<MotionWorkspace>> = await this.client.get('/workspaces');
      
      // The Motion API wraps the workspaces in a 'workspaces' array
      const workspacesData = response.data?.workspaces || response.data || [];
      const workspaces = Array.isArray(workspacesData) ? workspacesData : [];
      
      mcpLog(LOG_LEVELS.INFO, 'Workspaces fetched successfully', {
        method: 'getWorkspaces',
        count: workspaces.length,
        workspaceNames: workspaces.map((w: any) => w.name)
      });

      return workspaces;
    } catch (error: any) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch workspaces', {
        method: 'getWorkspaces',
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to fetch workspaces: ${error.response?.data?.message || error.message}`);
    }
  }

  async getUsers(workspaceId?: string): Promise<MotionUser[]> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching users from Motion API', {
        method: 'getUsers',
        workspaceId
      });

      const params = new URLSearchParams();
      if (workspaceId) {
        params.append('workspaceId', workspaceId);
      }

      const queryString = params.toString();
      const url = queryString ? `/users?${queryString}` : '/users';
      
      const response: AxiosResponse<ListResponse<MotionUser>> = await this.client.get(url);
      
      // The Motion API might wrap the users in a 'users' array
      const usersData = response.data?.users || response.data || [];
      const users = Array.isArray(usersData) ? usersData : [];
      
      mcpLog(LOG_LEVELS.INFO, 'Users fetched successfully', {
        method: 'getUsers',
        count: users.length,
        workspaceId
      });

      return users;
    } catch (error: any) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch users', {
        method: 'getUsers',
        error: error.message,
        apiStatus: error.response?.status,
        apiMessage: error.response?.data?.message
      });
      throw new Error(`Failed to fetch users: ${error.response?.data?.message || error.message}`);
    }
  }

  // Additional methods for intelligent features

  async getProjectByName(projectName: string, workspaceId: string): Promise<MotionProject | undefined> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Finding project by name', {
        method: 'getProjectByName',
        projectName,
        workspaceId
      });

      const projects = await this.getProjects(workspaceId);
      const project = projects.find(p => p.name === projectName);

      if (project) {
        mcpLog(LOG_LEVELS.INFO, 'Project found by name', {
          method: 'getProjectByName',
          projectName,
          projectId: project.id
        });
      } else {
        mcpLog(LOG_LEVELS.WARN, 'Project not found by name', {
          method: 'getProjectByName',
          projectName,
          availableProjects: projects.map(p => p.name)
        });
      }

      return project || undefined;
    } catch (error: any) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to find project by name', {
        method: 'getProjectByName',
        projectName,
        error: error.message
      });
      throw error;
    }
  }

  async searchTasks(query: string, workspaceId?: string): Promise<MotionTask[]> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Searching tasks', {
        method: 'searchTasks',
        query,
        workspaceId
      });

      const tasks = await this.getTasks(workspaceId);
      const lowerQuery = query.toLowerCase();
      
      const matchingTasks = tasks.filter(task => 
        task.name?.toLowerCase().includes(lowerQuery) ||
        task.description?.toLowerCase().includes(lowerQuery)
      );

      mcpLog(LOG_LEVELS.INFO, 'Task search completed', {
        method: 'searchTasks',
        query,
        resultsCount: matchingTasks.length
      });

      return matchingTasks;
    } catch (error: any) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to search tasks', {
        method: 'searchTasks',
        query,
        error: error.message
      });
      throw error;
    }
  }

  async searchProjects(query: string, workspaceId?: string): Promise<MotionProject[]> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Searching projects', {
        method: 'searchProjects',
        query,
        workspaceId
      });

      const projects = await this.getProjects(workspaceId);
      const lowerQuery = query.toLowerCase();
      
      const matchingProjects = projects.filter(project => 
        project.name?.toLowerCase().includes(lowerQuery) ||
        project.description?.toLowerCase().includes(lowerQuery)
      );

      mcpLog(LOG_LEVELS.INFO, 'Project search completed', {
        method: 'searchProjects',
        query,
        resultsCount: matchingProjects.length
      });

      return matchingProjects;
    } catch (error: any) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to search projects', {
        method: 'searchProjects',
        query,
        error: error.message
      });
      throw error;
    }
  }
}