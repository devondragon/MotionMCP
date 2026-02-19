import { BaseHandler } from './base/BaseHandler';
import { McpToolResponse, TruncationInfo } from '../types/mcp';
import { MotionSearchArgs } from '../types/mcp-tool-args';
import { formatMcpSuccess, formatSearchResults, LIMITS } from '../utils';

interface ContentSearchArgs {
  query: string;
  entityTypes?: string[];
  workspaceId?: string;
  workspaceName?: string;
  limit?: number;
}

interface ContextSearchArgs {
  entityType: string;
  entityId: string;
  includeRelated?: boolean;
}

interface SmartSearchArgs extends ContentSearchArgs, Partial<ContextSearchArgs> {
  searchScope?: string;
}

export class SearchHandler extends BaseHandler {
  async handle(args: MotionSearchArgs): Promise<McpToolResponse> {
    try {
      const { operation } = args;

      switch(operation) {
        case 'content':
          return await this.handleContentSearch(args as ContentSearchArgs);
        case 'context':
          return await this.handleContextSearch(args as ContextSearchArgs);
        case 'smart':
          return await this.handleSmartSearch(args as SmartSearchArgs);
        default:
          return this.handleUnknownOperation(operation);
      }
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  private async handleContentSearch(args: ContentSearchArgs): Promise<McpToolResponse> {
    if (!args.query) {
      return this.handleError(new Error("Query is required for content search"));
    }

    const entityTypes = (args as any).searchScope === 'tasks' ? ['tasks'] :
                       (args as any).searchScope === 'projects' ? ['projects'] :
                       ['tasks', 'projects'];

    // Use configurable limit to prevent resource exhaustion
    const limit = args.limit || LIMITS.MAX_SEARCH_RESULTS;

    const workspace = await this.workspaceResolver.resolveWorkspace({
      workspaceId: args.workspaceId,
      workspaceName: args.workspaceName
    });

    let results: Array<any> = [];
    let mergedTruncation: TruncationInfo | undefined;

    if (entityTypes.includes('tasks')) {
      const { items: tasks, truncation } = await this.motionService.searchTasks(args.query, workspace.id, limit);
      results.push(...tasks);
      if (truncation?.wasTruncated) {
        mergedTruncation = truncation;
      }
    }

    if (entityTypes.includes('projects')) {
      const { items: projects, truncation } = await this.motionService.searchProjects(args.query, workspace.id, limit);
      results.push(...projects);
      if (truncation?.wasTruncated) {
        mergedTruncation = truncation;
      }
    }

    const slicedResults = results.slice(0, limit);
    if (mergedTruncation) {
      mergedTruncation.returnedCount = slicedResults.length;
    }

    return formatSearchResults(slicedResults, args.query, {
      limit,
      searchScope: entityTypes.join(',') || 'both',
      truncation: mergedTruncation
    });
  }

  private async handleContextSearch(args: ContextSearchArgs): Promise<McpToolResponse> {
    if (!args.entityType || !args.entityId) {
      return this.handleError(new Error("EntityType and entityId are required for context operation"));
    }

    const { entityType, entityId, includeRelated = false } = args;

    let contextText = `Context for ${entityType} ${entityId}:\n\n`;

    // For now, return a simple context message as Motion API doesn't have specific context endpoints
    if (entityType === 'project') {
      contextText += `Project ID: ${entityId}\n`;
      if (includeRelated) {
        contextText += `Related tasks would be listed here (when available)\n`;
      }
    } else if (entityType === 'task') {
      contextText += `Task ID: ${entityId}\n`;
      if (includeRelated) {
        contextText += `Related project and subtasks would be listed here (when available)\n`;
      }
    }

    return formatMcpSuccess(contextText);
  }

  private async handleSmartSearch(args: SmartSearchArgs): Promise<McpToolResponse> {
    if (!args.query) {
      return this.handleError(new Error("Query is required for smart search"));
    }

    const { query, entityType, entityId, includeRelated = false } = args;

    let contextText = `Smart search results for "${query}":\n\n`;

    // Perform content search
    const searchResults = await this.handleContentSearch({
      query,
      entityTypes: args.searchScope === 'tasks' ? ['tasks'] :
                  args.searchScope === 'projects' ? ['projects'] :
                  ['tasks', 'projects'],
      workspaceId: args.workspaceId,
      workspaceName: args.workspaceName
    });

    contextText += "Content Results:\n";
    // Extract text from search results
    if ('content' in searchResults && searchResults.content && Array.isArray(searchResults.content)) {
      const textContent = searchResults.content.find(item => item.type === 'text');
      if (textContent && 'text' in textContent) {
        contextText += textContent.text + "\n\n";
      }
    }

    // Add contextual information if entity is specified
    if (entityType && entityId) {
      contextText += `Context for ${entityType} ${entityId}:\n`;
      if (entityType === 'project') {
        contextText += `Project ID: ${entityId}\n`;
        if (includeRelated) {
          contextText += `Related tasks would be listed here (when available)\n`;
        }
      } else if (entityType === 'task') {
        contextText += `Task ID: ${entityId}\n`;
        if (includeRelated) {
          contextText += `Related project and subtasks would be listed here (when available)\n`;
        }
      }
    }

    return formatMcpSuccess(contextText);
  }
}