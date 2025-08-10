/**
 * Shared constants and error codes for Motion MCP Server utilities
 */

// Error codes for different types of failures
export const ERROR_CODES = {
  // Workspace related errors
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  WORKSPACE_ACCESS_DENIED: 'WORKSPACE_ACCESS_DENIED',
  NO_DEFAULT_WORKSPACE: 'NO_DEFAULT_WORKSPACE',
  
  // Validation errors
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  MISSING_REQUIRED_PARAM: 'MISSING_REQUIRED_PARAM',
  
  // API related errors
  MOTION_API_ERROR: 'MOTION_API_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  
  // General errors
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// MCP response types
export const MCP_RESPONSE_TYPES = {
  TEXT: 'text',
  JSON: 'json'
} as const;

export type McpResponseType = typeof MCP_RESPONSE_TYPES[keyof typeof MCP_RESPONSE_TYPES];

// Default values for common parameters
export const DEFAULTS = {
  WORKSPACE_FALLBACK_TO_DEFAULT: true,
  WORKSPACE_VALIDATE_ACCESS: false,
  WORKSPACE_USE_CACHE: true,
  
  // Search defaults
  SEARCH_LIMIT: 20,
  SEARCH_SCOPE: 'both' as 'both' | 'tasks' | 'projects',
  
  // Suggestion defaults
  MAX_SUGGESTIONS: 5,
  
  // Workload analysis defaults
  TIMEFRAME: 'this_week' as 'today' | 'this_week' | 'this_month',
  INCLUDE_PROJECTS: true
} as const;

// Logging levels for MCP compliance
export const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info', 
  WARN: 'warn',
  ERROR: 'error'
} as const;

export type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];