import { McpToolResponse } from '../../types/mcp';
import { MotionApiService } from '../../services/motionApi';
import { WorkspaceResolver } from '../../utils/workspaceResolver';
import { InputValidator } from '../../utils/validator';

export interface ValidationResult {
  valid: boolean;
  errors?: string;
}

export interface HandlerContext {
  motionService: MotionApiService;
  workspaceResolver: WorkspaceResolver;
  validator: InputValidator;
}

export interface IHandler {
  handle(args: unknown): Promise<McpToolResponse>;
  validateArgs(args: unknown): ValidationResult;
}