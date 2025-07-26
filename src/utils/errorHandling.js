/**
 * Error Handling Utilities - Custom error classes and MCP response formatters
 * 
 * This module provides custom error classes and MCP-compliant error response
 * formatting to ensure consistent error handling across all handlers.
 */

const { ERROR_CODES, MCP_RESPONSE_TYPES } = require('./constants');

/**
 * Base error class for Motion API related errors
 */
class MotionApiError extends Error {
  constructor(message, code = ERROR_CODES.MOTION_API_ERROR, context = {}) {
    super(message);
    this.name = 'MotionApiError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Error class for parameter validation failures
 */
class ValidationError extends Error {
  constructor(message, parameter = null, context = {}) {
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
class WorkspaceError extends Error {
  constructor(message, code = ERROR_CODES.WORKSPACE_NOT_FOUND, context = {}) {
    super(message);
    this.name = 'WorkspaceError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Format an error for MCP protocol response
 * 
 * @param {Error} error - Error object to format
 * @param {Object} context - Additional context for the error
 * @returns {Object} MCP-compliant error response
 */
function formatMcpError(error, context = {}) {
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
 * 
 * @param {string} text - Success message text
 * @returns {Object} MCP-compliant success response
 */
function formatMcpSuccess(text) {
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
 * 
 * @param {string} message - Error message
 * @param {string} code - Error code from ERROR_CODES
 * @param {Object} context - Additional error context
 * @returns {Object} MCP-compliant error response
 */
function createErrorResponse(message, code = ERROR_CODES.INTERNAL_ERROR, context = {}) {
  const error = new MotionApiError(message, code, context);
  return formatMcpError(error, context);
}

module.exports = {
  // Error classes
  MotionApiError,
  ValidationError,
  WorkspaceError,
  
  // Response formatters
  formatMcpError,
  formatMcpSuccess,
  createErrorResponse
};