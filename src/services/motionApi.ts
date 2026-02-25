import { AxiosResponse, isAxiosError } from 'axios';
import {
  MotionWorkspace,
  MotionProject,
  MotionTask,
  MotionTaskCreateData,
  MotionTaskUpdateData,
  MotionUser,
  MotionComment,
  CreateCommentData,
  MotionCustomField,
  MotionCustomFieldValue,
  CreateCustomFieldData,
  MotionRecurringTask,
  CreateRecurringTaskData,
  MotionSchedule,
  MotionStatus,
  MotionPaginatedResponse
} from '../types/motion';
import { LOG_LEVELS, createMinimalPayload, LIMITS, ValidPriority } from '../utils/constants';
import { SimpleCache } from '../utils/cache';
import { mcpLog } from '../utils/logger';
import { fetchAllPages as fetchAllPagesNew, calculateAdaptiveFetchLimit } from '../utils/paginationNew';
import { unwrapApiResponse } from '../utils/responseWrapper';
import { TruncationInfo, ListResult } from '../types/mcp';
import { ApiClient, getErrorMessage } from './api/ApiClient';
import { CacheManager } from './api/CacheManager';
import type { IApiClient, ResourceContext } from './api/types';
import { getStatuses as _getStatuses } from './api/statuses';
import { getSchedules as _getSchedules, getAvailableScheduleNames as _getAvailableScheduleNames } from './api/schedules';
import { getComments as _getComments, createComment as _createComment } from './api/comments';
import { getWorkspaces as _getWorkspaces } from './api/workspaces';
import { getUsers as _getUsers, getCurrentUser as _getCurrentUser } from './api/users';
import { getRecurringTasks as _getRecurringTasks, createRecurringTask as _createRecurringTask, deleteRecurringTask as _deleteRecurringTask } from './api/recurringTasks';

interface GetTasksOptions {
  workspaceId?: string;
  projectId?: string;
  name?: string;
  status?: string | string[];
  includeAllStatuses?: boolean;
  assigneeId?: string;
  priority?: ValidPriority;
  dueDate?: string;
  labels?: string[];
  limit?: number;
  maxPages?: number;
}

interface ResolveUserIdentifierOptions {
  strictWorkspace?: boolean;
}

export class MotionApiService {
  private _api: IApiClient;
  private _cache: CacheManager;
  private client: InstanceType<typeof import('axios').default.Axios>;
  // Remaining cache aliases — removed as modules are extracted
  private projectCache: SimpleCache<MotionProject[]>;
  private singleProjectCache: SimpleCache<MotionProject>;
  private customFieldCache: SimpleCache<MotionCustomField[]>;

  constructor(apiKey?: string) {
    this._api = new ApiClient(apiKey);
    this._cache = new CacheManager();
    this.client = this._api.client;

    // Aliases for caches still used directly by un-extracted methods
    this.projectCache = this._cache.project;
    this.singleProjectCache = this._cache.singleProject;
    this.customFieldCache = this._cache.customField;
  }

  /** ResourceContext for delegating to extracted resource modules. */
  private get _ctx(): ResourceContext {
    return { api: this._api, cache: this._cache };
  }

  private formatApiError(
    error: unknown,
    action: string,
    resourceType?: 'task' | 'project' | 'workspace' | 'user' | 'comment' | 'custom field' | 'recurring task' | 'schedule' | 'status',
    resourceId?: string,
    resourceName?: string
  ) {
    return this._api.formatApiError(error, action, resourceType, resourceId, resourceName);
  }

  private async requestWithRetry<T>(request: () => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T>> {
    return this._api.requestWithRetry(request);
  }

  private mergeTruncationMetadata(
    aggregate: TruncationInfo | undefined,
    source: TruncationInfo | undefined
  ): TruncationInfo | undefined {
    return this._api.mergeTruncationMetadata(aggregate, source);
  }

  // validateResponse removed — accessed via _ctx.api.validateResponse in extracted modules

  // ========================================
  // PROJECT API METHODS
  // ========================================

  async getProjects(workspaceId: string, options?: { maxPages?: number; limit?: number }): Promise<ListResult<MotionProject>> {
    const { maxPages = 5, limit } = options || {};

    // Validate limit parameter if provided
    if (limit !== undefined && (limit < 0 || !Number.isInteger(limit))) {
      throw new Error('limit must be a non-negative integer');
    }

    const cacheKey = `projects:workspace:${workspaceId}:maxPages:${maxPages ?? 'default'}:limit:${limit ?? 'none'}`;

    // Check cache - return items only (no stale truncation info)
    const cachedItems = this.projectCache.get(cacheKey);
    if (cachedItems !== null) {
      return { items: cachedItems };
    }

    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching projects from Motion API', {
        method: 'getProjects',
        workspaceId,
        maxPages,
        limit
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

        return this.requestWithRetry(() => this.client.get(url));
      };

      try {
        // Attempt pagination-aware fetch with new response wrapper
        const paginatedResult = await fetchAllPagesNew<MotionProject>(fetchPage, 'projects', {
          maxPages,
          logProgress: false,
          ...(limit ? { maxItems: limit } : {})
        });

        const projects = paginatedResult.items;

        mcpLog(LOG_LEVELS.INFO, 'Projects fetched successfully with pagination', {
          method: 'getProjects',
          totalCount: projects.length,
          hasMore: paginatedResult.hasMore,
          workspaceId
        });

        // Cache only items, not truncation metadata
        this.projectCache.set(cacheKey, projects);
        return { items: projects, truncation: paginatedResult.truncation };
      } catch (paginationError) {
        mcpLog(LOG_LEVELS.DEBUG, 'Pagination failed, falling back to simple fetch', {
          method: 'getProjects',
          error: paginationError instanceof Error ? paginationError.message : String(paginationError)
        });
      }

      // Use new response wrapper for single page fallback
      const response = await fetchPage();
      const unwrapped = unwrapApiResponse<MotionProject>(response.data, 'projects');
      let projects = unwrapped.data;

      mcpLog(LOG_LEVELS.INFO, 'Projects fetched successfully (single page)', {
        method: 'getProjects',
        count: projects.length,
        workspaceId
      });

      // Do not cache fallback results. If pagination failed, this may be only the first page.
      return { items: projects };
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch projects', {
        method: 'getProjects',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
      });
      throw this.formatApiError(error, 'fetch', 'project');
    }
  }

  async getAllProjects(): Promise<ListResult<MotionProject>> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching projects from all workspaces', {
        method: 'getAllProjects'
      });

      const allWorkspaces = await this.getWorkspaces();
      const allProjects: MotionProject[] = [];
      let aggregateTruncation: TruncationInfo | undefined;

      for (const workspace of allWorkspaces) {
        try {
          const { items, truncation } = await this.getProjects(workspace.id);
          allProjects.push(...items);
          aggregateTruncation = this.mergeTruncationMetadata(aggregateTruncation, truncation);
        } catch (workspaceError: unknown) {
          // Log error but continue with other workspaces
          mcpLog(LOG_LEVELS.WARN, 'Failed to fetch projects from workspace', {
            method: 'getAllProjects',
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            error: getErrorMessage(workspaceError)
          });
        }
      }

      mcpLog(LOG_LEVELS.INFO, 'All projects fetched successfully', {
        method: 'getAllProjects',
        totalProjects: allProjects.length,
        workspaceCount: allWorkspaces.length
      });

      if (aggregateTruncation) {
        aggregateTruncation.returnedCount = allProjects.length;
      }
      return { items: allProjects, truncation: aggregateTruncation };
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch projects from all workspaces', {
        method: 'getAllProjects',
        error: getErrorMessage(error)
      });
      throw this.formatApiError(error, 'fetch', 'project');
    }
  }

  async getProject(projectId: string): Promise<MotionProject> {
    const cacheKey = `project:${projectId}`;

    return this.singleProjectCache.withCache(cacheKey, async () => {
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
        throw this.formatApiError(error, 'fetch', 'project', projectId);
      }
    });
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

      // Create minimal payload by removing empty/null values to avoid validation errors
      const minimalPayload = createMinimalPayload(projectData);

      // Debug logging: log the exact payload being sent to API
      mcpLog(LOG_LEVELS.DEBUG, 'API payload for project creation', {
        method: 'createProject',
        payload: JSON.stringify(minimalPayload, null, 2)
      });

      const response: AxiosResponse<MotionProject> = await this.requestWithRetry(() => this.client.post('/projects', minimalPayload));
      
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
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
        fullErrorResponse: isAxiosError(error) ? JSON.stringify(error.response?.data, null, 2) : undefined
      });
      throw this.formatApiError(error, 'create', 'project', undefined, projectData.name);
    }
  }

  // Note: Project update/delete are not in the public API docs but appear to be functional
  async updateProject(projectId: string, updates: Partial<MotionProject>): Promise<MotionProject> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Updating project in Motion API', {
        method: 'updateProject',
        projectId,
        updates: Object.keys(updates)
      });

      // Create minimal payload by removing empty/null values to avoid validation errors
      const minimalUpdates = createMinimalPayload(updates);
      const response: AxiosResponse<MotionProject> = await this.requestWithRetry(() => this.client.patch(`/projects/${projectId}`, minimalUpdates));
      
      // Invalidate cache after successful update
      this.projectCache.invalidate(`projects:workspace:${response.data.workspaceId}`);
      this.singleProjectCache.invalidate(`project:${projectId}`);
      
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
      throw this.formatApiError(error, 'update', 'project', projectId);
    }
  }

  // Note: Project delete is not in the public API docs but appears to be functional
  async deleteProject(projectId: string): Promise<void> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Deleting project from Motion API', {
        method: 'deleteProject',
        projectId
      });

      await this.requestWithRetry(() => this.client.delete(`/projects/${projectId}`));
      
      // Invalidate all project caches since we don't know the workspace ID
      this.projectCache.invalidate();
      this.singleProjectCache.invalidate(`project:${projectId}`);
      
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
      throw this.formatApiError(error, 'delete', 'project', projectId);
    }
  }

  // ========================================
  // TASK API METHODS
  // ========================================

  async getTasks(options: GetTasksOptions): Promise<ListResult<MotionTask>> {
    const {
      workspaceId,
      projectId,
      name,
      status,
      includeAllStatuses,
      assigneeId,
      priority,
      dueDate,
      labels,
      limit,
      maxPages = 5
    } = options;

    // Validate limit parameter if provided
    if (limit !== undefined && (limit < 0 || !Number.isInteger(limit))) {
      throw new Error('limit must be a non-negative integer');
    }

    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching tasks from Motion API', {
        method: 'getTasks',
        workspaceId,
        projectId,
        status,
        includeAllStatuses,
        assigneeId,
        priority,
        dueDate,
        labelsCount: labels?.length,
        maxPages
      });

      // Client-side filters for params not supported by the API
      const applyClientFilters = (tasks: MotionTask[]): MotionTask[] => {
        let filtered = tasks;
        if (priority) {
          filtered = filtered.filter(t => t.priority === priority);
        }
        if (dueDate) {
          // Compare date portion only (YYYY-MM-DD)
          filtered = filtered.filter(t => {
            if (!t.dueDate) return false;
            const taskDate = t.dueDate.substring(0, 10);
            return taskDate <= dueDate;
          });
        }
        return filtered;
      };

      // Create a fetch function for potential pagination
      const fetchPage = async (cursor?: string) => {
        const params = new URLSearchParams();
        if (workspaceId) {
          params.append('workspaceId', workspaceId);
        }
        if (projectId) {
          params.append('projectId', projectId);
        }
        if (status) {
          if (Array.isArray(status)) {
            // Deduplicate and skip empty strings before appending
            // Note: Motion API supports repeated status= params for multi-value filtering
            const uniqueStatuses = Array.from(new Set(status));
            for (const s of uniqueStatuses) {
              if (s) {
                params.append('status', s);
              }
            }
          } else {
            params.append('status', status);
          }
        }
        if (includeAllStatuses) {
          params.append('includeAllStatuses', 'true');
        }
        if (assigneeId) {
          params.append('assigneeId', assigneeId);
        }
        // Note: priority and dueDate are NOT valid API query params — filtered client-side after fetch
        if (name) {
          params.append('name', name);
        }
        if (labels && labels.length > 0) {
          // API accepts 'label' (singular) as a string parameter
          for (const label of labels) {
            if (label) {
              params.append('label', label);
            }
          }
        }
        if (cursor) {
          params.append('cursor', cursor);
        }

        const queryString = params.toString();
        const url = queryString ? `/tasks?${queryString}` : '/tasks';
        
        return this.requestWithRetry(() => this.client.get(url));
      };

      try {
        // When client-side filters are active, don't cap pagination with maxItems
        // because valid matches may exist beyond the first batch. Fetch all pages
        // and apply the limit after filtering instead.
        const hasClientFilters = Boolean(priority || dueDate);
        const paginatedResult = await fetchAllPagesNew<MotionTask>(fetchPage, 'tasks', {
          maxPages,
          logProgress: false,  // Less verbose for tasks
          ...(!hasClientFilters && limit ? { maxItems: limit } : {})
        });

        let filteredItems = applyClientFilters(paginatedResult.items);
        let truncation = paginatedResult.truncation;

        // When client-side filters reduced the result set and pagination was also truncated,
        // update the truncation info so the notice accurately reflects what the user sees
        if (hasClientFilters && filteredItems.length < paginatedResult.items.length && truncation?.wasTruncated) {
          truncation = {
            ...truncation,
            clientFiltered: true,
            fetchedCount: paginatedResult.items.length,
            returnedCount: filteredItems.length,
          };
        }

        // Apply limit after client-side filtering
        if (hasClientFilters && limit && limit > 0 && filteredItems.length > limit) {
          truncation = {
            wasTruncated: true,
            returnedCount: limit,
            reason: 'max_items',
            limit,
          };
          filteredItems = filteredItems.slice(0, limit);
        }

        mcpLog(LOG_LEVELS.INFO, 'Tasks fetched successfully with pagination', {
          method: 'getTasks',
          totalCount: paginatedResult.totalFetched,
          returnedCount: filteredItems.length,
          clientFiltered: filteredItems.length !== paginatedResult.items.length,
          hasMore: paginatedResult.hasMore,
          workspaceId,
          projectId,
          limitApplied: limit
        });
        return { items: filteredItems, truncation };
      } catch (paginationError) {
        // Fallback to simple fetch if pagination fails
        mcpLog(LOG_LEVELS.DEBUG, 'Pagination failed, falling back to simple fetch', {
          method: 'getTasks',
          error: paginationError instanceof Error ? paginationError.message : String(paginationError)
        });
      }

      // Use new response wrapper for single page fallback
      const response = await fetchPage();
      const unwrapped = unwrapApiResponse<MotionTask>(response.data, 'tasks');
      let tasks = applyClientFilters(unwrapped.data);

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

      return { items: tasks };
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch tasks', {
        method: 'getTasks',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
      });
      throw this.formatApiError(error, 'fetch', 'task');
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
      throw this.formatApiError(error, 'fetch', 'task', taskId);
    }
  }

  async createTask(taskData: MotionTaskCreateData): Promise<MotionTask> {
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

      // Create minimal payload by removing empty/null values to avoid validation errors
      const minimalPayload = createMinimalPayload(taskData);

      // Debug logging: log the exact payload being sent to API
      mcpLog(LOG_LEVELS.DEBUG, 'API payload for task creation', {
        method: 'createTask',
        payload: JSON.stringify(minimalPayload, null, 2)
      });

      const response: AxiosResponse<MotionTask> = await this.requestWithRetry(() => this.client.post('/tasks', minimalPayload));
      
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
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
        fullErrorResponse: isAxiosError(error) ? JSON.stringify(error.response?.data, null, 2) : undefined
      });
      throw this.formatApiError(error, 'create', 'task', undefined, taskData.name);
    }
  }

  // Note: API docs list name and workspaceId as required for PATCH /tasks/{id},
  // but the API appears to accept partial updates without them. Not enforced here.
  async updateTask(taskId: string, updates: MotionTaskUpdateData): Promise<MotionTask> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Updating task in Motion API', {
        method: 'updateTask',
        taskId,
        updates: Object.keys(updates)
      });

      // Create minimal payload by removing empty/null values to avoid validation errors
      const minimalUpdates = createMinimalPayload(updates);
      const response: AxiosResponse<MotionTask> = await this.requestWithRetry(() => this.client.patch(`/tasks/${taskId}`, minimalUpdates));
      
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
      throw this.formatApiError(error, 'update', 'task', taskId);
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
      throw this.formatApiError(error, 'delete', 'task', taskId);
    }
  }

  async moveTask(taskId: string, targetWorkspaceId: string, assigneeId?: string): Promise<MotionTask | undefined> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Moving task in Motion API', {
        method: 'moveTask',
        taskId,
        targetWorkspaceId,
        assigneeId
      });

      // API requires workspaceId, optionally accepts assigneeId
      const moveData: { workspaceId: string; assigneeId?: string } = {
        workspaceId: targetWorkspaceId,
      };
      if (assigneeId !== undefined) moveData.assigneeId = assigneeId;

      const response = await this.requestWithRetry(() =>
        this.client.patch(`/tasks/${taskId}/move`, moveData)
      );

      mcpLog(LOG_LEVELS.INFO, 'Task moved successfully', {
        method: 'moveTask',
        taskId,
        targetWorkspaceId,
        assigneeId
      });

      // Docs say 200 with task object, but handle 204 No Content defensively
      return response.status === 204 ? undefined : response.data;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to move task', {
        method: 'moveTask',
        taskId,
        targetWorkspaceId,
        assigneeId,
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
      });
      throw this.formatApiError(error, 'move', 'task', taskId);
    }
  }

  async unassignTask(taskId: string): Promise<MotionTask | undefined> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Unassigning task in Motion API', {
        method: 'unassignTask',
        taskId
      });

      const response = await this.requestWithRetry(() =>
        this.client.delete(`/tasks/${taskId}/assignee`)
      );

      mcpLog(LOG_LEVELS.INFO, 'Task unassigned successfully', {
        method: 'unassignTask',
        taskId
      });

      // Response undocumented — handle 204 No Content defensively
      return response.status === 204 ? undefined : response.data;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to unassign task', {
        method: 'unassignTask',
        taskId,
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
      });
      throw this.formatApiError(error, 'unassign', 'task', taskId);
    }
  }

  // ========================================
  // WORKSPACE API METHODS
  // ========================================

  async getWorkspaces(ids?: string[]): Promise<MotionWorkspace[]> {
    return _getWorkspaces(this._ctx, ids);
  }

  // ========================================
  // USER API METHODS
  // ========================================

  async getUsers(workspaceId?: string, teamId?: string): Promise<MotionUser[]> {
    return _getUsers(this._ctx, workspaceId, teamId);
  }

  async getCurrentUser(): Promise<MotionUser> {
    return _getCurrentUser(this._ctx);
  }

  // ========================================
  // SEARCH AND RESOLUTION METHODS
  // ========================================

  /**
   * Resolves a project identifier (either projectId or projectName) to a MotionProject
   * Searches across all workspaces if not found in the specified workspace
   * @param identifier Object containing either projectId or projectName
   * @param workspaceId Workspace to start searching in
   * @returns Resolved MotionProject with workspace info, or undefined if not found
   */
  async resolveProjectIdentifier(
    identifier: { projectId?: string; projectName?: string },
    workspaceId?: string
  ): Promise<MotionProject | undefined> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Resolving project identifier', {
        method: 'resolveProjectIdentifier',
        projectId: identifier.projectId,
        projectName: identifier.projectName,
        workspaceId
      });

      // If projectId is provided, try to get it directly
      if (identifier.projectId) {
        try {
          const project = await this.getProject(identifier.projectId);
          mcpLog(LOG_LEVELS.INFO, 'Project resolved by ID', {
            method: 'resolveProjectIdentifier',
            projectId: identifier.projectId,
            projectName: project.name,
            workspaceId: project.workspaceId
          });
          return project;
        } catch (error: unknown) {
          mcpLog(LOG_LEVELS.WARN, 'Failed to resolve project by ID', {
            method: 'resolveProjectIdentifier',
            projectId: identifier.projectId,
            error: getErrorMessage(error)
          });
          // Fall through to projectName resolution if projectId fails
        }
      }

      // If projectName is provided (or projectId failed), resolve by name across workspaces
      if (identifier.projectName) {
        const project = await this.getProjectByName(identifier.projectName, workspaceId);
        if (project) {
          mcpLog(LOG_LEVELS.INFO, 'Project resolved by name across workspaces', {
            method: 'resolveProjectIdentifier',
            projectName: identifier.projectName,
            projectId: project.id,
            foundInWorkspaceId: project.workspaceId
          });
          return project;
        }
      }

      mcpLog(LOG_LEVELS.WARN, 'Failed to resolve project identifier', {
        method: 'resolveProjectIdentifier',
        projectId: identifier.projectId,
        projectName: identifier.projectName,
        workspaceId
      });

      return undefined;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Error resolving project identifier', {
        method: 'resolveProjectIdentifier',
        projectId: identifier.projectId,
        projectName: identifier.projectName,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  /**
   * Resolves a user identifier (either userId or userName/email) to a MotionUser
   * Searches across all workspaces if not found in the specified workspace unless strictWorkspace is true
   * @param identifier Object containing either userId or userName
   * @param workspaceId Workspace to start searching in (optional)
   * @param options Resolution behavior options
   * @returns Resolved MotionUser with workspace info, or undefined if not found
   */
  async resolveUserIdentifier(
    identifier: { userId?: string; userName?: string },
    workspaceId?: string,
    options?: ResolveUserIdentifierOptions
  ): Promise<MotionUser | undefined> {
    try {
      const strictWorkspace = options?.strictWorkspace === true;
      mcpLog(LOG_LEVELS.DEBUG, 'Resolving user identifier', {
        method: 'resolveUserIdentifier',
        userId: identifier.userId,
        userName: identifier.userName,
        workspaceId,
        strictWorkspace
      });

      // Build ordered workspace IDs: specified workspace first (or only when strict).
      const allWorkspaces = await this.getWorkspaces();
      let orderedWorkspaceIds: string[];
      if (workspaceId) {
        if (strictWorkspace) {
          orderedWorkspaceIds = [workspaceId];
        } else {
          const allWorkspaceIds = allWorkspaces.map(workspace => workspace.id);
          if (allWorkspaceIds.includes(workspaceId)) {
            const otherWorkspaceIds = allWorkspaceIds.filter(id => id !== workspaceId);
            orderedWorkspaceIds = [workspaceId, ...otherWorkspaceIds];
          } else {
            // Keep prior behavior when workspaceId is unknown: search known workspaces.
            orderedWorkspaceIds = allWorkspaceIds;
          }
        }
      } else {
        orderedWorkspaceIds = allWorkspaces.map(workspace => workspace.id);
      }

      // If userId is provided, search by ID
      if (identifier.userId) {
        for (const searchWorkspaceId of orderedWorkspaceIds) {
          try {
            const users = await this.getUsers(searchWorkspaceId);
            const user = users.find(u => u.id === identifier.userId);
            if (user) {
              mcpLog(LOG_LEVELS.INFO, 'User resolved by ID', {
                method: 'resolveUserIdentifier',
                userId: identifier.userId,
                userName: user.name,
                foundInWorkspaceId: searchWorkspaceId
              });
              return user;
            }
          } catch (workspaceError: unknown) {
            mcpLog(LOG_LEVELS.WARN, 'Failed to search workspace for user by ID', {
              method: 'resolveUserIdentifier',
              userId: identifier.userId,
              workspaceId: searchWorkspaceId,
              error: getErrorMessage(workspaceError)
            });
          }
        }
      }

      // If userName is provided, search by name/email
      if (identifier.userName) {
        const searchTerm = identifier.userName.toLowerCase();

        for (const searchWorkspaceId of orderedWorkspaceIds) {
          try {
            const users = await this.getUsers(searchWorkspaceId);
            const user = users.find(u =>
              u.name?.toLowerCase().includes(searchTerm) ||
              u.email?.toLowerCase().includes(searchTerm)
            );
            if (user) {
              mcpLog(LOG_LEVELS.INFO, 'User resolved by name/email', {
                method: 'resolveUserIdentifier',
                userName: identifier.userName,
                userId: user.id,
                foundInWorkspaceId: searchWorkspaceId
              });
              return user;
            }
          } catch (workspaceError: unknown) {
            mcpLog(LOG_LEVELS.WARN, 'Failed to search workspace for user by name', {
              method: 'resolveUserIdentifier',
              userName: identifier.userName,
              workspaceId: searchWorkspaceId,
              error: getErrorMessage(workspaceError)
            });
          }
        }
      }

      mcpLog(LOG_LEVELS.WARN, 'Failed to resolve user identifier', {
        method: 'resolveUserIdentifier',
        userId: identifier.userId,
        userName: identifier.userName,
        workspaceId
      });

      return undefined;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Error resolving user identifier', {
        method: 'resolveUserIdentifier',
        userId: identifier.userId,
        userName: identifier.userName,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  async getProjectByName(projectName: string, workspaceId?: string): Promise<MotionProject | undefined> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Finding project by name', {
        method: 'getProjectByName',
        projectName,
        workspaceId
      });

      // First, search in the specified workspace (if provided)
      if (workspaceId) {
        const { items: projects } = await this.getProjects(workspaceId);
        const project = projects.find(p => p.name === projectName);

        if (project) {
          mcpLog(LOG_LEVELS.INFO, 'Project found by name in specified workspace', {
            method: 'getProjectByName',
            projectName,
            projectId: project.id,
            workspaceId
          });
          return project;
        }
      }

      // If not found in specified workspace (or none specified), search across all other workspaces
      mcpLog(LOG_LEVELS.DEBUG, 'Project not found in specified workspace, searching all workspaces', {
        method: 'getProjectByName',
        projectName,
        specifiedWorkspaceId: workspaceId
      });

      const allWorkspaces = await this.getWorkspaces();
      const otherWorkspaces = allWorkspaces.filter(w => w.id !== workspaceId);

      for (const workspace of otherWorkspaces) {
        try {
          mcpLog(LOG_LEVELS.DEBUG, 'Searching workspace for project', {
            method: 'getProjectByName',
            projectName,
            searchingWorkspaceId: workspace.id,
            searchingWorkspaceName: workspace.name
          });

          const { items: workspaceProjects } = await this.getProjects(workspace.id);
          const foundProject = workspaceProjects.find(p => p.name === projectName);

          if (foundProject) {
            mcpLog(LOG_LEVELS.WARN, 'Project found by name in different workspace', {
              method: 'getProjectByName',
              projectName,
              projectId: foundProject.id,
              foundInWorkspaceId: workspace.id,
              foundInWorkspaceName: workspace.name,
              originalWorkspaceId: workspaceId
            });
            return foundProject;
          }
        } catch (workspaceError: unknown) {
          // Log error but continue searching other workspaces
          mcpLog(LOG_LEVELS.WARN, 'Failed to search workspace for project', {
            method: 'getProjectByName',
            projectName,
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            error: getErrorMessage(workspaceError)
          });
        }
      }

      // Project not found in any workspace
      mcpLog(LOG_LEVELS.WARN, 'Project not found by name in any workspace', {
        method: 'getProjectByName',
        projectName,
        searchedWorkspaces: [workspaceId, ...otherWorkspaces.map(w => w.id)],
        totalWorkspacesSearched: allWorkspaces.length
      });

      return undefined;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to find project by name', {
        method: 'getProjectByName',
        projectName,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  async searchTasks(query: string, workspaceId: string, limit?: number): Promise<ListResult<MotionTask>> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Searching tasks', {
        method: 'searchTasks',
        query,
        workspaceId,
        limit
      });

      // Apply search limit to prevent resource exhaustion
      const effectiveLimit = limit || LIMITS.MAX_SEARCH_RESULTS;
      const lowerQuery = query.toLowerCase();
      const allMatchingTasks: MotionTask[] = [];
      let aggregateTruncation: TruncationInfo | undefined;

      // First, search in the specified workspace
      const { items: primaryTasks, truncation: primaryTruncation } = await this.getTasks({
        workspaceId,
        limit: calculateAdaptiveFetchLimit(allMatchingTasks.length, effectiveLimit),
        maxPages: LIMITS.MAX_PAGES
      });
      aggregateTruncation = this.mergeTruncationMetadata(aggregateTruncation, primaryTruncation);
      const primaryMatches = primaryTasks.filter(task =>
        task.name?.toLowerCase().includes(lowerQuery) ||
        task.description?.toLowerCase().includes(lowerQuery)
      );

      allMatchingTasks.push(...primaryMatches.slice(0, effectiveLimit));

      mcpLog(LOG_LEVELS.DEBUG, 'Primary workspace search completed', {
        method: 'searchTasks',
        query,
        primaryWorkspaceId: workspaceId,
        primaryMatches: primaryMatches.length,
        keptMatches: allMatchingTasks.length
      });

      // If we haven't reached the limit, search other workspaces
      if (allMatchingTasks.length < effectiveLimit) {
        try {
          const allWorkspaces = await this.getWorkspaces();
          const otherWorkspaces = allWorkspaces.filter(w => w.id !== workspaceId);

          for (const workspace of otherWorkspaces) {
            if (allMatchingTasks.length >= effectiveLimit) break;

            try {
              // Calculate fetch limit before API call (defense-in-depth)
              const fetchLimit = calculateAdaptiveFetchLimit(allMatchingTasks.length, effectiveLimit);
              if (fetchLimit <= 0) break;

              mcpLog(LOG_LEVELS.DEBUG, 'Searching additional workspace for tasks', {
                method: 'searchTasks',
                query,
                searchingWorkspaceId: workspace.id,
                searchingWorkspaceName: workspace.name,
                remainingNeeded: effectiveLimit - allMatchingTasks.length
              });

              const { items: workspaceTasks, truncation: wsTruncation } = await this.getTasks({
                workspaceId: workspace.id,
                limit: fetchLimit,
                maxPages: LIMITS.MAX_PAGES
              });
              aggregateTruncation = this.mergeTruncationMetadata(aggregateTruncation, wsTruncation);
              const workspaceMatches = workspaceTasks.filter(task =>
                task.name?.toLowerCase().includes(lowerQuery) ||
                task.description?.toLowerCase().includes(lowerQuery)
              );

              // Only add as many as we still need
              const remaining = effectiveLimit - allMatchingTasks.length;
              allMatchingTasks.push(...workspaceMatches.slice(0, remaining));

              if (workspaceMatches.length > 0) {
                mcpLog(LOG_LEVELS.DEBUG, 'Found additional matches in workspace', {
                  method: 'searchTasks',
                  query,
                  workspaceId: workspace.id,
                  workspaceName: workspace.name,
                  matches: workspaceMatches.length,
                  keptMatches: Math.min(workspaceMatches.length, remaining)
                });
              }
            } catch (workspaceError: unknown) {
              // Log error but continue searching other workspaces
              mcpLog(LOG_LEVELS.WARN, 'Failed to search workspace for tasks', {
                method: 'searchTasks',
                query,
                workspaceId: workspace.id,
                workspaceName: workspace.name,
                error: getErrorMessage(workspaceError)
              });
            }
          }
        } catch (workspaceListError: unknown) {
          mcpLog(LOG_LEVELS.WARN, 'Failed to get workspace list for cross-workspace search', {
            method: 'searchTasks',
            query,
            error: getErrorMessage(workspaceListError)
          });
        }
      }

      // Results are already limited during collection, no need to slice again
      mcpLog(LOG_LEVELS.INFO, 'Task search completed across all workspaces', {
        method: 'searchTasks',
        query,
        returnedResults: allMatchingTasks.length,
        limit: effectiveLimit
      });

      if (aggregateTruncation) {
        aggregateTruncation.returnedCount = allMatchingTasks.length;
      }
      return { items: allMatchingTasks, truncation: aggregateTruncation };
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to search tasks', {
        method: 'searchTasks',
        query,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  async searchProjects(query: string, workspaceId: string, limit?: number): Promise<ListResult<MotionProject>> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Searching projects', {
        method: 'searchProjects',
        query,
        workspaceId,
        limit
      });

      // Apply search limit to prevent resource exhaustion
      const effectiveLimit = limit || LIMITS.MAX_SEARCH_RESULTS;
      const lowerQuery = query.toLowerCase();
      const allMatchingProjects: MotionProject[] = [];
      let aggregateTruncation: TruncationInfo | undefined;

      // First, search in the specified workspace
      const { items: primaryProjects, truncation: primaryTruncation } = await this.getProjects(workspaceId, {
        maxPages: LIMITS.MAX_PAGES,
        limit: calculateAdaptiveFetchLimit(allMatchingProjects.length, effectiveLimit)
      });
      aggregateTruncation = this.mergeTruncationMetadata(aggregateTruncation, primaryTruncation);
      const primaryMatches = primaryProjects.filter(project =>
        project.name?.toLowerCase().includes(lowerQuery) ||
        project.description?.toLowerCase().includes(lowerQuery)
      );

      allMatchingProjects.push(...primaryMatches.slice(0, effectiveLimit));

      mcpLog(LOG_LEVELS.DEBUG, 'Primary workspace search completed', {
        method: 'searchProjects',
        query,
        primaryWorkspaceId: workspaceId,
        primaryMatches: primaryMatches.length,
        keptMatches: allMatchingProjects.length
      });

      // If we haven't reached the limit, search other workspaces
      if (allMatchingProjects.length < effectiveLimit) {
        try {
          const allWorkspaces = await this.getWorkspaces();
          const otherWorkspaces = allWorkspaces.filter(w => w.id !== workspaceId);

          for (const workspace of otherWorkspaces) {
            if (allMatchingProjects.length >= effectiveLimit) break;

            try {
              // Calculate fetch limit before API call (defense-in-depth)
              const fetchLimit = calculateAdaptiveFetchLimit(allMatchingProjects.length, effectiveLimit);
              if (fetchLimit <= 0) break;

              mcpLog(LOG_LEVELS.DEBUG, 'Searching additional workspace for projects', {
                method: 'searchProjects',
                query,
                searchingWorkspaceId: workspace.id,
                searchingWorkspaceName: workspace.name,
                remainingNeeded: effectiveLimit - allMatchingProjects.length
              });

              const { items: workspaceProjects, truncation: wsTruncation } = await this.getProjects(workspace.id, {
                maxPages: LIMITS.MAX_PAGES,
                limit: fetchLimit
              });
              aggregateTruncation = this.mergeTruncationMetadata(aggregateTruncation, wsTruncation);
              const workspaceMatches = workspaceProjects.filter(project =>
                project.name?.toLowerCase().includes(lowerQuery) ||
                project.description?.toLowerCase().includes(lowerQuery)
              );

              // Only add as many as we still need
              const remaining = effectiveLimit - allMatchingProjects.length;
              allMatchingProjects.push(...workspaceMatches.slice(0, remaining));

              if (workspaceMatches.length > 0) {
                mcpLog(LOG_LEVELS.DEBUG, 'Found additional matches in workspace', {
                  method: 'searchProjects',
                  query,
                  workspaceId: workspace.id,
                  workspaceName: workspace.name,
                  matches: workspaceMatches.length,
                  keptMatches: Math.min(workspaceMatches.length, remaining)
                });
              }
            } catch (workspaceError: unknown) {
              // Log error but continue searching other workspaces
              mcpLog(LOG_LEVELS.WARN, 'Failed to search workspace for projects', {
                method: 'searchProjects',
                query,
                workspaceId: workspace.id,
                workspaceName: workspace.name,
                error: getErrorMessage(workspaceError)
              });
            }
          }
        } catch (workspaceListError: unknown) {
          mcpLog(LOG_LEVELS.WARN, 'Failed to get workspace list for cross-workspace search', {
            method: 'searchProjects',
            query,
            error: getErrorMessage(workspaceListError)
          });
        }
      }

      // Results are already limited during collection, no need to slice again
      mcpLog(LOG_LEVELS.INFO, 'Project search completed across all workspaces', {
        method: 'searchProjects',
        query,
        returnedResults: allMatchingProjects.length,
        limit: effectiveLimit
      });

      if (aggregateTruncation) {
        aggregateTruncation.returnedCount = allMatchingProjects.length;
      }
      return { items: allMatchingProjects, truncation: aggregateTruncation };
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to search projects', {
        method: 'searchProjects',
        query,
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  // ========================================
  // COMMENT API METHODS
  // ========================================

  async getComments(taskId: string, cursor?: string): Promise<MotionPaginatedResponse<MotionComment>> {
    return _getComments(this._ctx, taskId, cursor);
  }

  async createComment(commentData: CreateCommentData): Promise<MotionComment> {
    return _createComment(this._ctx, commentData);
  }

  // ========================================
  // CUSTOM FIELD API METHODS
  // ========================================

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
        throw this.formatApiError(error, 'fetch', 'custom field');
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
        ...(fieldData.required !== undefined && { required: fieldData.required }),
        ...(fieldData.metadata && { metadata: fieldData.metadata })
      };

      // Create minimal payload by removing empty/null values to avoid validation errors
      const minimalPayload = createMinimalPayload(apiPayload);

      const response: AxiosResponse<MotionCustomField> = await this.requestWithRetry(() =>
        this.client.post(`/beta/workspaces/${workspaceId}/custom-fields`, minimalPayload)
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
      throw this.formatApiError(error, 'create', 'custom field', undefined, fieldData.name);
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
      throw this.formatApiError(error, 'delete', 'custom field', fieldId);
    }
  }

  /**
   * Add a custom field to a project
   * @param projectId - ID of the project
   * @param fieldId - ID of the custom field
   * @param value - Optional value for the field
   * @returns The field value as returned by the API ({ type, value })
   */
  async addCustomFieldToProject(projectId: string, fieldId: string, value?: string | number | boolean | string[] | null, fieldType?: string): Promise<MotionCustomFieldValue> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Adding custom field to project', {
        method: 'addCustomFieldToProject',
        projectId,
        fieldId,
        hasValue: value !== undefined
      });

      // API expects: { customFieldInstanceId, value: { type, value } }
      // Value type uses camelCase per API docs (e.g., text, multiSelect)
      const requestData: Record<string, unknown> = {
        customFieldInstanceId: fieldId,
      };
      if (value !== undefined) {
        if (value === null) {
          requestData.value = fieldType !== undefined
            ? { type: fieldType, value: null }
            : { value: null };
        } else {
          if (!fieldType) {
            throw new Error('Field type is required when setting a non-null custom field value');
          }
          requestData.value = {
            type: fieldType,
            value
          };
        }
      }

      const response: AxiosResponse<MotionCustomFieldValue> = await this.requestWithRetry(() =>
        this.client.post(`/beta/custom-field-values/project/${projectId}`, requestData)
      );

      // Invalidate project cache broadly — the API response is { type, value },
      // not a full project object, so we don't have workspace context
      this.projectCache.invalidate(`projects:`);

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
      throw this.formatApiError(error, 'update', 'project', projectId);
    }
  }

  /**
   * Remove a custom field from a project
   * @param projectId - ID of the project
   * @param valueId - ID of the custom field value
   * @returns Success indicator
   */
  async removeCustomFieldFromProject(projectId: string, valueId: string): Promise<{ success: boolean }> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Removing custom field from project', {
        method: 'removeCustomFieldFromProject',
        projectId,
        valueId
      });

      await this.requestWithRetry(() =>
        this.client.delete(`/beta/custom-field-values/project/${projectId}/custom-fields/${valueId}`)
      );

      // Invalidate all project caches since we don't have workspace context here
      this.projectCache.invalidate(`projects:`);

      mcpLog(LOG_LEVELS.INFO, 'Custom field removed from project successfully', {
        method: 'removeCustomFieldFromProject',
        projectId,
        valueId
      });

      return { success: true };
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to remove custom field from project', {
        method: 'removeCustomFieldFromProject',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
        projectId,
        valueId
      });
      throw this.formatApiError(error, 'update', 'project', projectId);
    }
  }

  /**
   * Add a custom field to a task
   * @param taskId - ID of the task
   * @param fieldId - ID of the custom field
   * @param value - Optional value for the field
   * @returns The field value as returned by the API ({ type, value })
   */
  async addCustomFieldToTask(taskId: string, fieldId: string, value?: string | number | boolean | string[] | null, fieldType?: string): Promise<MotionCustomFieldValue> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Adding custom field to task', {
        method: 'addCustomFieldToTask',
        taskId,
        fieldId,
        hasValue: value !== undefined
      });

      // API expects: { customFieldInstanceId, value: { type, value } }
      // Value type uses camelCase per API docs (e.g., text, multiSelect)
      const requestData: Record<string, unknown> = {
        customFieldInstanceId: fieldId,
      };
      if (value !== undefined) {
        if (value === null) {
          requestData.value = fieldType !== undefined
            ? { type: fieldType, value: null }
            : { value: null };
        } else {
          if (!fieldType) {
            throw new Error('Field type is required when setting a non-null custom field value');
          }
          requestData.value = {
            type: fieldType,
            value
          };
        }
      }

      const response: AxiosResponse<MotionCustomFieldValue> = await this.requestWithRetry(() =>
        this.client.post(`/beta/custom-field-values/task/${taskId}`, requestData)
      );

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
      throw this.formatApiError(error, 'update', 'task', taskId);
    }
  }

  /**
   * Remove a custom field from a task
   * @param taskId - ID of the task
   * @param valueId - ID of the custom field value
   * @returns Success indicator
   */
  async removeCustomFieldFromTask(taskId: string, valueId: string): Promise<{ success: boolean }> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Removing custom field from task', {
        method: 'removeCustomFieldFromTask',
        taskId,
        valueId
      });

      await this.requestWithRetry(() =>
        this.client.delete(`/beta/custom-field-values/task/${taskId}/custom-fields/${valueId}`)
      );

      mcpLog(LOG_LEVELS.INFO, 'Custom field removed from task successfully', {
        method: 'removeCustomFieldFromTask',
        taskId,
        valueId
      });

      return { success: true };
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to remove custom field from task', {
        method: 'removeCustomFieldFromTask',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
        taskId,
        valueId
      });
      throw this.formatApiError(error, 'update', 'task', taskId);
    }
  }

  // ========================================
  // RECURRING TASK API METHODS
  // ========================================

  async getRecurringTasks(workspaceId?: string, options?: { maxPages?: number; limit?: number }): Promise<ListResult<MotionRecurringTask>> {
    return _getRecurringTasks(this._ctx, workspaceId, options);
  }

  async createRecurringTask(taskData: CreateRecurringTaskData): Promise<MotionRecurringTask> {
    return _createRecurringTask(this._ctx, taskData);
  }

  async deleteRecurringTask(recurringTaskId: string): Promise<{ success: boolean }> {
    return _deleteRecurringTask(this._ctx, recurringTaskId);
  }

  // ========================================
  // SCHEDULE API METHODS
  // ========================================

  async getAvailableScheduleNames(workspaceId?: string): Promise<string[]> {
    return _getAvailableScheduleNames(this._ctx, workspaceId);
  }

  async getSchedules(): Promise<MotionSchedule[]> {
    return _getSchedules(this._ctx);
  }

  // ========================================
  // STATUS API METHODS
  // ========================================

  /**
   * Retrieves available workflow statuses from Motion
   * @param workspaceId - Optional workspace ID to filter statuses
   * @returns Promise resolving to array of Motion statuses
   * @throws {Error} If the API request fails
   */
  async getStatuses(workspaceId?: string): Promise<MotionStatus[]> {
    return _getStatuses(this._ctx, workspaceId);
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Get all uncompleted tasks across all workspaces and projects
   * Filters tasks where status.isResolvedStatus is false or undefined
   */
  async getAllUncompletedTasks(limit?: number, assigneeId?: string): Promise<ListResult<MotionTask>> {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching all uncompleted tasks across workspaces', {
        method: 'getAllUncompletedTasks',
        limit,
        assigneeId
      });

      // Apply limit to prevent resource exhaustion
      const effectiveLimit = limit || LIMITS.MAX_SEARCH_RESULTS;
      const allUncompletedTasks: MotionTask[] = [];
      let aggregateTruncation: TruncationInfo | undefined;

      try {
        // Get all workspaces
        const workspaces = await this.getWorkspaces();

        mcpLog(LOG_LEVELS.DEBUG, 'Searching for uncompleted tasks across workspaces', {
          method: 'getAllUncompletedTasks',
          totalWorkspaces: workspaces.length
        });

        // Fetch tasks from each workspace
        for (const workspace of workspaces) {
          if (allUncompletedTasks.length >= effectiveLimit) {
            break; // Stop if we've reached the limit
          }

          try {
            // Calculate fetch limit before API call (defense-in-depth)
            const fetchLimit = calculateAdaptiveFetchLimit(allUncompletedTasks.length, effectiveLimit);
            if (fetchLimit <= 0) break;

            // Get tasks from this workspace with adaptive limit
            const { items: workspaceTasks, truncation: wsTruncation } = await this.getTasks({
              workspaceId: workspace.id,
              assigneeId,
              limit: fetchLimit,
              maxPages: LIMITS.MAX_PAGES
            });
            aggregateTruncation = this.mergeTruncationMetadata(aggregateTruncation, wsTruncation);

            // Filter for uncompleted tasks
            const uncompletedTasks = workspaceTasks.filter(task => {
              // Task is uncompleted if status is missing or isResolvedStatus is false
              if (!task.status) return true; // No status = not resolved
              if (typeof task.status === 'string') {
                const resolvedStatusNames = new Set([
                  'completed',
                  'complete',
                  'done',
                  'closed',
                  'resolved',
                  'canceled',
                  'cancelled'
                ]);
                return !resolvedStatusNames.has(task.status.trim().toLowerCase());
              }
              return !task.status.isResolvedStatus; // Object status with isResolvedStatus false
            });

            // Only add as many as we still need
            const remaining = effectiveLimit - allUncompletedTasks.length;
            allUncompletedTasks.push(...uncompletedTasks.slice(0, remaining));

            if (uncompletedTasks.length > 0) {
              mcpLog(LOG_LEVELS.DEBUG, 'Found uncompleted tasks in workspace', {
                method: 'getAllUncompletedTasks',
                workspaceId: workspace.id,
                workspaceName: workspace.name,
                uncompletedTasks: uncompletedTasks.length,
                keptTasks: Math.min(uncompletedTasks.length, remaining),
                totalTasks: workspaceTasks.length
              });
            }
          } catch (workspaceError: unknown) {
            // Log error but continue with other workspaces
            mcpLog(LOG_LEVELS.WARN, 'Failed to fetch tasks from workspace', {
              method: 'getAllUncompletedTasks',
              workspaceId: workspace.id,
              workspaceName: workspace.name,
              error: getErrorMessage(workspaceError)
            });
          }
        }
      } catch (workspaceListError: unknown) {
        mcpLog(LOG_LEVELS.ERROR, 'Failed to get workspace list', {
          method: 'getAllUncompletedTasks',
          error: getErrorMessage(workspaceListError)
        });
        throw workspaceListError;
      }

      // Results are already limited during collection, no need to slice again
      mcpLog(LOG_LEVELS.INFO, 'All uncompleted tasks fetched successfully', {
        method: 'getAllUncompletedTasks',
        returned: allUncompletedTasks.length,
        limit: effectiveLimit
      });

      if (aggregateTruncation) {
        aggregateTruncation.returnedCount = allUncompletedTasks.length;
      }
      return { items: allUncompletedTasks, truncation: aggregateTruncation };
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch all uncompleted tasks', {
        method: 'getAllUncompletedTasks',
        error: getErrorMessage(error)
      });
      throw error;
    }
  }
}
