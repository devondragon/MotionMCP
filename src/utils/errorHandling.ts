/**
 * Error Handling Utilities - Custom error classes and MCP response formatters
 * 
 * This module provides custom error classes and MCP-compliant error response
 * formatting to ensure consistent error handling across all handlers.
 */

import { ERROR_CODES, MCP_RESPONSE_TYPES, ErrorCode } from './constants';
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface ErrorContext {
  [key: string]: any;
}

/**
 * Base error class for Motion API related errors
 */
export class MotionApiError extends Error {
  public readonly code: ErrorCode;
  public readonly context: ErrorContext;

  constructor(message: string, code: ErrorCode = ERROR_CODES.MOTION_API_ERROR, context: ErrorContext = {}) {
    super(message);
    this.name = 'MotionApiError';
    this.code = code;
    this.context = context;
  }
}

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
 * Type guard to check if an error has an error code
 */
export function isCodedError(error: unknown): error is { code: ErrorCode; context: ErrorContext } {
  return (
    error instanceof MotionApiError ||
    error instanceof ValidationError ||
    error instanceof WorkspaceError
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

/**
 * Format an error for MCP protocol response with full context
 */
export function formatMcpError(error: Error | unknown, additionalContext: ErrorContext = {}): CallToolResult {
  const { message, code, context } = extractErrorInfo(error);
  const errorMessage = message || 'An unknown error occurred';
  const errorContext: ErrorContext = { ...context, ...additionalContext };

  // Add parameter info for validation errors
  if (error instanceof ValidationError && error.parameter) {
    errorContext.parameter = error.parameter;
  }

  // Build error message
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

/**
 * Create a standardized error response with context
 */
export function createErrorResponse(
  message: string, 
  code: ErrorCode = ERROR_CODES.INTERNAL_ERROR, 
  context: ErrorContext = {}
): CallToolResult {
  const error = new MotionApiError(message, code, context);
  return formatMcpError(error, context);
}