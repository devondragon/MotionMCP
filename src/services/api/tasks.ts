/**
 * Task resource module — getTasks, getTask, createTask, updateTask, deleteTask,
 * moveTask, unassignTask, getAllUncompletedTasks
 */

import { AxiosResponse, isAxiosError } from 'axios';
import { MotionTask, MotionTaskCreateData, MotionTaskUpdateData } from '../../types/motion';
import { LOG_LEVELS, createMinimalPayload, LIMITS, ValidPriority } from '../../utils/constants';
import { UserFacingError } from '../../utils/errors';
import { mcpLog } from '../../utils/logger';
import { fetchAllPages as fetchAllPagesNew, calculateAdaptiveFetchLimit } from '../../utils/paginationNew';
import { unwrapApiResponse } from '../../utils/responseWrapper';
import { TruncationInfo, ListResult } from '../../types/mcp';
import { ResourceContext } from './types';
import { getErrorMessage } from './ApiClient';
import { getWorkspaces } from './workspaces';

export interface GetTasksOptions {
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

export async function getTasks(ctx: ResourceContext, options: GetTasksOptions): Promise<ListResult<MotionTask>> {
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
    maxPages = LIMITS.MAX_PAGES
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
          // Upper-bound filter: returns tasks due ON OR BEFORE the given date (inclusive)
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

      return ctx.api.requestWithRetry(() => ctx.api.client.get(url));
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
      // Fallback to simple fetch if pagination fails — results may be incomplete
      mcpLog(LOG_LEVELS.WARN, 'Pagination failed, falling back to single-page fetch', {
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

    return { items: tasks, truncation: { wasTruncated: true, returnedCount: tasks.length, reason: 'error' } };
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch tasks', {
      method: 'getTasks',
      error: getErrorMessage(error),
      apiStatus: isAxiosError(error) ? error.response?.status : undefined,
      apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
    });
    throw ctx.api.formatApiError(error, 'fetch', 'task');
  }
}

export async function getTask(ctx: ResourceContext, taskId: string): Promise<MotionTask> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Fetching single task from Motion API', {
      method: 'getTask',
      taskId
    });

    const response: AxiosResponse<MotionTask> = await ctx.api.requestWithRetry(() => ctx.api.client.get(`/tasks/${taskId}`));

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
    throw ctx.api.formatApiError(error, 'fetch', 'task', taskId);
  }
}

export async function createTask(ctx: ResourceContext, taskData: MotionTaskCreateData): Promise<MotionTask> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Creating task in Motion API', {
      method: 'createTask',
      taskName: taskData.name,
      workspaceId: taskData.workspaceId,
      projectId: taskData.projectId
    });

    if (!taskData.workspaceId) {
      throw new UserFacingError(
        'Workspace ID is required to create a task',
        'Workspace ID is required to create a task',
        undefined,
        undefined,
        400
      );
    }

    // Create minimal payload by removing empty/null values to avoid validation errors
    const minimalPayload = createMinimalPayload(taskData);

    // Debug logging: log the exact payload being sent to API
    mcpLog(LOG_LEVELS.DEBUG, 'API payload for task creation', {
      method: 'createTask',
      payload: JSON.stringify(minimalPayload, null, 2)
    });

    const response: AxiosResponse<MotionTask> = await ctx.api.requestWithRetry(() => ctx.api.client.post('/tasks', minimalPayload));

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
    throw ctx.api.formatApiError(error, 'create', 'task', undefined, taskData.name);
  }
}

// Note: API docs list name and workspaceId as required for PATCH /tasks/{id},
// but the API appears to accept partial updates without them. Not enforced here.
export async function updateTask(ctx: ResourceContext, taskId: string, updates: MotionTaskUpdateData): Promise<MotionTask> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Updating task in Motion API', {
      method: 'updateTask',
      taskId,
      updates: Object.keys(updates)
    });

    // Create minimal payload by removing empty/null values to avoid validation errors
    const minimalUpdates = createMinimalPayload(updates);
    const response: AxiosResponse<MotionTask> = await ctx.api.requestWithRetry(() => ctx.api.client.patch(`/tasks/${taskId}`, minimalUpdates));

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
    throw ctx.api.formatApiError(error, 'update', 'task', taskId);
  }
}

export async function deleteTask(ctx: ResourceContext, taskId: string): Promise<void> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Deleting task from Motion API', {
      method: 'deleteTask',
      taskId
    });

    await ctx.api.requestWithRetry(() => ctx.api.client.delete(`/tasks/${taskId}`));

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
    throw ctx.api.formatApiError(error, 'delete', 'task', taskId);
  }
}

export async function moveTask(ctx: ResourceContext, taskId: string, targetWorkspaceId: string, assigneeId?: string): Promise<MotionTask | undefined> {
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

    const response = await ctx.api.requestWithRetry(() =>
      ctx.api.client.patch(`/tasks/${taskId}/move`, moveData)
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
    throw ctx.api.formatApiError(error, 'move', 'task', taskId);
  }
}

export async function unassignTask(ctx: ResourceContext, taskId: string): Promise<MotionTask | undefined> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Unassigning task in Motion API', {
      method: 'unassignTask',
      taskId
    });

    const response = await ctx.api.requestWithRetry(() =>
      ctx.api.client.delete(`/tasks/${taskId}/assignee`)
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
    throw ctx.api.formatApiError(error, 'unassign', 'task', taskId);
  }
}

/**
 * Get all uncompleted tasks across all workspaces and projects
 * Filters tasks where status.isResolvedStatus is false or undefined
 */
export async function getAllUncompletedTasks(ctx: ResourceContext, limit?: number, assigneeId?: string): Promise<ListResult<MotionTask>> {
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
      const workspaces = await getWorkspaces(ctx);

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
          const { items: workspaceTasks, truncation: wsTruncation } = await getTasks(ctx, {
            workspaceId: workspace.id,
            assigneeId,
            limit: fetchLimit,
            maxPages: LIMITS.MAX_PAGES
          });
          aggregateTruncation = ctx.api.mergeTruncationMetadata(aggregateTruncation, wsTruncation);

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
