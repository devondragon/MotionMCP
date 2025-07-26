/**
 * Parameter Utilities - Parameter parsing and validation helpers
 * 
 * This module provides utilities for parsing, validating, and setting
 * default values for MCP handler parameters, reducing duplication and
 * ensuring consistent parameter handling.
 */

const { DEFAULTS } = require('./constants');
const { ValidationError } = require('./errorHandling');

/**
 * Parse workspace-related arguments from MCP request
 * 
 * @param {Object} args - Arguments from MCP request
 * @returns {Object} Parsed workspace parameters
 */
function parseWorkspaceArgs(args = {}) {
  return {
    workspaceId: args.workspaceId || null,
    workspaceName: args.workspaceName || null
  };
}

/**
 * Parse search-related arguments from MCP request
 * 
 * @param {Object} args - Arguments from MCP request
 * @returns {Object} Parsed search parameters with defaults
 */
function parseSearchArgs(args = {}) {
  return {
    query: args.query || '',
    searchScope: args.searchScope || DEFAULTS.SEARCH_SCOPE,
    limit: args.limit || DEFAULTS.SEARCH_LIMIT,
    ...parseWorkspaceArgs(args)
  };
}

/**
 * Parse task creation/update arguments from MCP request
 * 
 * @param {Object} args - Arguments from MCP request
 * @returns {Object} Parsed task parameters
 */
function parseTaskArgs(args = {}) {
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
 * 
 * @param {Object} args - Arguments from MCP request
 * @returns {Object} Parsed project parameters
 */
function parseProjectArgs(args = {}) {
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
 * 
 * @param {Object} args - Current arguments
 * @param {Object} defaults - Default values to apply
 * @returns {Object} Arguments with defaults applied
 */
function setDefaults(args = {}, defaults = {}) {
  return { ...defaults, ...args };
}

/**
 * Validate that required parameters are present
 * 
 * @param {Object} args - Arguments to validate
 * @param {Array} required - Array of required parameter names
 * @throws {ValidationError} If required parameters are missing
 */
function validateRequiredParams(args = {}, required = []) {
  const missing = [];
  
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
 * 
 * @param {Object} args - Arguments to validate
 * @param {Object} types - Object mapping parameter names to expected types
 * @throws {ValidationError} If parameters have wrong types
 */
function validateParameterTypes(args = {}, types = {}) {
  const errors = [];
  
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
 * 
 * @param {Object} args - Arguments to sanitize
 * @param {Array} stringParams - Array of parameter names to sanitize
 * @returns {Object} Sanitized arguments
 */
function sanitizeStringParams(args = {}, stringParams = []) {
  const sanitized = { ...args };
  
  for (const param of stringParams) {
    if (typeof sanitized[param] === 'string') {
      sanitized[param] = sanitized[param].trim();
      // Convert empty strings to null
      if (sanitized[param] === '') {
        sanitized[param] = null;
      }
    }
  }
  
  return sanitized;
}

/**
 * Parse and validate workspace parameters with common validation
 * 
 * @param {Object} args - Arguments from MCP request
 * @param {Object} options - Validation options
 * @returns {Object} Parsed and validated workspace parameters
 */
function parseAndValidateWorkspace(args = {}, options = {}) {
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

module.exports = {
  parseWorkspaceArgs,
  parseSearchArgs,
  parseTaskArgs,
  parseProjectArgs,
  setDefaults,
  validateRequiredParams,
  validateParameterTypes,
  sanitizeStringParams,
  parseAndValidateWorkspace
};