/**
 * Error Utilities - Custom error classes, type guards, and MCP response formatters
 *
 * Consolidates the full error pipeline: error classes (ValidationError, WorkspaceError,
 * UserFacingError), type guards, MCP response formatting, and user-facing error factories.
 */

import { isAxiosError } from 'axios';
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ERROR_CODES, MCP_RESPONSE_TYPES, ErrorCode, LOG_LEVELS, LogLevel } from './constants';
import { mcpLog } from './logger';

// Generic open-ended context for attaching debug metadata to errors.
// Used by ValidationError, WorkspaceError, and extractErrorInfo.
// See also ApiErrorContext below — a structured shape used only by the
// user-facing error factories to build human-readable messages.
interface ErrorContext {
  [key: string]: any;
}

// ─── Error Classes ──────────────────────────────────────────────────────────

/**
 * Error class for parameter validation failures
 */
export class ValidationError extends Error {
  public readonly code: ErrorCode;
  public readonly parameter: string | null;
  public readonly context: ErrorContext;

  constructor(message: string, parameter: string | null = null, context: ErrorContext = {}) {
    super(message);
    this.name = 'ValidationError';
    this.code = ERROR_CODES.INVALID_PARAMETERS;
    this.parameter = parameter;
    this.context = context;
  }
}

/**
 * Error class for workspace-specific issues
 */
export class WorkspaceError extends Error {
  public readonly code: ErrorCode;
  public readonly context: ErrorContext;

  constructor(message: string, code: ErrorCode = ERROR_CODES.WORKSPACE_NOT_FOUND, context: ErrorContext = {}) {
    super(message);
    this.name = 'WorkspaceError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Error context for categorizing API errors
 */
interface ApiErrorContext {
  action: string;
  resourceType?: 'task' | 'project' | 'workspace' | 'user' | 'comment' | 'custom field' | 'recurring task' | 'schedule' | 'status';
  resourceId?: string;
  resourceName?: string;
}

/**
 * Maps HTTP status codes to ErrorCode values
 */
function httpStatusToErrorCode(statusCode?: number): ErrorCode {
  if (!statusCode) return ERROR_CODES.INTERNAL_ERROR;
  if (statusCode === 401) return ERROR_CODES.AUTH_FAILED;
  if (statusCode === 403) return ERROR_CODES.ACCESS_DENIED;
  if (statusCode === 404) return ERROR_CODES.RESOURCE_NOT_FOUND;
  if (statusCode === 400 || statusCode === 422) return ERROR_CODES.INVALID_PARAMETERS;
  if (statusCode === 429) return ERROR_CODES.RATE_LIMIT_EXCEEDED;
  if (statusCode >= 500) return ERROR_CODES.MOTION_API_ERROR;
  return ERROR_CODES.INTERNAL_ERROR;
}

/**
 * Error class that contains both user-friendly and technical messages
 */
export class UserFacingError extends Error {
  public readonly code: ErrorCode;
  public readonly userMessage: string;
  public readonly technicalMessage: string;
  public readonly originalError?: Error;
  public readonly statusCode?: number;
  public readonly context: Record<string, unknown>;

  constructor(
    userMessage: string,
    technicalMessage: string,
    originalError?: Error,
    context?: Record<string, unknown>,
    /**
     * Optional HTTP status code. When provided, overrides any status code that
     * would otherwise be extracted from originalError. Use only when the caller
     * has already extracted and validated the status (e.g. createUserFacingError).
     */
    statusCode?: number
  ) {
    super(userMessage);
    this.name = 'UserFacingError';
    this.userMessage = userMessage;
    this.technicalMessage = technicalMessage;
    this.originalError = originalError;
    this.context = context ?? {};

    // Use explicit statusCode if provided, otherwise extract from axios errors
    if (statusCode !== undefined) {
      this.statusCode = statusCode;
    } else if (originalError && isAxiosError(originalError)) {
      this.statusCode = originalError.response?.status;
    }
    this.code = httpStatusToErrorCode(this.statusCode);

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UserFacingError);
    }
  }

  /**
   * Log this error with full details
   */
  log(level: LogLevel = LOG_LEVELS.ERROR): void {
    mcpLog(level, this.userMessage, {
      technicalMessage: this.technicalMessage,
      statusCode: this.statusCode,
      originalError: this.originalError?.message,
      context: this.context
    });
  }
}

// ─── Type Guards and Extractors ─────────────────────────────────────────────

/**
 * Type guard to check if an error has an error code
 */
export function isCodedError(error: unknown): error is ValidationError | WorkspaceError | UserFacingError {
  return (
    error instanceof ValidationError ||
    error instanceof WorkspaceError ||
    error instanceof UserFacingError
  );
}

/**
 * Extract error information from any error type
 */
export function extractErrorInfo(error: unknown): { message: string; code: ErrorCode; context: ErrorContext } {
  if (error instanceof Error) {
    if (isCodedError(error)) {
      return {
        message: error.message,
        code: error.code,
        context: error.context
      };
    }
    return {
      message: error.message,
      code: ERROR_CODES.INTERNAL_ERROR,
      context: {}
    };
  }
  return {
    message: String(error),
    code: ERROR_CODES.INTERNAL_ERROR,
    context: {}
  };
}

// ─── MCP Response Formatters ────────────────────────────────────────────────

/**
 * Format an error for MCP protocol response
 */
export function formatMcpError(error: Error | unknown): CallToolResult {
  // For UserFacingError, message is the user-friendly text (not technicalMessage)
  const { message, code } = extractErrorInfo(error);
  const errorMessage = message || 'An unknown error occurred';
  const errorText = `Error [${code}]: ${errorMessage}`;

  return {
    content: [
      {
        type: MCP_RESPONSE_TYPES.TEXT,
        text: errorText
      }
    ],
    isError: true
  };
}

/**
 * Format a success response for MCP protocol
 */
export function formatMcpSuccess(text: string): CallToolResult {
  return {
    content: [
      {
        type: MCP_RESPONSE_TYPES.TEXT,
        text
      }
    ]
  };
}

// ─── User-Facing Error Factories ────────────────────────────────────────────

/**
 * Maps HTTP status codes to user-friendly messages
 */
const STATUS_CODE_MESSAGES: Record<number, string> = {
  400: 'The request was invalid. Please check your input and try again.',
  401: 'Authentication failed. Please check your API key configuration.',
  403: 'You don\'t have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'This action conflicts with the current state. The resource may have been modified.',
  422: 'The data provided cannot be processed. Please check the format and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Motion server encountered an error. Please try again later.',
  502: 'Unable to connect to Motion servers. Please check your internet connection.',
  503: 'Motion service is temporarily unavailable. Please try again in a few moments.',
  504: 'Request timed out. Please try again.'
};

/**
 * Maps action types to user-friendly action descriptions
 */
const ACTION_DESCRIPTIONS: Record<string, string> = {
  'fetch': 'load',
  'create': 'create',
  'update': 'update',
  'delete': 'delete',
  'move': 'move',
  'unassign': 'unassign',
  'search': 'search for',
  'resolve': 'find',
  'list': 'retrieve'
};

/**
 * Builds a user-friendly message based on context and status
 */
function buildUserMessage(
  context: ApiErrorContext,
  statusCode?: number,
  apiMessage?: string
): string {
  const action = ACTION_DESCRIPTIONS[context.action] || context.action;
  const resource = context.resourceType || 'resource';
  const resourceInfo = context.resourceName
    ? ` "${context.resourceName}"`
    : context.resourceId
      ? ` (ID: ${context.resourceId})`
      : '';

  // Check for specific status code messages
  if (statusCode && STATUS_CODE_MESSAGES[statusCode]) {
    // For auth errors, lead with permission context
    if (statusCode === 401 || statusCode === 403) {
      return `${STATUS_CODE_MESSAGES[statusCode]} Unable to ${action} ${resource}${resourceInfo}.`;
    }
    return `Unable to ${action} ${resource}${resourceInfo}. ${STATUS_CODE_MESSAGES[statusCode]}`;
  }

  // Check for common error patterns in API messages
  if (apiMessage) {
    // Network/connection errors
    if (apiMessage.toLowerCase().includes('network') ||
        apiMessage.toLowerCase().includes('connection')) {
      return `Unable to ${action} ${resource}${resourceInfo}. Please check your internet connection and try again.`;
    }

    // Validation errors
    if (apiMessage.toLowerCase().includes('validation') ||
        apiMessage.toLowerCase().includes('invalid')) {
      return `Unable to ${action} ${resource}${resourceInfo}. ${apiMessage}`;
    }
  }

  // Generic message
  return `Unable to ${action} ${resource}${resourceInfo}. Please try again or contact support if the problem persists.`;
}

/**
 * Creates a user-facing error with both user-friendly and technical messages
 */
export function createUserFacingError(
  error: unknown,
  context: ApiErrorContext
): UserFacingError {
  // Get technical message
  const technicalMessage = error instanceof Error ? error.message : String(error);

  // Extract status code
  let statusCode: number | undefined;
  let apiMessage: string | undefined;

  if (isAxiosError(error)) {
    statusCode = error.response?.status;
    apiMessage = error.response?.data?.message;
  }

  // Build user-friendly message
  const userMessage = buildUserMessage(context, statusCode, apiMessage);

  // Create the error
  const userError = new UserFacingError(
    userMessage,
    technicalMessage,
    error instanceof Error ? error : undefined,
    {
      action: context.action,
      resourceType: context.resourceType,
      resourceId: context.resourceId,
      resourceName: context.resourceName
    },
    statusCode
  );

  // Log the error
  userError.log();

  return userError;
}

/**
 * Helper to create error context
 */
export function createErrorContext(
  action: string,
  resourceType?: ApiErrorContext['resourceType'],
  resourceId?: string,
  resourceName?: string
): ApiErrorContext {
  return {
    action,
    resourceType,
    resourceId,
    resourceName
  };
}
