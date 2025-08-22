import axios, { AxiosInstance, AxiosResponse, AxiosError, isAxiosError } from 'axios';
import { 
  MotionWorkspace, 
  MotionProject, 
  MotionTask, 
  MotionUser,
  MotionComment,
  CreateCommentData,
  MotionCustomField,
  CreateCustomFieldData,
  MotionRecurringTask,
  CreateRecurringTaskData,
  MotionSchedule,
  MotionStatus,
  ListResponse,
  MotionApiErrorResponse,
  MotionApiError,
  MotionPaginatedResponse
} from '../types/motion';
import { LOG_LEVELS, convertUndefinedToNull, RETRY_CONFIG, CACHE_TTL, CACHE_TTL_MS_MULTIPLIER, LIMITS } from '../utils/constants';
import { mcpLog } from '../utils/logger';
import { SimpleCache } from '../utils/cache';
import { fetchAllPages, PaginatedApiResponse } from '../utils/pagination';
import { z } from 'zod';
import { 
  ProjectsListResponseSchema,
  WorkspacesListResponseSchema,
  SchedulesListResponseSchema,
  StatusesListResponseSchema,
  VALIDATION_CONFIG
} from '../schemas/motion';

// Note: Using native axios.isAxiosError instead of custom implementation

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
  private commentCache: SimpleCache<MotionPaginatedResponse<MotionComment>>;
  private customFieldCache: SimpleCache<MotionCustomField[]>;
  private recurringTaskCache: SimpleCache<MotionRecurringTask[]>;
  private scheduleCache: SimpleCache<MotionSchedule[]>;
  private statusCache: SimpleCache<MotionStatus[]>;

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

    // Initialize cache instances with TTL from constants (converted to ms)
    this.workspaceCache = new SimpleCache(CACHE_TTL.WORKSPACES * CACHE_TTL_MS_MULTIPLIER);
    this.userCache = new SimpleCache(CACHE_TTL.USERS * CACHE_TTL_MS_MULTIPLIER);
    this.projectCache = new SimpleCache(CACHE_TTL.PROJECTS * CACHE_TTL_MS_MULTIPLIER);
    this.commentCache = new SimpleCache(CACHE_TTL.COMMENTS * CACHE_TTL_MS_MULTIPLIER);
    this.customFieldCache = new SimpleCache(CACHE_TTL.CUSTOM_FIELDS * CACHE_TTL_MS_MULTIPLIER);
    this.recurringTaskCache = new SimpleCache(CACHE_TTL.RECURRING_TASKS * CACHE_TTL_MS_MULTIPLIER);
    this.scheduleCache = new SimpleCache(CACHE_TTL.SCHEDULES * CACHE_TTL_MS_MULTIPLIER);
    this.statusCache = new SimpleCache(CACHE_TTL.WORKSPACES * CACHE_TTL_MS_MULTIPLIER); // 10 minutes, like workspaces

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
   * Formats API errors consistently across all methods
   * @param error - The error that occurred
   * @param action - Description of the action that failed (e.g., 'fetch projects')
   * @returns Formatted Error object
   */
  private formatApiError(error: unknown, action: string): Error {
    const baseMessage = `Failed to ${action}`;
    const apiMessage = isAxiosError(error) ? error.response?.data?.message : undefined;
    const errorMessage = getErrorMessage(error);
    return new Error(`${baseMessage}: ${apiMessage || errorMessage}`);
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

  async getProjects(workspaceId: string, maxPages: number = 5): Promise<MotionProject[]> {
    const cacheKey = `projects:workspace:${workspaceId}`;
    
    return this.projectCache.withCache(cacheKey, async () => {
      try {
        mcpLog(LOG_LEVELS.DEBUG, 'Fetching projects from Motion API', {
          method: 'getProjects',
          workspaceId,
          maxPages
        });

        // Create a fetch function for potential pagination
        const fetchPage = async (cursor?: string) => {
          const params = new URLSearchParams();
          params.append('workspaceId', workspaceId);
          if (cursor) {
            params.append('cursor', cursor);
          }

          const queryString = params.toString();
          const url = `/projects?${queryString}`;
          
          return this.requestWithRetry(() => this.client.get(url)) as Promise<AxiosResponse<PaginatedApiResponse<MotionProject>>>;
        };

        try {
          // Attempt pagination-aware fetch
          const paginatedResult = await fetchAllPages(fetchPage, { 
            maxPages,
            logProgress: false
          });
          
          if (paginatedResult.totalFetched > 0) {
            // Validate the response structure
            const validatedResponse = this.validateResponse(
              paginatedResult.items,
              ProjectsListResponseSchema,
              'getProjects'
            );
            
            // Extract projects array (handle both wrapped and unwrapped responses)
            const projects = Array.isArray(validatedResponse) 
              ? validatedResponse 
              : validatedResponse.projects;
            
            mcpLog(LOG_LEVELS.INFO, 'Projects fetched successfully with pagination', {
              method: 'getProjects',
              totalCount: projects.length,
              hasMore: paginatedResult.hasMore,
              workspaceId
            });

            return projects;
          }
        } catch (paginationError) {
          mcpLog(LOG_LEVELS.DEBUG, 'Pagination failed, falling back to simple fetch', {
            method: 'getProjects',
            error: paginationError instanceof Error ? paginationError.message : String(paginationError)
          });
        }

        // Fallback: simple single-page fetch
        const response: AxiosResponse = await fetchPage();
        
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
        
        mcpLog(LOG_LEVELS.INFO, 'Projects fetched successfully (single page)', {
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
        throw this.formatApiError(error, 'fetch projects');
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
      throw this.formatApiError(error, 'fetch project');
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
      throw this.formatApiError(error, 'create project');
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
      throw this.formatApiError(error, 'update project');
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
      throw this.formatApiError(error, 'delete project');
    }
  }

  async getTasks(workspaceId: string, projectId?: string, maxPages: number = 5, limit?: number): Promise<MotionTask[]> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching tasks from Motion API', {
        method: 'getTasks',
        workspaceId,
        projectId,
        maxPages
      });

      // Create a fetch function for potential pagination
      const fetchPage = async (cursor?: string) => {
        const params = new URLSearchParams();
        params.append('workspaceId', workspaceId);
        if (projectId) {
          params.append('projectId', projectId);
        }
        if (cursor) {
          params.append('cursor', cursor);
        }

        const queryString = params.toString();
        const url = queryString ? `/tasks?${queryString}` : '/tasks';
        
        return this.requestWithRetry(() => this.client.get(url)) as Promise<AxiosResponse<PaginatedApiResponse<MotionTask>>>;
      };

      try {
        // Attempt pagination-aware fetch
        const paginatedResult = await fetchAllPages(fetchPage, { 
          maxPages,
          logProgress: false  // Less verbose for tasks
        });
        
        if (paginatedResult.totalFetched > 0) {
          let tasks = paginatedResult.items;
          
          // Apply limit if specified
          if (limit && limit > 0) {
            tasks = tasks.slice(0, limit);
          }
          
          mcpLog(LOG_LEVELS.INFO, 'Tasks fetched successfully with pagination', {
            method: 'getTasks',
            totalCount: paginatedResult.totalFetched,
            returnedCount: tasks.length,
            hasMore: paginatedResult.hasMore,
            workspaceId,
            projectId,
            limitApplied: limit
          });
          return tasks;
        }
      } catch (paginationError) {
        // Fallback to simple fetch if pagination fails
        mcpLog(LOG_LEVELS.DEBUG, 'Pagination failed, falling back to simple fetch', {
          method: 'getTasks',
          error: paginationError instanceof Error ? paginationError.message : String(paginationError)
        });
      }

      // Fallback: simple single-page fetch
      const response: AxiosResponse<ListResponse<MotionTask>> = await fetchPage();
      const tasksData = response.data?.tasks || response.data || [];
      let tasks = Array.isArray(tasksData) ? tasksData : [];
      
      // Apply limit if specified
      if (limit && limit > 0) {
        tasks = tasks.slice(0, limit);
      }
      
      mcpLog(LOG_LEVELS.INFO, 'Tasks fetched successfully (single page)', {
        method: 'getTasks',
        count: tasks.length,
        workspaceId,
        projectId,
        limitApplied: limit
      });

      return tasks;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch tasks', {
        method: 'getTasks',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
      });
      throw this.formatApiError(error, 'fetch tasks');
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
      throw this.formatApiError(error, 'fetch task');
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
      throw this.formatApiError(error, 'create task');
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
      throw this.formatApiError(error, 'update task');
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
      throw this.formatApiError(error, 'delete task');
    }
  }

  async moveTask(taskId: string, targetProjectId?: string | null, targetWorkspaceId?: string | null): Promise<MotionTask> {
    try {
      if (!targetProjectId && !targetWorkspaceId) {
        throw new Error('Either targetProjectId or targetWorkspaceId must be provided');
      }
      
      mcpLog(LOG_LEVELS.DEBUG, 'Moving task in Motion API', {
        method: 'moveTask',
        taskId,
        targetProjectId,
        targetWorkspaceId
      });

      const moveData: { projectId?: string; workspaceId?: string } = {};
      if (targetProjectId) moveData.projectId = targetProjectId;
      if (targetWorkspaceId) moveData.workspaceId = targetWorkspaceId;
      
      const response: AxiosResponse<MotionTask> = await this.requestWithRetry(() => 
        this.client.patch(`/tasks/${taskId}/move`, moveData)
      );
      
      mcpLog(LOG_LEVELS.INFO, 'Task moved successfully', {
        method: 'moveTask',
        taskId,
        targetProjectId,
        targetWorkspaceId
      });

      // TODO: Invalidate task cache for source and destination projects/workspaces when implemented
      
      return response.data;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to move task', {
        method: 'moveTask',
        taskId,
        targetProjectId,
        targetWorkspaceId,
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
      });
      throw this.formatApiError(error, 'move task');
    }
  }

  async unassignTask(taskId: string): Promise<MotionTask> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Unassigning task in Motion API', {
        method: 'unassignTask',
        taskId
      });

      const response: AxiosResponse<MotionTask> = await this.requestWithRetry(() => 
        this.client.patch(`/tasks/${taskId}/unassign`)
      );
      
      mcpLog(LOG_LEVELS.INFO, 'Task unassigned successfully', {
        method: 'unassignTask',
        taskId
      });

      // TODO: Invalidate task cache for this task and any assignee-related caches when implemented
      
      return response.data;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to unassign task', {
        method: 'unassignTask',
        taskId,
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
      });
      throw this.formatApiError(error, 'unassign task');
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
        throw this.formatApiError(error, 'fetch workspaces');
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
        throw this.formatApiError(error, 'fetch users');
      }
    });
  }

  async getCurrentUser(): Promise<MotionUser> {
    const cacheKey = 'currentUser';
    
    // Use userCache but with a special single-user wrapper
    const cachedUsers = await this.userCache.withCache(cacheKey, async () => {
      try {
        mcpLog(LOG_LEVELS.DEBUG, 'Fetching current user from Motion API', {
          method: 'getCurrentUser'
        });

        const response: AxiosResponse<MotionUser> = await this.requestWithRetry(() => this.client.get('/users/me'));
        
        const user = response.data;
        
        mcpLog(LOG_LEVELS.INFO, 'Current user fetched successfully', {
          method: 'getCurrentUser',
          userId: user.id,
          email: user.email
        });

        return [user]; // Wrap in array for cache compatibility
      } catch (error: unknown) {
        mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch current user', {
          method: 'getCurrentUser',
          error: getErrorMessage(error),
          apiStatus: isAxiosError(error) ? error.response?.status : undefined,
          apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
        });
        throw this.formatApiError(error, 'fetch current user');
      }
    });
    
    return cachedUsers[0]; // Return just the user object
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

  async searchTasks(query: string, workspaceId: string, limit?: number): Promise<MotionTask[]> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Searching tasks', {
        method: 'searchTasks',
        query,
        workspaceId,
        limit
      });

      // Apply search limit to prevent resource exhaustion
      const effectiveLimit = limit || LIMITS.MAX_SEARCH_RESULTS;
      const tasks = await this.getTasks(workspaceId, undefined, LIMITS.MAX_PAGES, effectiveLimit);
      const lowerQuery = query.toLowerCase();
      
      const matchingTasks = tasks.filter(task => 
        task.name?.toLowerCase().includes(lowerQuery) ||
        task.description?.toLowerCase().includes(lowerQuery)
      ).slice(0, effectiveLimit); // Additional safety limit

      mcpLog(LOG_LEVELS.INFO, 'Task search completed', {
        method: 'searchTasks',
        query,
        resultsCount: matchingTasks.length,
        limit: effectiveLimit
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

  async searchProjects(query: string, workspaceId: string, limit?: number): Promise<MotionProject[]> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Searching projects', {
        method: 'searchProjects',
        query,
        workspaceId,
        limit
      });

      // Apply search limit to prevent resource exhaustion
      const effectiveLimit = limit || LIMITS.MAX_SEARCH_RESULTS;
      const projects = await this.getProjects(workspaceId, LIMITS.MAX_PAGES);
      const lowerQuery = query.toLowerCase();
      
      const matchingProjects = projects.filter(project => 
        project.name?.toLowerCase().includes(lowerQuery) ||
        project.description?.toLowerCase().includes(lowerQuery)
      ).slice(0, effectiveLimit); // Additional safety limit

      mcpLog(LOG_LEVELS.INFO, 'Project search completed', {
        method: 'searchProjects',
        query,
        resultsCount: matchingProjects.length,
        limit: effectiveLimit
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

  /**
   * Get comments for a task with proper pagination support
   * @param taskId Task ID to get comments for
   * @param cursor Optional cursor for pagination
   * @returns Paginated response with comments and metadata
   */
  async getComments(taskId: string, cursor?: string): Promise<MotionPaginatedResponse<MotionComment>> {
    const cacheParams = { taskId, cursor: cursor || null };
    const cacheKey = `comments:${JSON.stringify(cacheParams)}`;
    
    return this.commentCache.withCache(cacheKey, async () => {
      try {
        mcpLog(LOG_LEVELS.DEBUG, 'Fetching comments from Motion API', {
          method: 'getComments',
          taskId,
          cursor
        });

        const params = new URLSearchParams({ taskId });
        if (cursor) params.append('cursor', cursor);
        
        const response = await this.requestWithRetry(() => 
          this.client.get(`/comments?${params.toString()}`)
        );

        // The API response structure is { meta: {...}, comments: [...] }
        const { meta, comments } = response.data;
        
        mcpLog(LOG_LEVELS.INFO, 'Comments fetched successfully', {
          method: 'getComments',
          count: comments?.length || 0,
          hasMore: !!meta?.nextCursor,
          taskId
        });

        // Return in our standard paginated format
        return {
          data: comments || [],
          meta: {
            nextCursor: meta?.nextCursor,
            pageSize: meta?.pageSize || (comments?.length || 0)
          }
        };
      } catch (error: unknown) {
        mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch comments', {
          method: 'getComments',
          error: getErrorMessage(error),
          apiStatus: isAxiosError(error) ? error.response?.status : undefined,
          apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
          taskId,
          cursor
        });
        throw this.formatApiError(error, 'fetch comments');
      }
    });
  }

  async createComment(commentData: CreateCommentData): Promise<MotionComment> {
    try {
      // Validate that at least one target ID is provided
      if (!commentData.taskId && !commentData.projectId) {
        throw new Error('Either taskId or projectId must be supplied for comment creation');
      }

      mcpLog(LOG_LEVELS.DEBUG, 'Creating comment in Motion API', {
        method: 'createComment',
        taskId: commentData.taskId,
        projectId: commentData.projectId,
        contentLength: commentData.content?.length || 0
      });

      // Only include fields that are present (avoid sending null)
      const { content, taskId, projectId, authorId } = commentData;
      const apiData = {
        content,
        ...(taskId && { taskId }),
        ...(projectId && { projectId }),
        ...(authorId && { authorId })
      };
      const response: AxiosResponse<MotionComment> = await this.requestWithRetry(() => this.client.post('/comments', apiData));
      
      // Invalidate cache after successful creation
      const cacheParams = { taskId: commentData.taskId || null, projectId: commentData.projectId || null };
      const cacheKey = `comments:${JSON.stringify(cacheParams)}`;
      this.commentCache.invalidate(cacheKey); // Invalidate specific cache
      
      mcpLog(LOG_LEVELS.INFO, 'Comment created successfully', {
        method: 'createComment',
        commentId: response.data?.id,
        taskId: commentData.taskId,
        projectId: commentData.projectId
      });

      return response.data;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to create comment', {
        method: 'createComment',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
        taskId: commentData?.taskId,
        projectId: commentData?.projectId
      });
      throw this.formatApiError(error, 'create comment');
    }
  }

  /**
   * Fetch custom fields from Motion API
   * @param workspaceId - Required workspace ID to get custom fields for
   * @returns Array of custom fields
   */
  async getCustomFields(workspaceId: string): Promise<MotionCustomField[]> {
    const cacheKey = `custom-fields:${workspaceId}`;
    
    return this.customFieldCache.withCache(cacheKey, async () => {
      try {
        mcpLog(LOG_LEVELS.DEBUG, 'Fetching custom fields from Motion API', {
          method: 'getCustomFields',
          workspaceId
        });

        const url = `/beta/workspaces/${workspaceId}/custom-fields`;
        
        const response: AxiosResponse<MotionCustomField[]> = await this.requestWithRetry(() => this.client.get(url));
        
        // Beta API returns direct array, not wrapped
        const fieldsArray = response.data || [];
        
        mcpLog(LOG_LEVELS.INFO, 'Custom fields fetched successfully', {
          method: 'getCustomFields',
          count: fieldsArray.length,
          workspaceId
        });

        return fieldsArray;
      } catch (error: unknown) {
        mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch custom fields', {
          method: 'getCustomFields',
          error: getErrorMessage(error),
          apiStatus: isAxiosError(error) ? error.response?.status : undefined,
          apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
          workspaceId
        });
        throw this.formatApiError(error, 'fetch custom fields');
      }
    });
  }

  /**
   * Create a new custom field
   * @param workspaceId - Required workspace ID to create custom field in
   * @param fieldData - Data for creating the custom field
   * @returns The created custom field
   */
  async createCustomField(workspaceId: string, fieldData: CreateCustomFieldData): Promise<MotionCustomField> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Creating custom field in Motion API', {
        method: 'createCustomField',
        name: fieldData.name,
        field: fieldData.field,
        workspaceId
      });

      // Transform payload to match Motion API expectations
      // POST API expects 'type' in request, but returns 'field' in response
      const apiPayload = { 
        name: fieldData.name, 
        type: fieldData.field,  // Motion API POST expects 'type' property in request body
        ...(fieldData.metadata && { metadata: fieldData.metadata }) 
      };

      const response: AxiosResponse<MotionCustomField> = await this.requestWithRetry(() => 
        this.client.post(`/beta/workspaces/${workspaceId}/custom-fields`, apiPayload)
      );
      
      // Invalidate cache after successful creation
      this.customFieldCache.invalidate(`custom-fields:${workspaceId}`);
      
      mcpLog(LOG_LEVELS.INFO, 'Custom field created successfully', {
        method: 'createCustomField',
        fieldId: response.data?.id,
        name: fieldData.name,
        workspaceId
      });

      return response.data;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to create custom field', {
        method: 'createCustomField',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
        fieldName: fieldData?.name,
        workspaceId
      });
      throw this.formatApiError(error, 'create custom field');
    }
  }

  /**
   * Delete a custom field
   * @param workspaceId - Required workspace ID containing the custom field
   * @param fieldId - ID of the custom field to delete
   * @returns Success indicator
   */
  async deleteCustomField(workspaceId: string, fieldId: string): Promise<{ success: boolean }> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Deleting custom field from Motion API', {
        method: 'deleteCustomField',
        fieldId,
        workspaceId
      });

      await this.requestWithRetry(() => 
        this.client.delete(`/beta/workspaces/${workspaceId}/custom-fields/${fieldId}`)
      );
      
      // Invalidate cache after successful deletion
      this.customFieldCache.invalidate(`custom-fields:${workspaceId}`);
      
      mcpLog(LOG_LEVELS.INFO, 'Custom field deleted successfully', {
        method: 'deleteCustomField',
        fieldId,
        workspaceId
      });

      return { success: true };
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to delete custom field', {
        method: 'deleteCustomField',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
        fieldId,
        workspaceId
      });
      throw this.formatApiError(error, 'delete custom field');
    }
  }

  /**
   * Add a custom field to a project
   * @param projectId - ID of the project
   * @param fieldId - ID of the custom field
   * @param value - Optional value for the field
   * @returns Updated project data
   */
  async addCustomFieldToProject(projectId: string, fieldId: string, value?: string | number | boolean | string[] | null): Promise<MotionProject> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Adding custom field to project', {
        method: 'addCustomFieldToProject',
        projectId,
        fieldId,
        hasValue: value !== undefined
      });

      const requestData = {
        fieldId,
        ...(value !== undefined && { value })
      };

      const response: AxiosResponse<MotionProject> = await this.requestWithRetry(() => 
        this.client.post(`/projects/${projectId}/custom-fields`, requestData)
      );
      
      // Invalidate project cache for specific workspace if available
      if (response.data?.workspaceId) {
        this.projectCache.invalidate(`projects:workspace:${response.data.workspaceId}`);
      } else {
        // Fallback to broader invalidation if workspace unknown
        this.projectCache.invalidate(`projects:`);
      }
      
      mcpLog(LOG_LEVELS.INFO, 'Custom field added to project successfully', {
        method: 'addCustomFieldToProject',
        projectId,
        fieldId
      });

      return response.data;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to add custom field to project', {
        method: 'addCustomFieldToProject',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
        projectId,
        fieldId
      });
      throw this.formatApiError(error, 'add custom field to project');
    }
  }

  /**
   * Remove a custom field from a project
   * @param projectId - ID of the project
   * @param fieldId - ID of the custom field
   * @returns Success indicator
   */
  async removeCustomFieldFromProject(projectId: string, fieldId: string): Promise<{ success: boolean }> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Removing custom field from project', {
        method: 'removeCustomFieldFromProject',
        projectId,
        fieldId
      });

      await this.requestWithRetry(() => 
        this.client.delete(`/projects/${projectId}/custom-fields/${fieldId}`)
      );
      
      // TODO: Invalidate project cache for specific workspace when project data is available
      // For now, invalidate all project caches
      this.projectCache.invalidate(`projects:`);
      
      mcpLog(LOG_LEVELS.INFO, 'Custom field removed from project successfully', {
        method: 'removeCustomFieldFromProject',
        projectId,
        fieldId
      });

      return { success: true };
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to remove custom field from project', {
        method: 'removeCustomFieldFromProject',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
        projectId,
        fieldId
      });
      throw this.formatApiError(error, 'remove custom field from project');
    }
  }

  /**
   * Add a custom field to a task
   * @param taskId - ID of the task
   * @param fieldId - ID of the custom field
   * @param value - Optional value for the field
   * @returns Updated task data
   */
  async addCustomFieldToTask(taskId: string, fieldId: string, value?: string | number | boolean | string[] | null): Promise<MotionTask> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Adding custom field to task', {
        method: 'addCustomFieldToTask',
        taskId,
        fieldId,
        hasValue: value !== undefined
      });

      const requestData = {
        fieldId,
        ...(value !== undefined && { value })
      };

      const response: AxiosResponse<MotionTask> = await this.requestWithRetry(() => 
        this.client.post(`/tasks/${taskId}/custom-fields`, requestData)
      );
      
      // TODO: Invalidate task cache when implemented
      // if (response.data?.workspaceId) {
      //   this.taskCache.invalidate(`tasks:workspace:${response.data.workspaceId}`);
      // }
      
      mcpLog(LOG_LEVELS.INFO, 'Custom field added to task successfully', {
        method: 'addCustomFieldToTask',
        taskId,
        fieldId
      });

      return response.data;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to add custom field to task', {
        method: 'addCustomFieldToTask',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
        taskId,
        fieldId
      });
      throw this.formatApiError(error, 'add custom field to task');
    }
  }

  /**
   * Remove a custom field from a task
   * @param taskId - ID of the task
   * @param fieldId - ID of the custom field
   * @returns Success indicator
   */
  async removeCustomFieldFromTask(taskId: string, fieldId: string): Promise<{ success: boolean }> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Removing custom field from task', {
        method: 'removeCustomFieldFromTask',
        taskId,
        fieldId
      });

      await this.requestWithRetry(() => 
        this.client.delete(`/tasks/${taskId}/custom-fields/${fieldId}`)
      );
      
      // TODO: Invalidate task cache when implemented
      // this.taskCache.invalidate(`tasks:`);
      
      mcpLog(LOG_LEVELS.INFO, 'Custom field removed from task successfully', {
        method: 'removeCustomFieldFromTask',
        taskId,
        fieldId
      });

      return { success: true };
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to remove custom field from task', {
        method: 'removeCustomFieldFromTask',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
        taskId,
        fieldId
      });
      throw this.formatApiError(error, 'remove custom field from task');
    }
  }

  /**
   * Fetch recurring tasks from Motion API with automatic pagination
   * @param workspaceId - Optional workspace ID to filter recurring tasks
   * @param maxPages - Maximum number of pages to fetch (default: 10)
   * @returns Array of recurring tasks from all pages
   */
  async getRecurringTasks(workspaceId?: string, maxPages: number = 10): Promise<MotionRecurringTask[]> {
    const cacheKey = workspaceId ? `recurring-tasks:workspace:${workspaceId}` : 'recurring-tasks:all';
    
    return this.recurringTaskCache.withCache(cacheKey, async () => {
      try {
        mcpLog(LOG_LEVELS.DEBUG, 'Fetching recurring tasks from Motion API with pagination', {
          method: 'getRecurringTasks',
          workspaceId,
          maxPages
        });

        // Create a fetch function for pagination utility
        const fetchPage = async (cursor?: string) => {
          const params = new URLSearchParams();
          if (workspaceId) params.append('workspaceId', workspaceId);
          if (cursor) params.append('cursor', cursor);
          
          const queryString = params.toString();
          const url = queryString ? `/recurring-tasks?${queryString}` : '/recurring-tasks';
          
          return this.requestWithRetry(() => this.client.get(url)) as Promise<AxiosResponse<PaginatedApiResponse<MotionRecurringTask>>>;
        };

        // Use pagination utility to fetch all pages
        const paginatedResult = await fetchAllPages(fetchPage, { 
          maxPages, 
          logProgress: true 
        });
        
        mcpLog(LOG_LEVELS.INFO, 'Recurring tasks fetched successfully with pagination', {
          method: 'getRecurringTasks',
          totalCount: paginatedResult.totalFetched,
          pagesProcessed: Math.ceil(paginatedResult.totalFetched / 50), // Assuming ~50 items per page
          hasMore: paginatedResult.hasMore,
          workspaceId
        });

        return paginatedResult.items;
      } catch (error: unknown) {
        mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch recurring tasks', {
          method: 'getRecurringTasks',
          error: getErrorMessage(error),
          apiStatus: isAxiosError(error) ? error.response?.status : undefined,
          apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
          workspaceId
        });
        throw this.formatApiError(error, 'fetch recurring tasks');
      }
    });
  }

  /**
   * Create a new recurring task
   * @param taskData - Data for creating the recurring task
   * @returns The created recurring task
   */
  async createRecurringTask(taskData: CreateRecurringTaskData): Promise<MotionRecurringTask> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Creating recurring task in Motion API', {
        method: 'createRecurringTask',
        name: taskData.name,
        assigneeId: taskData.assigneeId,
        frequency: taskData.frequency.type,
        workspaceId: taskData.workspaceId
      });

      // Convert undefined to null for API compatibility
      const apiData = convertUndefinedToNull(taskData);
      const response: AxiosResponse<MotionRecurringTask> = await this.requestWithRetry(() => 
        this.client.post('/recurring-tasks', apiData)
      );
      
      // Invalidate cache after successful creation
      this.recurringTaskCache.invalidate('recurring-tasks:');
      
      mcpLog(LOG_LEVELS.INFO, 'Recurring task created successfully', {
        method: 'createRecurringTask',
        taskId: response.data?.id,
        name: taskData.name
      });

      return response.data;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to create recurring task', {
        method: 'createRecurringTask',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
        taskName: taskData?.name
      });
      throw this.formatApiError(error, 'create recurring task');
    }
  }

  /**
   * Delete a recurring task
   * @param recurringTaskId - ID of the recurring task to delete
   * @returns Success indicator
   */
  async deleteRecurringTask(recurringTaskId: string): Promise<{ success: boolean }> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Deleting recurring task from Motion API', {
        method: 'deleteRecurringTask',
        recurringTaskId
      });

      await this.requestWithRetry(() => 
        this.client.delete(`/recurring-tasks/${recurringTaskId}`)
      );
      
      // Invalidate cache after successful deletion
      this.recurringTaskCache.invalidate('recurring-tasks:');
      
      mcpLog(LOG_LEVELS.INFO, 'Recurring task deleted successfully', {
        method: 'deleteRecurringTask',
        recurringTaskId
      });

      return { success: true };
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to delete recurring task', {
        method: 'deleteRecurringTask',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
        recurringTaskId
      });
      throw this.formatApiError(error, 'delete recurring task');
    }
  }

  /**
   * Fetch schedules from Motion API
   * @param userId - Optional user ID to filter schedules
   * @param startDate - Optional start date (ISO 8601) to filter schedules
   * @param endDate - Optional end date (ISO 8601) to filter schedules
   * @returns Array of schedules
   */
  async getSchedules(userId?: string, startDate?: string, endDate?: string): Promise<MotionSchedule[]> {
    // Use JSON.stringify for deterministic cache key generation to avoid collisions
    const cacheParams = { userId: userId || null, startDate: startDate || null, endDate: endDate || null };
    const cacheKey = `schedules:${JSON.stringify(cacheParams)}`;
    
    return this.scheduleCache.withCache(cacheKey, async () => {
      try {
        mcpLog(LOG_LEVELS.DEBUG, 'Fetching schedules from Motion API', {
          method: 'getSchedules',
          userId,
          startDate,
          endDate
        });

        const params = new URLSearchParams();
        if (userId) params.append('userId', userId);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        
        const queryString = params.toString();
        const url = queryString ? `/schedules?${queryString}` : '/schedules';
        
        const response: AxiosResponse<ListResponse<MotionSchedule>> = await this.requestWithRetry(() => this.client.get(url));
        
        // Validate response against schema
        const validatedResponse = this.validateResponse(
          response.data,
          SchedulesListResponseSchema,
          'getSchedules'
        );
        
        // Handle both wrapped and unwrapped responses
        const schedules = Array.isArray(validatedResponse) 
          ? validatedResponse 
          : validatedResponse.schedules || [];
        const schedulesArray = Array.isArray(schedules) ? schedules : [];
        
        mcpLog(LOG_LEVELS.INFO, 'Schedules fetched successfully', {
          method: 'getSchedules',
          count: schedulesArray.length,
          userId,
          startDate,
          endDate
        });

        return schedulesArray;
      } catch (error: unknown) {
        mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch schedules', {
          method: 'getSchedules',
          error: getErrorMessage(error),
          apiStatus: isAxiosError(error) ? error.response?.status : undefined,
          apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
          userId,
          startDate,
          endDate
        });
        throw this.formatApiError(error, 'fetch schedules');
      }
    });
  }

  /**
   * Retrieves available workflow statuses from Motion
   * @param workspaceId - Optional workspace ID to filter statuses
   * @returns Promise resolving to array of Motion statuses
   * @throws {Error} If the API request fails
   */
  async getStatuses(workspaceId?: string): Promise<MotionStatus[]> {
    // Use workspace ID for cache key, or 'all' if not specified
    const cacheKey = workspaceId ? `statuses:workspace:${workspaceId}` : 'statuses:all';
    
    return this.statusCache.withCache(cacheKey, async () => {
      try {
        mcpLog(LOG_LEVELS.DEBUG, 'Fetching statuses from Motion API', {
          method: 'getStatuses',
          workspaceId
        });

        const params = new URLSearchParams();
        if (workspaceId) params.append('workspaceId', workspaceId);
        
        const queryString = params.toString();
        const url = queryString ? `/statuses?${queryString}` : '/statuses';
        
        const response = await this.requestWithRetry(() => this.client.get(url));
        
        // Validate response against schema
        const validatedResponse = this.validateResponse(
          response.data,
          StatusesListResponseSchema,
          'statuses'
        );
        
        // Extract statuses from validated response
        const statuses = Array.isArray(validatedResponse) 
          ? validatedResponse 
          : ('statuses' in validatedResponse && Array.isArray(validatedResponse.statuses))
            ? validatedResponse.statuses
            : [];
        
        mcpLog(LOG_LEVELS.INFO, 'Statuses fetched successfully', {
          method: 'getStatuses',
          count: statuses.length,
          workspaceId
        });

        return statuses;
      } catch (error: unknown) {
        mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch statuses', {
          method: 'getStatuses',
          error: getErrorMessage(error),
          apiStatus: isAxiosError(error) ? error.response?.status : undefined,
          apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
          workspaceId
        });
        throw this.formatApiError(error, 'fetch statuses');
      }
    });
  }
}