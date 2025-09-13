import { BaseHandler } from './base/BaseHandler';
import { McpToolResponse } from '../types/mcp';
import { MotionUsersArgs } from '../types/mcp-tool-args';
import { formatMcpSuccess } from '../utils';

export class UserHandler extends BaseHandler {
  async handle(args: MotionUsersArgs): Promise<McpToolResponse> {
    try {
      const { operation, workspaceId, workspaceName } = args;

      switch(operation) {
        case 'list':
          return await this.handleList(workspaceId, workspaceName);
        case 'current':
          return await this.handleGetCurrent();
        default:
          return this.handleUnknownOperation(operation);
      }
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  private async handleList(workspaceId?: string, workspaceName?: string): Promise<McpToolResponse> {
    const workspace = await this.workspaceResolver.resolveWorkspace({ workspaceId, workspaceName });
    const users = await this.motionService.getUsers(workspace.id);

    const userList = users.map(u => `- ${u.name} (${u.email}) [ID: ${u.id}]`).join('\n');
    return formatMcpSuccess(`Users in workspace "${workspace.name}":\n${userList}`);
  }

  private async handleGetCurrent(): Promise<McpToolResponse> {
    const currentUser = await this.motionService.getCurrentUser();
    const userInfo = `Current user: ${currentUser.name || 'No name'} (${currentUser.email}) [ID: ${currentUser.id}]`;
    return formatMcpSuccess(userInfo);
  }
}