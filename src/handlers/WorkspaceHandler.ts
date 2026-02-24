import { BaseHandler } from './base/BaseHandler';
import { McpToolResponse } from '../types/mcp';
import { MotionWorkspacesArgs } from '../types/mcp-tool-args';
import {
  formatWorkspaceList,
  formatDetailResponse
} from '../utils';

export class WorkspaceHandler extends BaseHandler {
  async handle(args: MotionWorkspacesArgs): Promise<McpToolResponse> {
    try {
      const { operation, workspaceId } = args;

      switch(operation) {
        case 'list':
          return await this.handleList();
        case 'get':
          return await this.handleGet(workspaceId);
        default:
          return this.handleUnknownOperation(operation);
      }
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  private async handleList(): Promise<McpToolResponse> {
    const workspaces = await this.motionService.getWorkspaces();
    return formatWorkspaceList(workspaces);
  }

  private async handleGet(workspaceId?: string): Promise<McpToolResponse> {
    if (!workspaceId) {
      return this.handleError(new Error("Workspace ID is required for get operation"));
    }

    const workspaces = await this.motionService.getWorkspaces();
    const workspace = workspaces.find(w => w.id === workspaceId);

    if (!workspace) {
      return this.handleError(new Error(`Workspace not found: ${workspaceId}`));
    }

    return formatDetailResponse(workspace, `Workspace details for "${workspace.name}"`);
  }

}
