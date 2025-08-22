/**
 * Parameter Utilities - Parameter parsing and validation helpers
 * 
 * This module provides utilities for parsing, validating, and setting
 * default values for MCP handler parameters, reducing duplication and
 * ensuring consistent parameter handling.
 */

import { DEFAULTS } from './constants';
import { ValidationError } from './errorHandling';
import { sanitizeName, sanitizeDescription } from './sanitize';

interface WorkspaceArgs {
  workspaceId?: string;
  workspaceName?: string;
}

interface SearchArgs extends WorkspaceArgs {
  query?: string;
  searchScope?: 'both' | 'tasks' | 'projects';
  limit?: number;
}

interface TaskArgs extends WorkspaceArgs {
  name?: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  status?: string;
  priority?: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate?: string;
  assigneeId?: string;
}

interface ProjectArgs extends WorkspaceArgs {
  name?: string;
  description?: string;
  color?: string;
  status?: string;
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
 * Parse search-related arguments from MCP request
 */
export function parseSearchArgs(args: Record<string, unknown> = {}): SearchArgs {
  return {
    query: args.query ? sanitizeName(args.query as string) : '',
    searchScope: (args.searchScope as 'both' | 'tasks' | 'projects') || DEFAULTS.SEARCH_SCOPE,
    limit: (args.limit as number) || DEFAULTS.SEARCH_LIMIT,
    ...parseWorkspaceArgs(args)
  };
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
    assigneeId: (args.assigneeId as string) || undefined,
    ...parseWorkspaceArgs(args)
  };
}

/**
 * Parse project creation/update arguments from MCP request
 */
export function parseProjectArgs(args: Record<string, unknown> = {}): ProjectArgs {
  return {
    name: args.name ? sanitizeName(args.name as string) : undefined,
    description: sanitizeDescription(args.description as string),
    color: (args.color as string) || undefined,
    status: (args.status as string) || undefined,
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
 * Following NULL_UNDEFINED_POLICY: empty strings become undefined (deleted)
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

