import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { 
  MotionWorkspace, 
  MotionProject, 
  MotionTask, 
  MotionUser,
  ListResponse,
  MotionApiErrorResponse,
  MotionApiError
} from '../types/motion';
import { LOG_LEVELS, convertUndefinedToNull, RETRY_CONFIG } from '../utils/constants';
import { mcpLog } from '../utils/logger';
import { SimpleCache } from '../utils/cache';
import { z } from 'zod';
import { 
  ProjectsListResponseSchema,
  WorkspacesListResponseSchema,
  VALIDATION_CONFIG
} from '../schemas/motion';

// Type guard for axios errors
function isAxiosError(error: unknown): error is MotionApiError {
  return (
    error instanceof Error &&
    'response' in error &&
    typeof (error as any).response === 'object'
  );
}

// Helper to get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export class MotionApiService {
  private apiKey: string;
  private baseUrl: string;
  private client: AxiosInstance;
  private workspaceCache: SimpleCache<MotionWorkspace[]>;
  private userCache: SimpleCache<MotionUser[]>;
  private projectCache: SimpleCache<MotionProject[]>;

  /**
   * Validate API response against schema
   * Handles strict/lenient/off modes based on configuration
   */
  private validateResponse<T>(
    data: unknown,
    schema: z.ZodSchema<T>,
    context: string
  ): T {
    if (VALIDATION_CONFIG.mode === 'off') {
      return data as T;
    }

    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorDetails = {
          context,
          validationErrors: error.errors,
          ...(VALIDATION_CONFIG.includeDataInLogs ? { receivedData: data } : {})
        };

        if (VALIDATION_CONFIG.logErrors) {
          mcpLog(LOG_LEVELS.WARN, `API response validation failed for ${context}`, errorDetails);
        }

        if (VALIDATION_CONFIG.mode === 'strict') {
          throw new Error(`Invalid API response structure for ${context}: ${error.message}`);
        }
        
        // Lenient mode: return original data and hope for the best
        return data as T;
      }
      throw error;
    }
  }

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
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    // Initialize cache instances with different TTL values
    this.workspaceCache = new SimpleCache(600); // 10 minutes for workspaces
    this.userCache = new SimpleCache(600); // 10 minutes for users
    this.projectCache = new SimpleCache(300); // 5 minutes for projects

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
      (error: AxiosError<MotionApiErrorResponse>) => {
        const errorData = error.response?.data;
        const errorDetails = {
          url: error.config?.url,
          method: error.config?.method?.toUpperCase(),
          status: error.response?.status,
          statusText: error.response?.statusText,
          apiMessage: errorData?.message,
          apiCode: errorData?.code,
          errorMessage: error.message,
          component: 'MotionApiService'
        };

        mcpLog(LOG_LEVELS.ERROR, 'Motion API request failed', errorDetails);
        
        // Create typed error for better handling
        const typedError = new Error(
          errorData?.message || error.message
        ) as MotionApiError;
        typedError.response = error.response as any;
        
        throw typedError;
      }
    );
  }

  /**
   * Wraps an axios request with a retry mechanism featuring exponential backoff.
   * Only retries on 5xx server errors or 429 rate-limiting errors.
   */
  private async requestWithRetry<T>(request: () => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T>> {
    for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_RETRIES; attempt++) {
      try {
        return await request();
      } catch (error) {
        if (!axios.isAxiosError(error)) {
          throw error; // Not a network error, re-throw immediately
        }

        const status = error.response?.status;
        const isRetryable = (status && status >= 500) || status === 429;

        if (!isRetryable || attempt === RETRY_CONFIG.MAX_RETRIES) {
          mcpLog(LOG_LEVELS.WARN, `Request failed and will not be retried`, {
            status,
            attempt,
            maxRetries: RETRY_CONFIG.MAX_RETRIES,
            isRetryable,
            component: 'MotionApiService',
            method: 'requestWithRetry'
          });
          throw error; // Final attempt failed or error is not retryable
        }

        // Handle Retry-After header for 429
        const retryAfterHeader = error.response?.headers['retry-after'];
        let delay = 0;
        if (status === 429 && retryAfterHeader) {
          const retryAfterSeconds = parseInt(retryAfterHeader, 10);
          if (!isNaN(retryAfterSeconds)) {
            delay = retryAfterSeconds * 1000;
          }
        }

        // If no Retry-After header, use exponential backoff with jitter
        if (delay === 0) {
          const backoff = RETRY_CONFIG.INITIAL_BACKOFF_MS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
          const jitter = backoff * RETRY_CONFIG.JITTER_FACTOR * Math.random();
          delay = Math.min(backoff + jitter, RETRY_CONFIG.MAX_BACKOFF_MS);
        }
        
        mcpLog(LOG_LEVELS.INFO, `Request failed, retrying`, {
          attempt,
          maxRetries: RETRY_CONFIG.MAX_RETRIES,
          delayMs: Math.round(delay),
          error: error.message,
          status,
          component: 'MotionApiService',
          method: 'requestWithRetry'
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Should never reach here, but TypeScript requires a return or throw
    throw new Error('Max retries exceeded');
  }

  async getProjects(workspaceId: string): Promise<MotionProject[]> {
    const cacheKey = `projects:workspace:${workspaceId}`;
    
    return this.projectCache.withCache(cacheKey, async () => {
      try {
        mcpLog(LOG_LEVELS.DEBUG, 'Fetching projects from Motion API', {
          method: 'getProjects',
          workspaceId
        });

        // Build the query string with workspace ID (now required)
        const params = new URLSearchParams();
        params.append('workspaceId', workspaceId);
        const queryString = params.toString();
        const url = `/projects?${queryString}`;
        
        const response: AxiosResponse = await this.requestWithRetry(() => this.client.get(url));
        
        // Validate the response structure
        const validatedResponse = this.validateResponse(
          response.data,
          ProjectsListResponseSchema,
          'getProjects'
        );
        
        // Extract projects array (handle both wrapped and unwrapped responses)
        const projects = Array.isArray(validatedResponse) 
          ? validatedResponse 
          : validatedResponse.projects;
        
        mcpLog(LOG_LEVELS.INFO, 'Projects fetched successfully', {
          method: 'getProjects',
          count: projects.length,
          workspaceId
        });

        return projects;
      } catch (error: unknown) {
        mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch projects', {
          method: 'getProjects',
          error: getErrorMessage(error),
          apiStatus: isAxiosError(error) ? error.response?.status : undefined,
          apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
        });
        throw new Error(`Failed to fetch projects: ${(isAxiosError(error) ? error.response?.data?.message : undefined) || getErrorMessage(error)}`);
      }
    });
  }

  async getProject(projectId: string): Promise<MotionProject> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching single project from Motion API', {
        method: 'getProject',
        projectId
      });

      const response: AxiosResponse<MotionProject> = await this.requestWithRetry(() => this.client.get(`/projects/${projectId}`));

      mcpLog(LOG_LEVELS.INFO, 'Successfully fetched project', {
        method: 'getProject',
        projectId,
        projectName: response.data.name
      });

      return response.data;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch project', {
        method: 'getProject',
        projectId,
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
      });
      throw new Error(`Failed to fetch project: ${(isAxiosError(error) ? error.response?.data?.message : undefined) || getErrorMessage(error)}`);
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

      // Convert undefined to null for API compatibility
      const apiData = convertUndefinedToNull(projectData);
      const response: AxiosResponse<MotionProject> = await this.requestWithRetry(() => this.client.post('/projects', apiData));
      
      // Invalidate cache after successful creation
      this.projectCache.invalidate(`projects:workspace:${projectData.workspaceId}`);
      
      mcpLog(LOG_LEVELS.INFO, 'Project created successfully', {
        method: 'createProject',
        projectId: response.data.id,
        projectName: response.data.name
      });

      return response.data;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to create project', {
        method: 'createProject',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
      });
      throw new Error(`Failed to create project: ${(isAxiosError(error) ? error.response?.data?.message : undefined) || getErrorMessage(error)}`);
    }
  }

  async updateProject(projectId: string, updates: Partial<MotionProject>): Promise<MotionProject> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Updating project in Motion API', {
        method: 'updateProject',
        projectId,
        updates: Object.keys(updates)
      });

      // Convert undefined to null for API compatibility
      const apiUpdates = convertUndefinedToNull(updates);
      const response: AxiosResponse<MotionProject> = await this.requestWithRetry(() => this.client.patch(`/projects/${projectId}`, apiUpdates));
      
      // Invalidate cache after successful update
      this.projectCache.invalidate(`projects:workspace:${response.data.workspaceId}`);
      
      mcpLog(LOG_LEVELS.INFO, 'Project updated successfully', {
        method: 'updateProject',
        projectId,
        projectName: response.data.name
      });

      return response.data;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to update project', {
        method: 'updateProject',
        projectId,
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
      });
      throw new Error(`Failed to update project: ${(isAxiosError(error) ? error.response?.data?.message : undefined) || getErrorMessage(error)}`);
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Deleting project from Motion API', {
        method: 'deleteProject',
        projectId
      });

      await this.requestWithRetry(() => this.client.delete(`/projects/${projectId}`));
      
      // Invalidate all project caches since we don't know the workspace ID
      this.projectCache.invalidate();
      
      mcpLog(LOG_LEVELS.INFO, 'Project deleted successfully', {
        method: 'deleteProject',
        projectId
      });
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to delete project', {
        method: 'deleteProject',
        projectId,
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
      });
      throw new Error(`Failed to delete project: ${(isAxiosError(error) ? error.response?.data?.message : undefined) || getErrorMessage(error)}`);
    }
  }

  async getTasks(workspaceId: string, projectId?: string): Promise<MotionTask[]> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching tasks from Motion API', {
        method: 'getTasks',
        workspaceId,
        projectId
      });

      const params = new URLSearchParams();
      params.append('workspaceId', workspaceId);
      if (projectId) {
        params.append('projectId', projectId);
      }

      const queryString = params.toString();
      const url = queryString ? `/tasks?${queryString}` : '/tasks';
      
      const response: AxiosResponse<ListResponse<MotionTask>> = await this.requestWithRetry(() => this.client.get(url));
      
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
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch tasks', {
        method: 'getTasks',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
      });
      throw new Error(`Failed to fetch tasks: ${(isAxiosError(error) ? error.response?.data?.message : undefined) || getErrorMessage(error)}`);
    }
  }

  async getTask(taskId: string): Promise<MotionTask> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching single task from Motion API', {
        method: 'getTask',
        taskId
      });

      const response: AxiosResponse<MotionTask> = await this.requestWithRetry(() => this.client.get(`/tasks/${taskId}`));

      mcpLog(LOG_LEVELS.INFO, 'Successfully fetched task', {
        method: 'getTask',
        taskId,
        taskName: response.data.name
      });

      return response.data;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch task', {
        method: 'getTask',
        taskId,
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
      });
      throw new Error(`Failed to fetch task: ${(isAxiosError(error) ? error.response?.data?.message : undefined) || getErrorMessage(error)}`);
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

      // Convert undefined to null for API compatibility
      const apiData = convertUndefinedToNull(taskData);
      const response: AxiosResponse<MotionTask> = await this.requestWithRetry(() => this.client.post('/tasks', apiData));
      
      // Invalidate task-related caches after successful creation
      // Note: Task cache would need to be implemented separately if needed
      
      mcpLog(LOG_LEVELS.INFO, 'Task created successfully', {
        method: 'createTask',
        taskId: response.data.id,
        taskName: response.data.name
      });

      return response.data;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to create task', {
        method: 'createTask',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
      });
      throw new Error(`Failed to create task: ${(isAxiosError(error) ? error.response?.data?.message : undefined) || getErrorMessage(error)}`);
    }
  }

  async updateTask(taskId: string, updates: Partial<MotionTask>): Promise<MotionTask> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Updating task in Motion API', {
        method: 'updateTask',
        taskId,
        updates: Object.keys(updates)
      });

      // Convert undefined to null for API compatibility
      const apiUpdates = convertUndefinedToNull(updates);
      const response: AxiosResponse<MotionTask> = await this.requestWithRetry(() => this.client.patch(`/tasks/${taskId}`, apiUpdates));
      
      mcpLog(LOG_LEVELS.INFO, 'Task updated successfully', {
        method: 'updateTask',
        taskId,
        taskName: response.data.name
      });

      return response.data;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to update task', {
        method: 'updateTask',
        taskId,
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
      });
      throw new Error(`Failed to update task: ${(isAxiosError(error) ? error.response?.data?.message : undefined) || getErrorMessage(error)}`);
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Deleting task from Motion API', {
        method: 'deleteTask',
        taskId
      });

      await this.requestWithRetry(() => this.client.delete(`/tasks/${taskId}`));
      
      mcpLog(LOG_LEVELS.INFO, 'Task deleted successfully', {
        method: 'deleteTask',
        taskId
      });
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to delete task', {
        method: 'deleteTask',
        taskId,
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
      });
      throw new Error(`Failed to delete task: ${(isAxiosError(error) ? error.response?.data?.message : undefined) || getErrorMessage(error)}`);
    }
  }

  async getWorkspaces(): Promise<MotionWorkspace[]> {
    return this.workspaceCache.withCache('workspaces', async () => {
      try {
        mcpLog(LOG_LEVELS.DEBUG, 'Fetching workspaces from Motion API', {
          method: 'getWorkspaces'
        });

        const response: AxiosResponse = await this.requestWithRetry(() => this.client.get('/workspaces'));
        
        // Validate the response structure
        const validatedResponse = this.validateResponse(
          response.data,
          WorkspacesListResponseSchema,
          'getWorkspaces'
        );
        
        // Extract workspaces array (handle both wrapped and unwrapped responses)
        const workspaces = Array.isArray(validatedResponse)
          ? validatedResponse
          : validatedResponse.workspaces;
        
        mcpLog(LOG_LEVELS.INFO, 'Workspaces fetched and cached successfully', {
          method: 'getWorkspaces',
          count: workspaces.length,
          workspaceNames: workspaces.map((w: MotionWorkspace) => w.name)
        });

        return workspaces;
      } catch (error: unknown) {
        mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch workspaces', {
          method: 'getWorkspaces',
          error: getErrorMessage(error),
          apiStatus: isAxiosError(error) ? error.response?.status : undefined,
          apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
        });
        throw new Error(`Failed to fetch workspaces: ${(isAxiosError(error) ? error.response?.data?.message : undefined) || getErrorMessage(error)}`);
      }
    });
  }

  async getUsers(workspaceId?: string): Promise<MotionUser[]> {
    const cacheKey = workspaceId ? `users:workspace:${workspaceId}` : 'users:all';
    
    return this.userCache.withCache(cacheKey, async () => {
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
        
        const response: AxiosResponse<ListResponse<MotionUser>> = await this.requestWithRetry(() => this.client.get(url));
        
        // The Motion API might wrap the users in a 'users' array
        const usersData = response.data?.users || response.data || [];
        const users = Array.isArray(usersData) ? usersData : [];
        
        mcpLog(LOG_LEVELS.INFO, 'Users fetched successfully', {
          method: 'getUsers',
          count: users.length,
          workspaceId
        });

        return users;
      } catch (error: unknown) {
        mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch users', {
          method: 'getUsers',
          error: getErrorMessage(error),
          apiStatus: isAxiosError(error) ? error.response?.status : undefined,
          apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
        });
        throw new Error(`Failed to fetch users: ${(isAxiosError(error) ? error.response?.data?.message : undefined) || getErrorMessage(error)}`);
      }
    });
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
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to find project by name', {
        method: 'getProjectByName',
        projectName,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  async searchTasks(query: string, workspaceId: string): Promise<MotionTask[]> {
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
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to search tasks', {
        method: 'searchTasks',
        query,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  async searchProjects(query: string, workspaceId: string): Promise<MotionProject[]> {
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
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to search projects', {
        method: 'searchProjects',
        query,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }
}