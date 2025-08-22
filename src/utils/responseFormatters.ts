/**
 * Response Formatting Utilities - MCP response formatting helpers
 * 
 * This module provides utilities to format various types of responses
 * consistently across all MCP handlers, reducing duplication and ensuring
 * uniform response structures.
 */

import { formatMcpSuccess } from './errorHandling';
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { MotionProject, MotionTask, MotionWorkspace, MotionComment, MotionCustomField, MotionRecurringTask, MotionSchedule, MotionScheduleDetails, MotionStatus } from '../types/motion';
import { LIMITS } from './constants';

/**
 * Format a list of items for MCP response
 */
export function formatListResponse<T>(
  items: T[], 
  title: string, 
  formatter: (item: T) => string
): CallToolResult {
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
): CallToolResult {
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
): CallToolResult {
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
export function formatWorkspaceList(workspaces: MotionWorkspace[]): CallToolResult {
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
): CallToolResult {
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
): CallToolResult {
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

/**
 * Format comments list response
 */
export function formatCommentList(comments: MotionComment[]): CallToolResult {
  if (comments.length === 0) {
    return formatMcpSuccess("No comments found.");
  }
  
  const commentFormatter = (comment: MotionComment) => {
    const location = comment.taskId ? `Task ${comment.taskId}` : `Project ${comment.projectId}`;
    const timestamp = comment.createdAt || 'Unknown time';
    // Truncate long comments for display
    const displayContent = comment.content.length > LIMITS.COMMENT_DISPLAY_LENGTH 
      ? comment.content.substring(0, LIMITS.COMMENT_DISPLAY_LENGTH) + '...'
      : comment.content;
    // Keep as single line for proper list formatting
    return `- [${comment.id}] ${location} | Author: ${comment.authorId} | ${timestamp} | "${displayContent}"`;
  };
  
  return formatListResponse(
    comments, 
    `Found ${comments.length} comment${comments.length === 1 ? '' : 's'}`,
    commentFormatter
  );
}

/**
 * Format single comment response  
 */
export function formatCommentDetail(comment: MotionComment): CallToolResult {
  const location = comment.taskId ? `Task ${comment.taskId}` : `Project ${comment.projectId}`;
  const timestamp = comment.createdAt || 'Unknown time';
  
  const details = [
    `Comment created successfully:`,
    `- ID: ${comment.id}`,
    `- Location: ${location}`,
    `- Author: ${comment.authorId}`,
    `- Created: ${timestamp}`,
    `- Content: "${comment.content}"`
  ].join('\n');
  
  return formatMcpSuccess(details);
}

/**
 * Format custom field list response
 */
export function formatCustomFieldList(fields: MotionCustomField[]): CallToolResult {
  if (fields.length === 0) {
    return formatMcpSuccess("No custom fields found.");
  }
  
  const fieldFormatter = (field: MotionCustomField) => {
    return `- ID: ${field.id} [Type: ${field.field}]`;
  };
  
  return formatListResponse(fields, `Found ${fields.length} custom field${fields.length === 1 ? '' : 's'}`, fieldFormatter);
}

/**
 * Format single custom field response
 */
export function formatCustomFieldDetail(field: MotionCustomField): CallToolResult {
  const details = [
    `Custom field created successfully:`,
    `- ID: ${field.id}`,
    `- Type: ${field.field}`
  ].join('\n');
  
  return formatMcpSuccess(details);
}

/**
 * Format success message for custom field operations
 */
export function formatCustomFieldSuccess(operation: string, entityType?: string, entityId?: string): CallToolResult {
  let message = `Custom field ${operation} successfully`;
  if (entityType && entityId) {
    message += ` for ${entityType} ${entityId}`;
  }
  return formatMcpSuccess(message);
}

/**
 * Format recurring task list response
 */
export function formatRecurringTaskList(tasks: MotionRecurringTask[]): CallToolResult {
  if (tasks.length === 0) {
    return formatMcpSuccess("No recurring tasks found.");
  }
  
  const taskFormatter = (task: MotionRecurringTask) => {
    return `- ${task.name} (ID: ${task.id}) [${task.recurrence.frequency}]${task.nextOccurrence ? ` Next: ${task.nextOccurrence}` : ''}`;
  };
  
  return formatListResponse(tasks, `Found ${tasks.length} recurring task${tasks.length === 1 ? '' : 's'}`, taskFormatter);
}

/**
 * Format single recurring task response
 */
export function formatRecurringTaskDetail(task: MotionRecurringTask): CallToolResult {
  const details = [
    `Recurring task created successfully:`,
    `- ID: ${task.id}`,
    `- Name: ${task.name}`,
    `- Frequency: ${task.recurrence.frequency}`,
    `- Workspace: ${task.workspaceId}`,
    task.projectId ? `- Project: ${task.projectId}` : null,
    task.nextOccurrence ? `- Next occurrence: ${task.nextOccurrence}` : null
  ].filter(Boolean).join('\n');
  
  return formatMcpSuccess(details);
}

/**
 * Format schedule list response
 */
export function formatScheduleList(schedules: MotionSchedule[]): CallToolResult {
  // Add null safety check for the array itself
  if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
    return formatMcpSuccess("No schedules found.");
  }
  
  const scheduleFormatter = (schedule: MotionSchedule) => {
    // Defensive programming for nested schedule object
    if (!schedule) {
      return '- Invalid schedule entry';
    }
    
    const name = schedule.name || 'Unnamed';
    const timezone = schedule.timezone || 'Unknown timezone';
    
    // Count working days if schedule details are available
    let workingDays = '';
    if (schedule.schedule && typeof schedule.schedule === 'object') {
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const activeDays = days.filter(day => 
        Array.isArray(schedule.schedule[day as keyof MotionScheduleDetails]) && 
        schedule.schedule[day as keyof MotionScheduleDetails]!.length > 0
      );
      workingDays = activeDays.length > 0 
        ? ` | Working days: ${activeDays.length}/7` 
        : ' | No working hours defined';
    } else {
      workingDays = ' | Schedule details unavailable';
    }
    
    return `- ${name} (${timezone})${workingDays}`;
  };
  
  return formatListResponse(schedules, `Found ${schedules.length} schedule${schedules.length === 1 ? '' : 's'}`, scheduleFormatter);
}

export function formatStatusList(statuses: MotionStatus[]): CallToolResult {
  const statusFormatter = (status: MotionStatus): string => {
    // Defensive programming for status object
    if (!status) {
      return '- Invalid status entry';
    }
    
    const name = status.name || 'Unnamed';
    const flags: string[] = [];
    
    if (status.isDefaultStatus) {
      flags.push('Default');
    }
    if (status.isResolvedStatus) {
      flags.push('Resolved');
    }
    
    const flagsStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
    
    return `- ${name}${flagsStr}`;
  };
  
  return formatListResponse(statuses, `Found ${statuses.length} status${statuses.length === 1 ? '' : 'es'}`, statusFormatter);
}

