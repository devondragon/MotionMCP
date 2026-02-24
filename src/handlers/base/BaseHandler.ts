import { MotionApiService } from '../../services/motionApi';
import { WorkspaceResolver } from '../../utils/workspaceResolver';
import { InputValidator } from '../../utils/validator';
import { McpToolResponse } from '../../types/mcp';
import { formatMcpError } from '../../utils';
import { IHandler, HandlerContext } from './HandlerInterface';

export abstract class BaseHandler implements IHandler {
  protected motionService: MotionApiService;
  protected workspaceResolver: WorkspaceResolver;
  protected validator: InputValidator;

  constructor(context: HandlerContext) {
    this.motionService = context.motionService;
    this.workspaceResolver = context.workspaceResolver;
    this.validator = context.validator;
  }

  abstract handle(args: unknown): Promise<McpToolResponse>;

  protected handleError(error: unknown): McpToolResponse {
    return formatMcpError(error instanceof Error ? error : new Error(String(error)));
  }

  protected handleUnknownOperation(operation: string): McpToolResponse {
    return formatMcpError(new Error(`Unknown operation: ${operation}`));
  }
}
