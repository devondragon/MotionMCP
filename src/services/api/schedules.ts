/**
 * Schedule resource module — getSchedules, getAvailableScheduleNames
 */

import { isAxiosError, AxiosResponse } from 'axios';
import { MotionSchedule, ListResponse } from '../../types/motion';
import { LOG_LEVELS } from '../../utils/constants';
import { mcpLog } from '../../utils/logger';
import { SchedulesListResponseSchema } from '../../schemas/motion';
import { ResourceContext } from './types';
import { getErrorMessage } from './ApiClient';

export async function getSchedules(ctx: ResourceContext): Promise<MotionSchedule[]> {
  const cacheKey = 'schedules:all';

  return ctx.cache.schedule.withCache(cacheKey, async () => {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching schedules from Motion API', {
        method: 'getSchedules'
      });

      const response: AxiosResponse<ListResponse<MotionSchedule>> = await ctx.api.requestWithRetry(() => ctx.api.client.get('/schedules'));

      // Validate response against schema
      const validatedResponse = ctx.api.validateResponse(
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
        count: schedulesArray.length
      });

      return schedulesArray;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch schedules', {
        method: 'getSchedules',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
      });
      throw ctx.api.formatApiError(error, 'fetch', 'schedule');
    }
  });
}

export async function getAvailableScheduleNames(ctx: ResourceContext, workspaceId?: string): Promise<string[]> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Fetching available schedule names', {
      method: 'getAvailableScheduleNames',
      workspaceId
    });

    // Fetch all schedules without filters to get available schedule templates
    const schedules = await getSchedules(ctx);
    const scheduleNames = schedules.map(schedule => schedule.name).filter(Boolean);

    mcpLog(LOG_LEVELS.INFO, 'Available schedule names fetched successfully', {
      method: 'getAvailableScheduleNames',
      count: scheduleNames.length,
      scheduleNames
    });

    return scheduleNames;
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch available schedule names', {
      method: 'getAvailableScheduleNames',
      error: getErrorMessage(error),
      workspaceId
    });
    throw ctx.api.formatApiError(error, 'fetch', 'schedule');
  }
}
