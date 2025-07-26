/**
 * Shared constants and error codes for Motion MCP Server utilities
 */

// Error codes for different types of failures
const ERROR_CODES = {
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
};

// MCP response types
const MCP_RESPONSE_TYPES = {
  TEXT: 'text',
  JSON: 'json'
};

// Default values for common parameters
const DEFAULTS = {
  WORKSPACE_FALLBACK_TO_DEFAULT: true,
  WORKSPACE_VALIDATE_ACCESS: false,
  WORKSPACE_USE_CACHE: true,
  
  // Search defaults
  SEARCH_LIMIT: 20,
  SEARCH_SCOPE: 'both',
  
  // Suggestion defaults
  MAX_SUGGESTIONS: 5,
  
  // Workload analysis defaults
  TIMEFRAME: 'this_week',
  INCLUDE_PROJECTS: true
};

// Logging levels for MCP compliance
const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info', 
  WARN: 'warn',
  ERROR: 'error'
};

module.exports = {
  ERROR_CODES,
  MCP_RESPONSE_TYPES,
  DEFAULTS,
  LOG_LEVELS
};