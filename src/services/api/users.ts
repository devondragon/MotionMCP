/**
 * User resource module — getUsers, getCurrentUser
 */

import { isAxiosError, AxiosResponse } from 'axios';
import { MotionUser, ListResponse } from '../../types/motion';
import { LOG_LEVELS } from '../../utils/constants';
import { mcpLog } from '../../utils/logger';
import { ResourceContext } from './types';
import { getErrorMessage } from './ApiClient';

export async function getUsers(ctx: ResourceContext, workspaceId?: string, teamId?: string): Promise<MotionUser[]> {
  const parts = [workspaceId && `ws:${workspaceId}`, teamId && `team:${teamId}`].filter(Boolean);
  const cacheKey = parts.length > 0 ? `users:${parts.join(':')}` : 'users:all';

  return ctx.cache.user.withCache(cacheKey, async () => {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching users from Motion API', {
        method: 'getUsers',
        workspaceId,
        teamId
      });

      const params = new URLSearchParams();
      if (workspaceId) {
        params.append('workspaceId', workspaceId);
      }
      if (teamId) {
        params.append('teamId', teamId);
      }

      const queryString = params.toString();
      const url = queryString ? `/users?${queryString}` : '/users';

      const response: AxiosResponse<ListResponse<MotionUser>> = await ctx.api.requestWithRetry(() => ctx.api.client.get(url));

      // The Motion API might wrap the users in a 'users' array
      const usersData = response.data?.users || response.data || [];
      const users = Array.isArray(usersData) ? usersData : [];

      if (!Array.isArray(response.data?.users) && !Array.isArray(response.data)) {
        mcpLog(LOG_LEVELS.WARN, 'Unexpected users response shape', {
          method: 'getUsers',
          workspaceId,
          responseType: response.data === null ? 'null' : typeof response.data
        });
      }

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
      throw ctx.api.formatApiError(error, 'fetch', 'user');
    }
  });
}

export async function getCurrentUser(ctx: ResourceContext): Promise<MotionUser> {
  const cacheKey = 'currentUser';

  // Use userCache but with a special single-user wrapper
  const cachedUsers = await ctx.cache.user.withCache(cacheKey, async () => {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching current user from Motion API', {
        method: 'getCurrentUser'
      });

      const response: AxiosResponse<MotionUser> = await ctx.api.requestWithRetry(() => ctx.api.client.get('/users/me'));

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
      throw ctx.api.formatApiError(error, 'fetch', 'user');
    }
  });

  const user = cachedUsers[0];
  if (!user) {
    throw ctx.api.formatApiError(new Error('No user returned from API'), 'fetch', 'user');
  }
  return user;
}
