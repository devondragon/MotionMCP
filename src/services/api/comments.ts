/**
 * Comment resource module — getComments, createComment
 */

import { isAxiosError, AxiosResponse } from 'axios';
import { MotionComment, CreateCommentData, MotionPaginatedResponse } from '../../types/motion';
import { LOG_LEVELS, createMinimalPayload } from '../../utils/constants';
import { mcpLog } from '../../utils/logger';
import { unwrapApiResponse } from '../../utils/responseWrapper';
import { ResourceContext } from './types';
import { getErrorMessage } from './ApiClient';

export async function getComments(ctx: ResourceContext, taskId: string, cursor?: string): Promise<MotionPaginatedResponse<MotionComment>> {
  const cacheKey = `comments:${taskId}:${cursor ?? 'none'}`;

  return ctx.cache.comment.withCache(cacheKey, async () => {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching comments from Motion API', {
        method: 'getComments',
        taskId,
        cursor
      });

      const params = new URLSearchParams({ taskId });
      if (cursor) params.append('cursor', cursor);

      const response = await ctx.api.requestWithRetry(() =>
        ctx.api.client.get(`/comments?${params.toString()}`)
      );

      // Use new response wrapper for consistent handling
      const unwrapped = unwrapApiResponse<MotionComment>(response.data, 'comments');

      mcpLog(LOG_LEVELS.INFO, 'Comments fetched successfully', {
        method: 'getComments',
        count: unwrapped.data.length,
        hasMore: !!unwrapped.meta?.nextCursor,
        taskId
      });

      // Return in our standard paginated format
      return {
        data: unwrapped.data,
        meta: {
          nextCursor: unwrapped.meta?.nextCursor,
          pageSize: unwrapped.meta?.pageSize || unwrapped.data.length
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
      throw ctx.api.formatApiError(error, 'fetch', 'comment');
    }
  });
}

export async function createComment(ctx: ResourceContext, commentData: CreateCommentData): Promise<MotionComment> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Creating comment in Motion API', {
      method: 'createComment',
      taskId: commentData.taskId,
      contentLength: commentData.content?.length || 0
    });

    // Create minimal payload by removing empty/null values to avoid validation errors
    const minimalPayload = createMinimalPayload(commentData);

    const response: AxiosResponse<MotionComment> = await ctx.api.requestWithRetry(() =>
      ctx.api.client.post('/comments', minimalPayload)
    );

    // Invalidate all cached pages for this task's comments (cursor variants included)
    ctx.cache.comment.invalidate(`comments:${commentData.taskId}:`);

    mcpLog(LOG_LEVELS.INFO, 'Comment created successfully', {
      method: 'createComment',
      commentId: response.data?.id,
      taskId: commentData.taskId
    });

    return response.data;
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Failed to create comment', {
      method: 'createComment',
      error: getErrorMessage(error),
      apiStatus: isAxiosError(error) ? error.response?.status : undefined,
      apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
      taskId: commentData?.taskId
    });
    throw ctx.api.formatApiError(error, 'create', 'comment');
  }
}
