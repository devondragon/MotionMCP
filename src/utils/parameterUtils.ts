/**
 * Parameter Utilities - Parameter parsing and validation helpers
 * 
 * This module provides utilities for parsing, validating, and setting
 * default values for MCP handler parameters, reducing duplication and
 * ensuring consistent parameter handling.
 */

import { parseFilterDate } from './constants';
import { ValidationError } from './errors';
import { sanitizeName, sanitizeDescription } from './sanitize';

interface WorkspaceArgs {
  workspaceId?: string;
  workspaceName?: string;
}

interface TaskArgs extends WorkspaceArgs {
  name?: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  status?: string;
  priority?: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate?: string;
  duration?: string | number;
  labels?: string[];
  assigneeId?: string;
  autoScheduled?: Record<string, unknown> | null;
}

interface ProjectArgs extends WorkspaceArgs {
  name?: string;
  description?: string;
}

/**
 * Parse workspace-related arguments from MCP request
 */
export function parseWorkspaceArgs(args: Record<string, unknown> = {}): WorkspaceArgs {
  return {
    workspaceId: (args.workspaceId as string) || undefined,
    workspaceName: args.workspaceName ? sanitizeName(args.workspaceName as string) : undefined
  };
}

/**
 * Parse autoScheduled parameter to handle various input formats
 *
 * Supported formats:
 * - undefined → undefined (field not provided)
 * - null → null (explicitly disable auto-scheduling)
 * - true / 'true' → {} (enable but require schedule)
 * - false / 'false' → null (disable auto-scheduling)
 * - string (non-empty) → { schedule: string } (schedule name)
 * - object → passed through as-is
 * - numbers (0, 1, -1, etc.) → undefined (invalid type, field not provided)
 *
 * @param value - The autoScheduled value from MCP request
 * @returns Proper autoScheduled value for Motion API, or undefined for invalid types
 */
export function parseAutoScheduledParam(value: unknown): Record<string, unknown> | null | undefined {
  // If undefined, leave as undefined (field not provided)
  if (value === undefined) {
    return undefined;
  }

  // If null, keep as null (explicitly disable auto-scheduling)
  if (value === null) {
    return null;
  }

  // If it's already an object, use it as-is
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }

  // If it's a non-empty string, check if it's a JSON object first, then treat as schedule name
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    // If it's 'false', disable auto-scheduling
    if (trimmed === 'false') {
      return null;
    }
    // If it's 'true' or empty string, enable with no schedule (will trigger validation error)
    if (trimmed === 'true' || trimmed === '') {
      return {}; // Empty object enables auto-scheduling but will require schedule validation
    }
    // Check if the string is a JSON-serialized object (LLMs sometimes stringify objects)
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // Not valid JSON — fall through to treat as schedule name
      }
    }
    // Otherwise, treat as schedule name
    return { schedule: trimmed };
  }

  // If it's 'true' or true, enable auto-scheduling (will trigger validation for schedule)
  if (value === 'true' || value === true) {
    return {}; // Empty object enables auto-scheduling but will require schedule validation
  }

  // If it's 'false' or false, disable auto-scheduling
  if (value === 'false' || value === false) {
    return null;
  }

  // For any other value, treat as undefined (not provided)
  return undefined;
}

/**
 * Parse task creation/update arguments from MCP request
 */
export function parseTaskArgs(args: Record<string, unknown> = {}): TaskArgs {
  return {
    name: args.name ? sanitizeName(args.name as string) : undefined,
    description: sanitizeDescription(args.description as string),
    projectId: (args.projectId as string) || undefined,
    projectName: args.projectName ? sanitizeName(args.projectName as string) : undefined,
    status: (args.status as string) || undefined,
    priority: (args.priority as 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW') || undefined,
    dueDate: (args.dueDate as string) || undefined,
    duration: args.duration !== undefined ? args.duration as (string | number) : undefined,
    labels: Array.isArray(args.labels) ? args.labels as string[] : undefined,
    assigneeId: (args.assigneeId as string) || undefined,
    autoScheduled: parseAutoScheduledParam(args.autoScheduled),
    ...parseWorkspaceArgs(args)
  };
}

/**
 * Normalize date-only due dates so Motion stores them on the intended calendar day.
 * Converts relative inputs (today/tomorrow/yesterday) or YYYY-MM-DD values
 * to the end of that day in UTC. Leaves timestamps with explicit offsets intact.
 */
export function normalizeDueDateForApi(dueDate?: string | null): string | undefined {
  if (!dueDate) {
    return undefined;
  }

  const trimmed = dueDate.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalizedDate = parseFilterDate(trimmed);
  if (normalizedDate) {
    return `${normalizedDate}T23:59:59.000Z`;
  }

  const hasTimezoneOffset = /[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed);
  if (hasTimezoneOffset) {
    return trimmed;
  }

  // If the string looks like a datetime without timezone info (e.g. 'YYYY-MM-DDTHH:mm:ss')
  // Treat as UTC by appending Z — preserve the user's intended time
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(trimmed)) {
    return `${trimmed}Z`;
  }

  // Otherwise, just return the original string (unparseable or unexpected format)
  return trimmed;
}

/**
 * Parse project creation/update arguments from MCP request
 */
export function parseProjectArgs(args: Record<string, unknown> = {}): ProjectArgs {
  return {
    name: args.name ? sanitizeName(args.name as string) : undefined,
    description: sanitizeDescription(args.description as string),
    ...parseWorkspaceArgs(args)
  };
}

/**
 * Set default values for parameters
 */
export function setDefaults<T extends object, D extends Partial<T>>(
  args: T = {} as T, 
  defaults: D = {} as D
): T & D {
  return { ...defaults, ...args };
}

/**
 * Validate that required parameters are present
 * @throws {ValidationError} If required parameters are missing
 */
export function validateRequiredParams(
  args: Record<string, unknown> = {}, 
  required: string[] = []
): void {
  const missing: string[] = [];
  
  for (const param of required) {
    if (args[param] === null || args[param] === undefined || args[param] === '') {
      missing.push(param);
    }
  }
  
  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required parameters: ${missing.join(', ')}`,
      missing[0],
      { missing, provided: Object.keys(args) }
    );
  }
}

/**
 * Validate parameter types
 * @throws {ValidationError} If parameters have wrong types
 */
export function validateParameterTypes(
  args: Record<string, unknown> = {}, 
  types: Record<string, string> = {}
): void {
  const errors: string[] = [];
  
  for (const [param, expectedType] of Object.entries(types)) {
    if (args[param] !== null && args[param] !== undefined) {
      const actualType = typeof args[param];
      if (actualType !== expectedType) {
        errors.push(`${param} should be ${expectedType}, got ${actualType}`);
      }
    }
  }
  
  if (errors.length > 0) {
    throw new ValidationError(
      `Type validation failed: ${errors.join('; ')}`,
      null,
      { errors, args }
    );
  }
}

/**
 * Sanitize string parameters (trim whitespace, handle empty strings)
 * Empty strings become undefined (deleted)
 */
export function sanitizeStringParams<T extends Record<string, any>>(
  args: T = {} as T, 
  stringParams: (keyof T)[] = []
): T {
  const sanitized = { ...args };
  
  for (const param of stringParams) {
    const value = sanitized[param];
    
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // Delete empty strings (makes them undefined) per policy
      if (trimmed === '') {
        delete sanitized[param];
      } else {
        // Type-safe assignment: we've verified it's a string at runtime
        // and we're only processing declared string parameters
        Object.assign(sanitized, { [param]: trimmed });
      }
    }
  }
  
  return sanitized;
}

/**
 * Defensively parse a value that should be an object but may have been
 * JSON-stringified by an LLM transport layer.
 */
export function parseObjectParam(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(value.trim());
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Not valid JSON
    }
  }
  return undefined;
}

/**
 * Defensively parse a value that should be an array but may have been
 * JSON-stringified by an LLM transport layer.
 */
export function parseArrayParam(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value.trim());
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Not valid JSON
    }
  }
  return undefined;
}

interface ValidationOptions {
  requireWorkspace?: boolean;
}

/**
 * Parse and validate workspace parameters with common validation
 */
export function parseAndValidateWorkspace(
  args: Record<string, unknown> = {}, 
  options: ValidationOptions = {}
): WorkspaceArgs {
  const { requireWorkspace = false } = options;
  
  const workspaceParams = parseWorkspaceArgs(args);
  
  if (requireWorkspace && !workspaceParams.workspaceId && !workspaceParams.workspaceName) {
    throw new ValidationError(
      'Either workspaceId or workspaceName is required',
      'workspace',
      { provided: workspaceParams }
    );
  }
  
  return workspaceParams;
}
