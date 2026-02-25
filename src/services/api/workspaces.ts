/**
 * Workspace resource module — getWorkspaces, fetchWorkspaces
 */

import { isAxiosError, AxiosResponse } from 'axios';
import { MotionWorkspace } from '../../types/motion';
import { LOG_LEVELS } from '../../utils/constants';
import { mcpLog } from '../../utils/logger';
import { WorkspacesListResponseSchema } from '../../schemas/motion';
import { ResourceContext } from './types';
import { getErrorMessage } from './ApiClient';

async function fetchWorkspaces(ctx: ResourceContext, ids?: string[]): Promise<MotionWorkspace[]> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Fetching workspaces from Motion API', {
      method: 'getWorkspaces',
      filterIds: ids
    });

    const params = new URLSearchParams();
    if (ids && ids.length > 0) {
      for (const id of ids) {
        params.append('ids', id);
      }
    }
    const queryString = params.toString();
    const url = queryString ? `/workspaces?${queryString}` : '/workspaces';

    const response: AxiosResponse = await ctx.api.requestWithRetry(() => ctx.api.client.get(url));

    // Validate the response structure
    const validatedResponse = ctx.api.validateResponse(
      response.data,
      WorkspacesListResponseSchema,
      'getWorkspaces'
    );

    // Extract workspaces array (handle both wrapped and unwrapped responses)
    const workspaces = Array.isArray(validatedResponse)
      ? validatedResponse
      : validatedResponse.workspaces;

    mcpLog(LOG_LEVELS.INFO, 'Workspaces fetched successfully', {
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
    throw ctx.api.formatApiError(error, 'fetch', 'workspace');
  }
}

export async function getWorkspaces(ctx: ResourceContext, ids?: string[]): Promise<MotionWorkspace[]> {
  // Skip caching when filtering by IDs — filtered results are unlikely to be reused
  if (ids && ids.length > 0) {
    return fetchWorkspaces(ctx, ids);
  }
  return ctx.cache.workspace.withCache('workspaces', async () => {
    return fetchWorkspaces(ctx);
  });
}
