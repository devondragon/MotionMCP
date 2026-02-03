import { BaseHandler } from './base/BaseHandler';
import { McpToolResponse } from '../types/mcp';
import { MotionCommentsArgs } from '../types/mcp-tool-args';
import { CreateCommentData } from '../types/motion';
import { formatCommentList, formatCommentDetail, LIMITS } from '../utils';
import { sanitizeCommentContent } from '../utils/sanitize';

export class CommentHandler extends BaseHandler {
  async handle(args: MotionCommentsArgs): Promise<McpToolResponse> {
    try {
      const { operation, taskId, content, cursor } = args;

      switch(operation) {
        case 'list':
          return await this.handleList(taskId, cursor);
        case 'create':
          return await this.handleCreate(taskId, content);
        default:
          return this.handleUnknownOperation(operation);
      }
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  private async handleList(taskId?: string, cursor?: string): Promise<McpToolResponse> {
    if (!taskId) {
      return this.handleError(new Error('taskId is required for list operation'));
    }

    const commentsResponse = await this.motionService.getComments(taskId, cursor);
    const commentsResult = formatCommentList(commentsResponse.data);

    // Add pagination info if there's more data
    if (commentsResponse.meta.nextCursor && commentsResult.content[0]) {
      const firstContent = commentsResult.content[0];
      if ('text' in firstContent && typeof firstContent.text === 'string') {
        firstContent.text += `\n\n📄 More comments available. Use cursor: ${commentsResponse.meta.nextCursor}`;
      }
    }

    return commentsResult;
  }

  private async handleCreate(taskId?: string, content?: string): Promise<McpToolResponse> {
    if (!taskId) {
      return this.handleError(new Error('taskId is required for create operation'));
    }
    if (!content) {
      return this.handleError(new Error('content is required for create operation'));
    }

    // Sanitize and validate comment content
    const sanitizationResult = sanitizeCommentContent(content);
    if (!sanitizationResult.isValid) {
      return this.handleError(new Error(sanitizationResult.error || 'Invalid comment content'));
    }

    const sanitizedContent = sanitizationResult.sanitized;
    if (sanitizedContent.length > LIMITS.COMMENT_MAX_LENGTH) {
      return this.handleError(new Error(`Comment content exceeds maximum length of ${LIMITS.COMMENT_MAX_LENGTH} characters`));
    }

    const commentData: CreateCommentData = {
      taskId,
      content: sanitizedContent
    };

    const newComment = await this.motionService.createComment(commentData);
    return formatCommentDetail(newComment);
  }
}