/**
 * User-Friendly Error Handling
 *
 * This module provides user-friendly error messages while preserving
 * technical details for logging and debugging.
 */

import { isAxiosError } from 'axios';
import { mcpLog } from './logger';
import { LOG_LEVELS, LogLevel } from './constants';

/**
 * Error class that contains both user-friendly and technical messages
 */
export class UserFacingError extends Error {
  public readonly userMessage: string;
  public readonly technicalMessage: string;
  public readonly originalError?: Error;
  public readonly statusCode?: number;
  public readonly context?: Record<string, unknown>;

  constructor(
    userMessage: string,
    technicalMessage: string,
    originalError?: Error,
    context?: Record<string, unknown>
  ) {
    super(userMessage);
    this.name = 'UserFacingError';
    this.userMessage = userMessage;
    this.technicalMessage = technicalMessage;
    this.originalError = originalError;
    this.context = context;

    // Extract status code from axios errors
    if (originalError && isAxiosError(originalError)) {
      this.statusCode = originalError.response?.status;
    }

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UserFacingError);
    }
  }

  /**
   * Get a comprehensive error message for logging
   */
  getFullMessage(): string {
    return `${this.userMessage} (Technical: ${this.technicalMessage})`;
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

/**
 * Error context for categorizing errors
 */
interface ErrorContext {
  action: string;
  resourceType?: 'task' | 'project' | 'workspace' | 'user' | 'comment' | 'custom field' | 'recurring task' | 'schedule' | 'status';
  resourceId?: string;
  resourceName?: string;
}

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
 * Creates a user-friendly error message from an action and error
 */
export function createUserFacingError(
  error: unknown,
  context: ErrorContext
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
  let userMessage = buildUserMessage(context, statusCode, apiMessage);

  // Create the error
  const userError = new UserFacingError(
    userMessage,
    technicalMessage,
    error instanceof Error ? error : undefined,
    {
      action: context.action,
      resourceType: context.resourceType,
      resourceId: context.resourceId,
      resourceName: context.resourceName,
      statusCode
    }
  );

  // Log the error
  userError.log();

  return userError;
}

/**
 * Builds a user-friendly message based on context and status
 */
function buildUserMessage(
  context: ErrorContext,
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
    // For 404, provide more specific message
    if (statusCode === 404) {
      return `Unable to ${action} ${resource}${resourceInfo}. ${STATUS_CODE_MESSAGES[statusCode]}`;
    }
    // For auth errors, provide specific guidance
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
 * Formats an error for MCP response with user-friendly message
 */
export function formatUserFacingErrorForMcp(error: unknown): string {
  if (error instanceof UserFacingError) {
    return error.userMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Helper to create error context
 */
export function createErrorContext(
  action: string,
  resourceType?: ErrorContext['resourceType'],
  resourceId?: string,
  resourceName?: string
): ErrorContext {
  return {
    action,
    resourceType,
    resourceId,
    resourceName
  };
}
