import { McpToolResponse } from '../../types/mcp';
import { formatMcpError } from '../../utils';
import { IHandler, HandlerContext, ValidationResult } from './HandlerInterface';

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

  validateArgs(args: unknown): ValidationResult {
    // Base validation - subclasses can override for specific validation
    if (!args || typeof args !== 'object') {
      return {
        valid: false,
        errors: 'Arguments must be a valid object'
      };
    }

    return {
      valid: true
    };
  }
}

// Re-export the required types to avoid circular imports
import { MotionApiService } from '../../services/motionApi';
import { WorkspaceResolver } from '../../utils/workspaceResolver';
import { InputValidator } from '../../utils/validator';