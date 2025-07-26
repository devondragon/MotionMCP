/**
 * Response Formatting Utilities - MCP response formatting helpers
 * 
 * This module provides utilities to format various types of responses
 * consistently across all MCP handlers, reducing duplication and ensuring
 * uniform response structures.
 */

const { formatMcpSuccess } = require('./errorHandling');

/**
 * Format a list of items for MCP response
 * 
 * @param {Array} items - Array of items to format
 * @param {string} title - Title for the list
 * @param {Function} formatter - Function to format each item
 * @returns {Object} MCP-compliant response
 */
function formatListResponse(items, title, formatter) {
  if (!Array.isArray(items)) {
    throw new Error('Items must be an array');
  }
  
  const list = items.map(formatter).join('\n');
  const responseText = `${title}:\n${list}`;
  
  return formatMcpSuccess(responseText);
}

/**
 * Format project list response with workspace context
 * 
 * @param {Array} projects - Array of project objects
 * @param {string} workspaceName - Name of the workspace
 * @param {string} workspaceId - ID of the workspace (optional)
 * @param {Object} options - Additional formatting options
 * @returns {Object} MCP-compliant response
 */
function formatProjectList(projects, workspaceName, workspaceId = null, options = {}) {
  const { includeWorkspaceNote = false, showIds = true } = options;
  
  const projectFormatter = (project) => {
    if (showIds) {
      return `- ${project.name} (ID: ${project.id})`;
    }
    return `- ${project.name}`;
  };
  
  let responseText = `Found ${projects.length} ${projects.length === 1 ? 'project' : 'projects'} in workspace "${workspaceName}"`;
  if (workspaceId) {
    responseText += ` (ID: ${workspaceId})`;
  }
  
  if (projects.length > 0) {
    const projectList = projects.map(projectFormatter).join('\n');
    responseText += `:\n${projectList}`;
  }
  
  if (includeWorkspaceNote && !workspaceId) {
    responseText += `\n\nNote: This shows projects from the default workspace. You can specify a different workspace using the workspaceId or workspaceName parameter, or use list_motion_workspaces to see all available workspaces.`;
  }
  
  return formatMcpSuccess(responseText);
}

/**
 * Format task list response
 * 
 * @param {Array} tasks - Array of task objects
 * @param {Object} context - Context information (workspace, filters, etc.)
 * @returns {Object} MCP-compliant response
 */
function formatTaskList(tasks, context = {}) {
  const { workspaceName, projectName, status, limit } = context;
  
  const taskFormatter = (task) => {
    let line = `- ${task.name}`;
    if (task.id) line += ` (ID: ${task.id})`;
    if (task.status) line += ` [${task.status}]`;
    if (task.priority) line += ` {${task.priority}}`;
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate).toLocaleDateString();
      line += ` (Due: ${dueDate})`;
    }
    return line;
  };
  
  let title = `Found ${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`;
  if (workspaceName) title += ` in workspace "${workspaceName}"`;
  if (projectName) title += ` in project "${projectName}"`;
  if (status) title += ` with status "${status}"`;
  if (limit) title += ` (limit: ${limit})`;
  
  return formatListResponse(tasks, title, taskFormatter);
}

/**
 * Format workspace list response
 * 
 * @param {Array} workspaces - Array of workspace objects
 * @returns {Object} MCP-compliant response
 */
function formatWorkspaceList(workspaces) {
  const workspaceFormatter = (workspace) => {
    let line = `- ${workspace.name} (ID: ${workspace.id})`;
    if (workspace.type) line += ` [${workspace.type}]`;
    return line;
  };
  
  return formatListResponse(workspaces, `Available workspaces (${workspaces.length})`, workspaceFormatter);
}

/**
 * Format detailed item response (project, task, etc.)
 * 
 * @param {Object} item - Item object with details
 * @param {string} itemType - Type of item (e.g., 'Project', 'Task')
 * @param {Array} fields - Array of field names to include
 * @returns {Object} MCP-compliant response
 */
function formatDetailResponse(item, itemType, fields = []) {
  let responseText = `${itemType} Details:\n`;
  
  fields.forEach(field => {
    const value = item[field];
    const displayName = field.charAt(0).toUpperCase() + field.slice(1);
    const displayValue = value || 'N/A';
    responseText += `- ${displayName}: ${displayValue}\n`;
  });
  
  return formatMcpSuccess(responseText);
}

/**
 * Format search results response
 * 
 * @param {Array} results - Array of search result objects
 * @param {string} query - Original search query
 * @param {Object} options - Search options used
 * @returns {Object} MCP-compliant response
 */
function formatSearchResults(results, query, options = {}) {
  const { limit, searchScope } = options;
  
  const resultFormatter = (result) => {
    const type = result.projectId ? "task" : "project";
    return `- [${type}] ${result.name} (ID: ${result.id})`;
  };
  
  let title = `Search Results for "${query}"`;
  if (limit) title += ` (Limit: ${limit})`;
  if (searchScope) title += ` (Scope: ${searchScope})`;
  
  return formatListResponse(results, title, resultFormatter);
}

module.exports = {
  formatListResponse,
  formatProjectList,
  formatTaskList,
  formatWorkspaceList,
  formatDetailResponse,
  formatSearchResults
};