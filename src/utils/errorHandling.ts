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
 * Format an error for MCP protocol response
 */
export function formatMcpError(error: Error | MotionApiError, _context: ErrorContext = {}): CallToolResult {
  const errorMessage = error.message || 'An unknown error occurred';
  
  return {
    content: [
      {
        type: MCP_RESPONSE_TYPES.TEXT,
        text: `Error: ${errorMessage}`
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