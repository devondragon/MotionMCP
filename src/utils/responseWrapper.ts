/**
 * Motion API Response Wrapper Utility
 * 
 * Handles the inconsistent response patterns across Motion API endpoints:
 * - Some return wrapped responses: { meta: {...}, [resource]: [...] }
 * - Others return direct arrays: [...]
 * 
 * This utility provides type-safe unwrapping with proper pagination support.
 */

import { MotionPaginationMeta } from '../types/motion';
import { mcpLog } from './logger';
import { LOG_LEVELS } from './constants';

/**
 * Standard unwrapped response structure for consistent internal handling
 */
export interface UnwrappedResponse<T> {
  data: T[];
  meta?: MotionPaginationMeta;
}

/**
 * Configuration for each API endpoint's response pattern
 */
interface ApiResponseConfig {
  isWrapped: boolean;
  resourceKey?: string;
  apiName: string;
}

/**
 * Known API response patterns based on current codebase evidence and task documentation
 */
const API_RESPONSE_PATTERNS: Record<string, ApiResponseConfig> = {
  // Wrapped responses (with meta pagination)
  tasks: { 
    isWrapped: true, 
    resourceKey: 'tasks', 
    apiName: 'Tasks' 
  },
  projects: { 
    isWrapped: true, 
    resourceKey: 'projects', 
    apiName: 'Projects' 
  },
  comments: { 
    isWrapped: true, 
    resourceKey: 'comments', 
    apiName: 'Comments' 
  },
  'recurring-tasks': { 
    isWrapped: true, 
    resourceKey: 'tasks', // Note: recurring tasks API returns { meta, tasks } not { meta, recurringTasks }
    apiName: 'Recurring Tasks' 
  },
  'custom-fields': { 
    isWrapped: true, 
    resourceKey: 'customFields', 
    apiName: 'Custom Fields' 
  },
  
  // Direct array responses (no wrapper)
  schedules: { 
    isWrapped: false, 
    apiName: 'Schedules' 
  },
  statuses: { 
    isWrapped: false, 
    apiName: 'Statuses' 
  },
  workspaces: { 
    isWrapped: false, 
    apiName: 'Workspaces' 
  },
  users: { 
    isWrapped: false, // TODO: Verify this - may be wrapped with 'users' key
    apiName: 'Users' 
  }
};

/**
 * Unwraps a Motion API response based on the known patterns
 * 
 * @param response - The raw API response data
 * @param apiEndpoint - The API endpoint name (e.g., 'tasks', 'projects', 'comments')
 * @returns Standardized unwrapped response with data array and optional meta
 */
export function unwrapApiResponse<T = unknown>(
  response: unknown,
  apiEndpoint: string
): UnwrappedResponse<T> {
  const config = API_RESPONSE_PATTERNS[apiEndpoint];
  
  if (!config) {
    mcpLog(LOG_LEVELS.WARN, `Unknown API endpoint pattern: ${apiEndpoint}`, {
      endpoint: apiEndpoint,
      availablePatterns: Object.keys(API_RESPONSE_PATTERNS)
    });
    // Fallback: try to extract array from common patterns
    return fallbackUnwrap<T>(response, apiEndpoint);
  }

  if (config.isWrapped) {
    return unwrapWrappedResponse<T>(response, config);
  } else {
    return unwrapDirectResponse<T>(response, config);
  }
}

/**
 * Unwraps a wrapped response: { meta: {...}, [resourceKey]: [...] }
 */
function unwrapWrappedResponse<T>(
  response: unknown,
  config: ApiResponseConfig
): UnwrappedResponse<T> {
  if (!response || typeof response !== 'object') {
    mcpLog(LOG_LEVELS.WARN, `Expected wrapped response object for ${config.apiName}`, {
      receivedType: typeof response,
      response
    });
    return { data: [] };
  }

  const responseObj = response as Record<string, unknown>;
  const resourceKey = config.resourceKey!;
  const data = responseObj[resourceKey];
  const meta = responseObj.meta;

  if (!Array.isArray(data)) {
    mcpLog(LOG_LEVELS.WARN, `Expected array for ${resourceKey} in ${config.apiName} response`, {
      resourceKey,
      receivedType: typeof data,
      hasMetaField: !!meta,
      responseKeys: Object.keys(responseObj)
    });
    return { data: [] };
  }

  return {
    data,
    meta: meta && typeof meta === 'object' ? meta as MotionPaginationMeta : undefined
  };
}

/**
 * Unwraps a direct array response: [...]
 */
function unwrapDirectResponse<T>(
  response: unknown,
  config: ApiResponseConfig
): UnwrappedResponse<T> {
  if (!Array.isArray(response)) {
    mcpLog(LOG_LEVELS.WARN, `Expected direct array response for ${config.apiName}`, {
      receivedType: typeof response,
      response
    });
    return { data: [] };
  }

  return { data: response };
}

/**
 * Fallback unwrapping logic for unknown endpoints
 * Attempts to handle both wrapped and direct patterns
 */
function fallbackUnwrap<T>(
  response: unknown,
  apiEndpoint: string
): UnwrappedResponse<T> {
  // Case 1: Direct array
  if (Array.isArray(response)) {
    mcpLog(LOG_LEVELS.DEBUG, `Fallback: treating ${apiEndpoint} as direct array`, {
      itemCount: response.length
    });
    return { data: response };
  }

  // Case 2: Wrapped response - try common resource keys
  if (response && typeof response === 'object') {
    const responseObj = response as Record<string, unknown>;
    const possibleKeys = ['items', 'tasks', 'projects', 'comments', 'users', 'workspaces', 'schedules', 'statuses', 'customFields'];
    
    for (const key of possibleKeys) {
      if (Array.isArray(responseObj[key])) {
        mcpLog(LOG_LEVELS.DEBUG, `Fallback: found array at ${key} for ${apiEndpoint}`, {
          key,
          itemCount: (responseObj[key] as unknown[]).length,
          hasMeta: !!responseObj.meta
        });
        return {
          data: responseObj[key] as T[],
          meta: responseObj.meta as MotionPaginationMeta | undefined
        };
      }
    }
    
    mcpLog(LOG_LEVELS.WARN, `Fallback: no array found in object response for ${apiEndpoint}`, {
      responseKeys: Object.keys(responseObj)
    });
  }

  // Case 3: Unexpected response
  mcpLog(LOG_LEVELS.ERROR, `Fallback: unexpected response format for ${apiEndpoint}`, {
    responseType: typeof response,
    response
  });
  
  return { data: [] };
}

/**
 * Checks if an API endpoint supports pagination based on known patterns
 */
export function supportsPagination(apiEndpoint: string): boolean {
  const config = API_RESPONSE_PATTERNS[apiEndpoint];
  return config?.isWrapped || false;
}

/**
 * Gets the expected resource key for a wrapped API response
 */
export function getResourceKey(apiEndpoint: string): string | undefined {
  const config = API_RESPONSE_PATTERNS[apiEndpoint];
  return config?.resourceKey;
}

/**
 * Updates the known pattern for an API endpoint (for runtime discovery)
 */
export function updateApiPattern(
  apiEndpoint: string, 
  isWrapped: boolean, 
  resourceKey?: string
): void {
  API_RESPONSE_PATTERNS[apiEndpoint] = {
    isWrapped,
    resourceKey,
    apiName: apiEndpoint
  };
  
  mcpLog(LOG_LEVELS.INFO, `Updated API pattern for ${apiEndpoint}`, {
    endpoint: apiEndpoint,
    isWrapped,
    resourceKey
  });
}