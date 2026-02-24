import { BaseHandler } from './base/BaseHandler';
import { McpToolResponse, TruncationInfo } from '../types/mcp';
import { MotionSearchArgs } from '../types/mcp-tool-args';
import { formatSearchResults, LIMITS } from '../utils';

interface ContentSearchArgs {
  query: string;
  entityTypes?: Array<'tasks' | 'projects'>;
  searchScope?: 'tasks' | 'projects' | 'both';
  workspaceId?: string;
  workspaceName?: string;
  limit?: number;
}

export class SearchHandler extends BaseHandler {
  async handle(args: MotionSearchArgs): Promise<McpToolResponse> {
    try {
      const { operation } = args;

      switch(operation) {
        case 'content':
          return await this.handleContentSearch(args as ContentSearchArgs);
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

    const entityTypes = this.resolveEntityTypes(args);

    // Use configurable limit to prevent resource exhaustion
    const limit = args.limit || LIMITS.MAX_SEARCH_RESULTS;

    const workspace = await this.workspaceResolver.resolveWorkspace({
      workspaceId: args.workspaceId,
      workspaceName: args.workspaceName
    });

    const results: Array<{ id: string; name: string; entityType: 'task' | 'project' }> = [];
    let mergedTruncation: TruncationInfo | undefined;

    if (entityTypes.includes('tasks')) {
      const { items: tasks, truncation } = await this.motionService.searchTasks(args.query, workspace.id, limit);
      results.push(...tasks.map(task => ({
        id: task.id,
        name: task.name,
        entityType: 'task' as const
      })));
      if (truncation?.wasTruncated && !mergedTruncation) {
        mergedTruncation = { ...truncation };
      }
    }

    if (entityTypes.includes('projects')) {
      const { items: projects, truncation } = await this.motionService.searchProjects(args.query, workspace.id, limit);
      results.push(...projects.map(project => ({
        id: project.id,
        name: project.name,
        entityType: 'project' as const
      })));
      if (truncation?.wasTruncated && !mergedTruncation) {
        mergedTruncation = { ...truncation };
      }
    }

    const slicedResults = results.slice(0, limit);
    if (results.length > limit) {
      // Combined results exceeded limit — report truncation for the combined result
      mergedTruncation = { wasTruncated: true, returnedCount: slicedResults.length, reason: 'max_items', limit };
    } else if (mergedTruncation) {
      // A source was truncated but combined results fit within the limit —
      // update returnedCount to reflect the actual number of results returned
      mergedTruncation.returnedCount = slicedResults.length;
    }

    return formatSearchResults(slicedResults, args.query, {
      limit,
      searchScope: entityTypes.join(',') || 'both',
      truncation: mergedTruncation
    });
  }

  private resolveEntityTypes(args: ContentSearchArgs): Array<'tasks' | 'projects'> {
    if (args.entityTypes && args.entityTypes.length > 0) {
      return Array.from(new Set(args.entityTypes));
    }

    if (args.searchScope === 'tasks') {
      return ['tasks'];
    }

    if (args.searchScope === 'projects') {
      return ['projects'];
    }

    return ['tasks', 'projects'];
  }

}
