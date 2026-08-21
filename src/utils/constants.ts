/**
 * Shared constants and error codes for Motion MCP Server utilities
 */

// Error codes for different types of failures
export const ERROR_CODES = {
  // Workspace related errors
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  WORKSPACE_ACCESS_DENIED: 'WORKSPACE_ACCESS_DENIED',
  NO_DEFAULT_WORKSPACE: 'NO_DEFAULT_WORKSPACE',
  
  // Auth/access errors
  AUTH_FAILED: 'AUTH_FAILED',         // 401 – invalid or missing credentials
  ACCESS_DENIED: 'ACCESS_DENIED',    // 403 – valid credentials, insufficient permissions

  // Validation errors
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  MISSING_REQUIRED_PARAM: 'MISSING_REQUIRED_PARAM',
  INVALID_PRIORITY: 'INVALID_PRIORITY',
  INVALID_DATE_FORMAT: 'INVALID_DATE_FORMAT',
  
  // Resource errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',

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

// MCP response types
export const MCP_RESPONSE_TYPES = {
  TEXT: 'text',
  JSON: 'json'
} as const;

// Default values for common parameters
export const DEFAULTS = {
  WORKSPACE_FALLBACK_TO_DEFAULT: true,
  WORKSPACE_VALIDATE_ACCESS: false,
} as const;

// Retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_BACKOFF_MS: 250,
  MAX_BACKOFF_MS: 30000, // 30 seconds max
  JITTER_FACTOR: 0.2, // 20% jitter
  BACKOFF_MULTIPLIER: 2
} as const;

// API client configuration
export const API_CONFIG = {
  TIMEOUT_MS: 30000,           // 30 seconds - request timeout
  CONNECT_TIMEOUT_MS: 10000    // 10 seconds - connection establishment timeout
} as const;

// Cache TTL configuration (in seconds)
export const CACHE_TTL = {
  WORKSPACES: 600,    // 10 minutes
  USERS: 600,         // 10 minutes
  PROJECTS: 300,      // 5 minutes
  COMMENTS: 60,       // 1 minute
  CUSTOM_FIELDS: 600,  // 10 minutes
  RECURRING_TASKS: 300, // 5 minutes (same as projects)
  SCHEDULES: 300,      // 5 minutes (schedule data changes frequently)
  STATUSES: 600        // 10 minutes (same as workspaces)
} as const;

// Content limits and validation
export const LIMITS = {
  COMMENT_MAX_LENGTH: 5000,      // Maximum comment length in characters
  COMMENT_DISPLAY_LENGTH: 120,   // Maximum length for display before truncation
  CUSTOM_FIELD_NAME_MAX_LENGTH: 255,  // Maximum custom field name length
  CUSTOM_FIELD_OPTIONS_MAX_COUNT: 100, // Maximum number of options for select fields
  
  // Pagination limits to prevent resource exhaustion
  DEFAULT_PAGE_SIZE: 50,         // Default number of items per page
  MAX_PAGE_SIZE: 200,           // Maximum allowed page size
  MAX_PAGES: 10,                // Maximum number of pages to fetch
  ABSOLUTE_MAX_PAGES: 50,       // Absolute maximum pages to prevent infinite loops
  MAX_SEARCH_RESULTS: 100,      // Maximum search results to return
  MAX_SEARCH_FETCH: 300         // Maximum items to fetch per source when overfetching for client-side search filtering
} as const;

// Logging levels for MCP compliance
export const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info', 
  WARN: 'warn',
  ERROR: 'error'
} as const;

export type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];

/**
 * Creates a minimal payload by removing null, undefined, and empty values
 * This prevents API validation errors from unexpected fields
 * @param obj - The object to minimize
 * @returns Clean object with only meaningful values
 */
export function createMinimalPayload<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {};

  for (const key in obj) {
    const value = obj[key];

    // Skip undefined and empty strings only.
    // Preserve null (API may distinguish absent vs null, e.g., autoScheduled: null).
    // Preserve empty arrays (e.g., labels: [] to clear all labels).
    if (value === undefined || value === '') {
      continue;
    }

    // Skip empty objects (but preserve objects with properties)
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0) {
      continue;
    }

    result[key] = value;
  }

  return result;
}

// Valid priority levels for Motion tasks
export const VALID_PRIORITIES = ['ASAP', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type ValidPriority = typeof VALID_PRIORITIES[number];

// Helper to validate priority values
export function isValidPriority(priority: string): priority is ValidPriority {
  return VALID_PRIORITIES.includes(priority as ValidPriority);
}

/**
 * Current calendar date (YYYY-MM-DD) in the given IANA zone.
 * Falls back to UTC when no zone is given or the runtime rejects it —
 * identical to the pre-zone-aware behavior, so failure cannot regress anything.
 */
function currentDateInZone(timeZone?: string): string {
  if (timeZone) {
    try {
      // en-CA formats as YYYY-MM-DD
      return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
    } catch {
      // fall through to UTC
    }
  }
  return new Date().toISOString().split('T')[0]!;
}

/** Shift a YYYY-MM-DD calendar date by whole days. Pure calendar arithmetic — DST-immune. */
function shiftCalendarDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().split('T')[0]!;
}

/**
 * Helper to parse and validate date formats.
 *
 * Relative keywords (today/tomorrow/yesterday) resolve against the given IANA
 * zone when supplied — without one they resolve against UTC, which in a zone
 * ahead of UTC yields *yesterday's* local date between local midnight and the
 * UTC day boundary (e.g. 00:00–05:29 in Asia/Kolkata).
 */
export function parseFilterDate(dateInput: string, timeZone?: string): string | null {
  if (!dateInput) return null;

  // Handle relative dates
  const normalizedInput = dateInput.toLowerCase().trim();

  switch (normalizedInput) {
    case 'today':
      return currentDateInZone(timeZone);
    case 'tomorrow':
      return shiftCalendarDate(currentDateInZone(timeZone), 1);
    case 'yesterday':
      return shiftCalendarDate(currentDateInZone(timeZone), -1);
  }

  // Validate YYYY-MM-DD format
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (datePattern.test(dateInput)) {
    const parsedDate = new Date(dateInput + 'T00:00:00Z');
    if (!isNaN(parsedDate.getTime())) {
      return dateInput;
    }
  }

  return null;
}
