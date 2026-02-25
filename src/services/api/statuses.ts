/**
 * Status resource module — getStatuses
 */

import { isAxiosError } from 'axios';
import { MotionStatus } from '../../types/motion';
import { LOG_LEVELS } from '../../utils/constants';
import { mcpLog } from '../../utils/logger';
import { StatusesListResponseSchema } from '../../schemas/motion';
import { ResourceContext } from './types';
import { getErrorMessage } from './ApiClient';

export async function getStatuses(ctx: ResourceContext, workspaceId?: string): Promise<MotionStatus[]> {
  // Use workspace ID for cache key, or 'all' if not specified
  const cacheKey = workspaceId ? `statuses:workspace:${workspaceId}` : 'statuses:all';

  return ctx.cache.status.withCache(cacheKey, async () => {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching statuses from Motion API', {
        method: 'getStatuses',
        workspaceId
      });

      const params = new URLSearchParams();
      if (workspaceId) params.append('workspaceId', workspaceId);

      const queryString = params.toString();
      const url = queryString ? `/statuses?${queryString}` : '/statuses';

      const response = await ctx.api.requestWithRetry(() => ctx.api.client.get(url));

      // Validate response against schema
      const validatedResponse = ctx.api.validateResponse(
        response.data,
        StatusesListResponseSchema,
        'statuses'
      );

      // Extract statuses from validated response; fail loudly on unknown shape to avoid caching empty results.
      let statuses: MotionStatus[];
      if (Array.isArray(validatedResponse)) {
        statuses = validatedResponse;
      } else if (
        validatedResponse &&
        typeof validatedResponse === 'object' &&
        'statuses' in validatedResponse &&
        Array.isArray(validatedResponse.statuses)
      ) {
        statuses = validatedResponse.statuses;
      } else {
        mcpLog(LOG_LEVELS.WARN, 'Unexpected statuses response shape', {
          method: 'getStatuses',
          workspaceId,
          responseType: validatedResponse === null ? 'null' : typeof validatedResponse
        });
        throw new Error('Invalid statuses response shape from Motion API');
      }

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
      throw ctx.api.formatApiError(error, 'fetch', 'status');
    }
  });
}
