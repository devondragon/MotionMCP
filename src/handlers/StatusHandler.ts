import { BaseHandler } from './base/BaseHandler';
import { McpToolResponse } from '../types/mcp';
import { MotionStatusesArgs } from '../types/mcp-tool-args';
import { formatStatusList } from '../utils';

export class StatusHandler extends BaseHandler {
  async handle(args: MotionStatusesArgs): Promise<McpToolResponse> {
    try {
      const { workspaceId } = args;
      return await this.handleList(workspaceId);
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  private async handleList(workspaceId?: string): Promise<McpToolResponse> {
    const statuses = await this.motionService.getStatuses(workspaceId);
    return formatStatusList(statuses);
  }
}