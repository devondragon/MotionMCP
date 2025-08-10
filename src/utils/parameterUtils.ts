/**
 * Parameter Utilities - Parameter parsing and validation helpers
 * 
 * This module provides utilities for parsing, validating, and setting
 * default values for MCP handler parameters, reducing duplication and
 * ensuring consistent parameter handling.
 */

import { DEFAULTS } from './constants';
import { ValidationError } from './errorHandling';

interface WorkspaceArgs {
  workspaceId?: string | null;
  workspaceName?: string | null;
}

interface SearchArgs extends WorkspaceArgs {
  query?: string;
  searchScope?: 'both' | 'tasks' | 'projects';
  limit?: number;
}

interface TaskArgs extends WorkspaceArgs {
  name?: string | null;
  description?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  status?: string | null;
  priority?: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW' | null;
  dueDate?: string | null;
  assigneeId?: string | null;
}

interface ProjectArgs extends WorkspaceArgs {
  name?: string | null;
  description?: string | null;
  color?: string | null;
  status?: string | null;
}

/**
 * Parse workspace-related arguments from MCP request
 */
export function parseWorkspaceArgs(args: any = {}): WorkspaceArgs {
  return {
    workspaceId: args.workspaceId || null,
    workspaceName: args.workspaceName || null
  };
}

/**
 * Parse search-related arguments from MCP request
 */
export function parseSearchArgs(args: any = {}): SearchArgs {
  return {
    query: args.query || '',
    searchScope: args.searchScope || DEFAULTS.SEARCH_SCOPE,
    limit: args.limit || DEFAULTS.SEARCH_LIMIT,
    ...parseWorkspaceArgs(args)
  };
}

/**
 * Parse task creation/update arguments from MCP request
 */
export function parseTaskArgs(args: any = {}): TaskArgs {
  return {
    name: args.name || null,
    description: args.description || null,
    projectId: args.projectId || null,
    projectName: args.projectName || null,
    status: args.status || null,
    priority: args.priority || null,
    dueDate: args.dueDate || null,
    assigneeId: args.assigneeId || null,
    ...parseWorkspaceArgs(args)
  };
}

/**
 * Parse project creation/update arguments from MCP request
 */
export function parseProjectArgs(args: any = {}): ProjectArgs {
  return {
    name: args.name || null,
    description: args.description || null,
    color: args.color || null,
    status: args.status || null,
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
  args: Record<string, any> = {}, 
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
  args: Record<string, any> = {}, 
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
 */
export function sanitizeStringParams<T extends Record<string, any>>(
  args: T = {} as T, 
  stringParams: string[] = []
): T {
  const sanitized = { ...args };
  
  for (const param of stringParams) {
    if (typeof sanitized[param] === 'string') {
      const trimmed = sanitized[param].trim();
      // Convert empty strings to null
      if (trimmed === '') {
        (sanitized as any)[param] = null;
      } else {
        (sanitized as any)[param] = trimmed;
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
  args: any = {}, 
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

