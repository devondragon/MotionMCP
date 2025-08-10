/**
 * Response Formatting Utilities - MCP response formatting helpers
 * 
 * This module provides utilities to format various types of responses
 * consistently across all MCP handlers, reducing duplication and ensuring
 * uniform response structures.
 */

import { formatMcpSuccess } from './errorHandling';
import { McpToolResponse } from '../types/mcp';
import { MotionProject, MotionTask, MotionWorkspace } from '../types/motion';

/**
 * Format a list of items for MCP response
 */
export function formatListResponse<T>(
  items: T[], 
  title: string, 
  formatter: (item: T) => string
): McpToolResponse {
  if (!Array.isArray(items)) {
    throw new Error('Items must be an array');
  }
  
  const list = items.map(formatter).join('\n');
  const responseText = `${title}:\n${list}`;
  
  return formatMcpSuccess(responseText);
}

interface ProjectListOptions {
  includeWorkspaceNote?: boolean;
  showIds?: boolean;
}

/**
 * Format project list response with workspace context
 */
export function formatProjectList(
  projects: MotionProject[], 
  workspaceName: string, 
  workspaceId: string | null = null, 
  options: ProjectListOptions = {}
): McpToolResponse {
  const { includeWorkspaceNote = false, showIds = true } = options;
  
  const projectFormatter = (project: MotionProject) => {
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

interface TaskListContext {
  workspaceName?: string;
  projectName?: string;
  status?: string;
  limit?: number;
}

/**
 * Format task list response
 */
export function formatTaskList(
  tasks: MotionTask[], 
  context: TaskListContext = {}
): McpToolResponse {
  const { workspaceName, projectName, status, limit } = context;
  
  const taskFormatter = (task: MotionTask) => {
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
 */
export function formatWorkspaceList(workspaces: MotionWorkspace[]): McpToolResponse {
  const workspaceFormatter = (workspace: MotionWorkspace) => {
    let line = `- ${workspace.name} (ID: ${workspace.id})`;
    if (workspace.type) line += ` [${workspace.type}]`;
    return line;
  };
  
  return formatListResponse(workspaces, `Available workspaces (${workspaces.length})`, workspaceFormatter);
}

/**
 * Format detailed item response (project, task, etc.)
 */
export function formatDetailResponse<T extends Record<string, any>>(
  item: T, 
  itemType: string, 
  fields: (keyof T)[] = []
): McpToolResponse {
  let responseText = `${itemType} Details:\n`;
  
  fields.forEach(field => {
    const value = item[field];
    const fieldStr = String(field);
    const displayName = fieldStr.charAt(0).toUpperCase() + fieldStr.slice(1);
    const displayValue = value || 'N/A';
    responseText += `- ${displayName}: ${displayValue}\n`;
  });
  
  return formatMcpSuccess(responseText);
}

interface SearchOptions {
  limit?: number;
  searchScope?: string;
}

interface SearchResult {
  id: string;
  name: string;
  projectId?: string;
}

/**
 * Format search results response
 */
export function formatSearchResults(
  results: SearchResult[], 
  query: string, 
  options: SearchOptions = {}
): McpToolResponse {
  const { limit, searchScope } = options;
  
  const resultFormatter = (result: SearchResult) => {
    const type = result.projectId ? "task" : "project";
    return `- [${type}] ${result.name} (ID: ${result.id})`;
  };
  
  let title = `Search Results for "${query}"`;
  if (limit) title += ` (Limit: ${limit})`;
  if (searchScope) title += ` (Scope: ${searchScope})`;
  
  return formatListResponse(results, title, resultFormatter);
}

