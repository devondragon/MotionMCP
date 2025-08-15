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
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  RETRY_EXHAUSTED: 'RETRY_EXHAUSTED',
  
  // General errors
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// Workspace types
export const WORKSPACE_TYPES = {
  PERSONAL: 'personal',
  TEAM: 'team',
  UNKNOWN: 'unknown'
} as const;

export type WorkspaceType = typeof WORKSPACE_TYPES[keyof typeof WORKSPACE_TYPES];

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

// Retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_BACKOFF_MS: 250,
  MAX_BACKOFF_MS: 30000, // 30 seconds max
  JITTER_FACTOR: 0.2, // 20% jitter
  BACKOFF_MULTIPLIER: 2
} as const;

// Cache TTL configuration (in seconds)
export const CACHE_TTL = {
  WORKSPACES: 600,    // 10 minutes
  USERS: 600,         // 10 minutes
  PROJECTS: 300,      // 5 minutes
  COMMENTS: 60,       // 1 minute
  CUSTOM_FIELDS: 600,  // 10 minutes
  RECURRING_TASKS: 300, // 5 minutes (same as projects)
  SCHEDULES: 300      // 5 minutes (schedule data changes frequently)
} as const;

// Cache TTL conversion factor
export const CACHE_TTL_MS_MULTIPLIER = 1000; // Convert seconds to milliseconds

// Content limits and validation
export const LIMITS = {
  COMMENT_MAX_LENGTH: 5000,      // Maximum comment length in characters
  COMMENT_DISPLAY_LENGTH: 120,   // Maximum length for display before truncation
  CUSTOM_FIELD_NAME_MAX_LENGTH: 255,  // Maximum custom field name length
  CUSTOM_FIELD_OPTIONS_MAX_COUNT: 100 // Maximum number of options for select fields
} as const;

// Logging levels for MCP compliance
export const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info', 
  WARN: 'warn',
  ERROR: 'error'
} as const;

export type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];

// Null vs Undefined Policy
export const NULL_UNDEFINED_POLICY = {
  // Use undefined for:
  // - Optional parameters that weren't provided
  // - Missing object properties
  // - Function returns when item not found
  // - Uninitialized values
  
  // Use null for:
  // - Explicit absence of value from API
  // - Database null values
  // - Cleared/reset state (e.g., cache reset)
  // - Values that need to be explicitly sent as null to external APIs
} as const;

// Helper to convert undefined to null for API compatibility
export function convertUndefinedToNull<T extends Record<string, any>>(obj: T): T {
  const result = { ...obj };
  for (const key in result) {
    if (result[key] === undefined) {
      (result as any)[key] = null;
    }
  }
  return result;
}

// Helper to convert null to undefined for internal consistency
export function convertNullToUndefined<T extends Record<string, any>>(obj: T): T {
  const result = { ...obj };
  for (const key in result) {
    if (result[key] === null) {
      delete result[key]; // This makes it undefined
    }
  }
  return result;
}