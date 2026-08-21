import { BaseHandler } from './base/BaseHandler';
import { McpToolResponse } from '../types/mcp';
import { MotionStatusesArgs } from '../types/mcp-tool-args';
import { formatStatusList } from '../utils';

export class StatusHandler extends BaseHandler {
  async handle(args: MotionStatusesArgs): Promise<McpToolResponse> {
    try {
      return await this.handleList(args);
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  private async handleList(args: MotionStatusesArgs): Promise<McpToolResponse> {
    // Resolve a workspace name to its ID when provided; a bare workspaceId is used
    // as-is, and omitting both returns statuses across all workspaces.
    let workspaceId = args.workspaceId;
    if (!workspaceId && args.workspaceName) {
      const workspace = await this.workspaceResolver.resolveWorkspace({
        workspaceName: args.workspaceName
      });
      workspaceId = workspace.id;
    }

    const statuses = await this.motionService.getStatuses(workspaceId);
    return formatStatusList(statuses);
  }
}
