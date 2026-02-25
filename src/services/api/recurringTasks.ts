/**
 * Recurring task resource module — getRecurringTasks, createRecurringTask, deleteRecurringTask
 */

import { isAxiosError, AxiosResponse } from 'axios';
import { MotionRecurringTask, CreateRecurringTaskData } from '../../types/motion';
import { LOG_LEVELS, createMinimalPayload, LIMITS } from '../../utils/constants';
import { mcpLog } from '../../utils/logger';
import { fetchAllPages as fetchAllPagesNew } from '../../utils/paginationNew';
import { ListResult } from '../../types/mcp';
import { transformFrequencyToApiString, validateFrequencyObject } from '../../utils/frequencyTransform';
import { ResourceContext } from './types';
import { getErrorMessage } from './ApiClient';

export async function getRecurringTasks(
  ctx: ResourceContext,
  workspaceId?: string,
  options?: { maxPages?: number; limit?: number }
): Promise<ListResult<MotionRecurringTask>> {
  const { maxPages = LIMITS.MAX_PAGES, limit } = options || {};
  const cacheKey = workspaceId ? `recurring-tasks:workspace:${workspaceId}` : 'recurring-tasks:all';

  // Check cache - return items only (no stale truncation info)
  const cachedItems = ctx.cache.recurringTask.get(cacheKey);
  if (cachedItems !== null) {
    return { items: cachedItems };
  }

  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Fetching recurring tasks from Motion API with pagination', {
      method: 'getRecurringTasks',
      workspaceId,
      maxPages,
      limit
    });

    // Create a fetch function for pagination utility
    const fetchPage = async (cursor?: string) => {
      const params = new URLSearchParams();
      if (workspaceId) params.append('workspaceId', workspaceId);
      if (cursor) params.append('cursor', cursor);

      const queryString = params.toString();
      const url = queryString ? `/recurring-tasks?${queryString}` : '/recurring-tasks';

      return ctx.api.requestWithRetry(() => ctx.api.client.get(url));
    };

    // Use pagination utility to fetch all pages
    const paginatedResult = await fetchAllPagesNew<MotionRecurringTask>(fetchPage, 'recurring-tasks', {
      maxPages,
      logProgress: true,
      ...(limit ? { maxItems: limit } : {})
    });

    mcpLog(LOG_LEVELS.INFO, 'Recurring tasks fetched successfully with pagination', {
      method: 'getRecurringTasks',
      totalCount: paginatedResult.totalFetched,
      pagesProcessed: Math.ceil(paginatedResult.totalFetched / LIMITS.DEFAULT_PAGE_SIZE),
      hasMore: paginatedResult.hasMore,
      workspaceId
    });

    // Cache only items, not truncation metadata
    ctx.cache.recurringTask.set(cacheKey, paginatedResult.items);
    return { items: paginatedResult.items, truncation: paginatedResult.truncation };
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch recurring tasks', {
      method: 'getRecurringTasks',
      error: getErrorMessage(error),
      apiStatus: isAxiosError(error) ? error.response?.status : undefined,
      apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
      workspaceId
    });
    throw ctx.api.formatApiError(error, 'fetch', 'recurring task');
  }
}

export async function createRecurringTask(ctx: ResourceContext, taskData: CreateRecurringTaskData): Promise<MotionRecurringTask> {
  try {
    // Validate frequency object before transformation
    const freqValidation = validateFrequencyObject(taskData.frequency);
    if (!freqValidation.valid) {
      throw new Error(`Invalid frequency object: ${freqValidation.reason || 'Unknown reason'}`);
    }

    // Transform frequency object to API string format
    const frequencyString = transformFrequencyToApiString(taskData.frequency);

    mcpLog(LOG_LEVELS.DEBUG, 'Creating recurring task in Motion API', {
      method: 'createRecurringTask',
      name: taskData.name,
      assigneeId: taskData.assigneeId,
      frequency: frequencyString,
      originalFrequency: taskData.frequency,
      workspaceId: taskData.workspaceId
    });

    // Build API payload: extract endDate from frequency object to top-level,
    // replace frequency object with transformed string
    const { frequency: _freqObj, ...restTaskData } = taskData;
    const apiPayload = {
      ...restTaskData,
      frequency: frequencyString,
      ...(taskData.frequency.endDate && { endDate: taskData.frequency.endDate })
    };

    // Create minimal payload by removing empty/null values to avoid validation errors
    const minimalPayload = createMinimalPayload(apiPayload);
    const response: AxiosResponse<MotionRecurringTask> = await ctx.api.requestWithRetry(() =>
      ctx.api.client.post('/recurring-tasks', minimalPayload)
    );

    // Invalidate cache after successful creation
    ctx.cache.recurringTask.invalidate('recurring-tasks:');

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
    throw ctx.api.formatApiError(error, 'create', 'recurring task', undefined, taskData.name);
  }
}

export async function deleteRecurringTask(ctx: ResourceContext, recurringTaskId: string): Promise<{ success: boolean }> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Deleting recurring task from Motion API', {
      method: 'deleteRecurringTask',
      recurringTaskId
    });

    await ctx.api.requestWithRetry(() =>
      ctx.api.client.delete(`/recurring-tasks/${recurringTaskId}`)
    );

    // Invalidate cache after successful deletion
    ctx.cache.recurringTask.invalidate('recurring-tasks:');

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
    throw ctx.api.formatApiError(error, 'delete', 'recurring task', recurringTaskId);
  }
}
