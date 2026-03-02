import { BaseHandler } from './base/BaseHandler';
import { McpToolResponse } from '../types/mcp';
import { MotionTasksArgs } from '../types/mcp-tool-args';
import { MotionTaskUpdateData } from '../types/motion';
import {
  formatMcpSuccess,
  parseTaskArgs,
  parseAutoScheduledParam,
  parseArrayParam,
  formatTaskList,
  formatTaskDetail,
  normalizeDueDateForApi
} from '../utils';
import { isValidPriority, parseFilterDate, ValidPriority } from '../utils/constants';

/** Parameters for creating a new task */
interface CreateTaskParams {
  name?: string;
  workspaceId?: string;
  workspaceName?: string;
  projectId?: string;
  projectName?: string;
  description?: string;
  status?: string | string[];
  priority?: string;
  dueDate?: string;
  duration?: string | number;
  labels?: string[];
  autoScheduled?: Record<string, unknown> | null;
}

/** Parameters for listing tasks with optional filters */
interface ListTaskParams {
  workspaceId?: string;
  workspaceName?: string;
  projectId?: string;
  projectName?: string;
  name?: string;
  status?: string | string[];
  includeAllStatuses?: boolean;
  assigneeId?: string;
  assignee?: string;
  priority?: string;
  dueDate?: string;
  labels?: string[];
  limit?: number;
}

/** Parameters for retrieving a single task */
interface GetTaskParams {
  taskId?: string;
}

/** Parameters for updating an existing task */
interface UpdateTaskParams {
  taskId?: string;
  workspaceId?: string;
  name?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  duration?: string | number;
  labels?: string[];
  autoScheduled?: Record<string, unknown> | null;
  assigneeId?: string;
}

/** Parameters for deleting a task */
interface DeleteTaskParams {
  taskId?: string;
}

/** Parameters for moving a task to a different workspace */
interface MoveTaskParams {
  taskId?: string;
  targetWorkspaceId?: string;
  assigneeId?: string;
}

/** Parameters for removing the assignee from a task */
interface UnassignTaskParams {
  taskId?: string;
}

/** Parameters for listing all uncompleted tasks across workspaces */
interface ListAllUncompletedParams {
  assigneeId?: string;
  assignee?: string;
  limit?: number;
}

class AutoSchedulingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AutoSchedulingValidationError';
  }
}

/**
 * Handler for all task-related operations in the Motion API.
 *
 * Supports CRUD operations on tasks including create, list, get, update, delete,
 * as well as specialized operations like move, unassign, and listing uncompleted tasks.
 * Handles workspace and project resolution, input validation, and auto-scheduling configuration.
 *
 * @extends BaseHandler
 */
export class TaskHandler extends BaseHandler {
  /**
   * Routes task operation requests to the appropriate handler method.
   * @param args - Task operation arguments including operation type and parameters
   * @returns MCP-formatted response with operation result or error
   */
  async handle(args: MotionTasksArgs): Promise<McpToolResponse> {
    try {
      const { operation, ...params } = args;

      switch(operation) {
        case 'create':
          return await this.handleCreate(params as CreateTaskParams);
        case 'list':
          return await this.handleList(params as ListTaskParams);
        case 'get':
          return await this.handleGet(params as GetTaskParams);
        case 'update':
          return await this.handleUpdate(params as UpdateTaskParams);
        case 'delete':
          return await this.handleDelete(params as DeleteTaskParams);
        case 'move':
          return await this.handleMove(params as MoveTaskParams);
        case 'unassign':
          return await this.handleUnassign(params as UnassignTaskParams);
        case 'list_all_uncompleted':
          return await this.handleListAllUncompleted(params as ListAllUncompletedParams);
        default:
          return this.handleUnknownOperation(operation);
      }
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  /**
   * Creates a new task in Motion.
   *
   * Resolves workspace and project identifiers, converts duration values,
   * validates auto-scheduling configuration, and creates the task via the Motion API.
   * The task is created in the project's workspace if a project is specified,
   * otherwise uses the resolved or default workspace.
   *
   * @param params - Task creation parameters including name, workspace, project, and task details
   * @returns Success response with task name and ID, or error if creation fails
   */
  private async handleCreate(params: CreateTaskParams): Promise<McpToolResponse> {
    if (!params.name) {
      return this.handleError(new Error("Task name is required for create operation"));
    }
    if (Array.isArray(params.status)) {
      return this.handleError(new Error("'status' must be a single string for create operation, not an array"));
    }

    const taskData = parseTaskArgs(params as unknown as Record<string, unknown>);
    if (!taskData.name) {
      return this.handleError(new Error('Task name is required for create operation'));
    }
    const workspace = await this.workspaceResolver.resolveWorkspace(taskData);

    // Resolve project identifier (projectId or projectName) using the centralized utility
    let resolvedProjectId = taskData.projectId;
    let targetWorkspaceId = workspace.id; // Default to resolved workspace

    if (taskData.projectId || taskData.projectName) {
      const project = await this.motionService.resolveProjectIdentifier(
        { projectId: taskData.projectId, projectName: taskData.projectName },
        workspace.id
      );
      if (project) {
        resolvedProjectId = project.id;
        // Use the project's workspace instead of the default/specified workspace
        targetWorkspaceId = project.workspaceId;
      } else {
        const identifier = taskData.projectId ? `ID "${taskData.projectId}"` : `name "${taskData.projectName}"`;
        return this.handleError(new Error(`Project with ${identifier} not found in any workspace`));
      }
    }

    // Convert types for Motion API
    let convertedDuration: number | 'NONE' | 'REMINDER' | undefined;
    if (taskData.duration !== undefined) {
      convertedDuration = this.parseDurationValue(taskData.duration);
    }

    // API accepts labels as plain string array per docs
    const convertedLabels = taskData.labels;

    // Validate and normalize auto-scheduling configuration
    taskData.autoScheduled = await this.validateAndNormalizeAutoScheduling(
      taskData.autoScheduled,
      targetWorkspaceId
    );

    const task = await this.motionService.createTask({
      name: taskData.name,
      description: taskData.description,
      projectId: resolvedProjectId,
      status: taskData.status,
      priority: taskData.priority,
      dueDate: normalizeDueDateForApi(taskData.dueDate),
      duration: convertedDuration,
      labels: convertedLabels,
      assigneeId: taskData.assigneeId,
      autoScheduled: taskData.autoScheduled,
      workspaceId: targetWorkspaceId
    });

    return formatMcpSuccess(`Successfully created task "${task.name}" (ID: ${task.id})`);
  }

  /**
   * Lists tasks with optional filters for workspace, project, status, assignee, priority, and labels.
   *
   * Supports flexible assignee resolution including the special 'me' keyword for the current user.
   * Validates priority values and date formats before querying. Returns formatted task list
   * with applied filter context.
   *
   * @param params - Filter parameters for task listing
   * @returns Formatted list of matching tasks with filter context
   */
  private async handleList(params: ListTaskParams): Promise<McpToolResponse> {
    // Workspace resolution is optional — if no workspace specified, API returns all workspaces
    let resolvedWorkspaceId: string | undefined;
    let resolvedWorkspaceName: string | undefined;

    if (params.workspaceId || params.workspaceName) {
      const workspace = await this.workspaceResolver.resolveWorkspace({
        workspaceId: params.workspaceId,
        workspaceName: params.workspaceName
      });
      resolvedWorkspaceId = workspace.id;
      resolvedWorkspaceName = workspace.name;
    }

    // Resolve project identifier (projectId or projectName) using the centralized utility
    let resolvedProjectId = params.projectId;
    let resolvedProjectName = params.projectName;

    if (params.projectId || params.projectName) {
      const project = await this.motionService.resolveProjectIdentifier(
        { projectId: params.projectId, projectName: params.projectName },
        resolvedWorkspaceId
      );
      if (project) {
        resolvedProjectId = project.id;
        resolvedProjectName = project.name;
      } else {
        const identifier = params.projectId ? `ID "${params.projectId}"` : `name "${params.projectName}"`;
        return this.handleError(new Error(`Project with ${identifier} not found in any workspace`));
      }
    }

    // Defensive: LLMs may stringify the status array
    if (typeof params.status === 'string' && params.status.trim().startsWith('[')) {
      const parsed = parseArrayParam(params.status);
      if (parsed && parsed.every(s => typeof s === 'string')) {
        params = { ...params, status: parsed as string[] };
      }
    }

    // Validate status array elements if provided as array
    if (Array.isArray(params.status) && params.status.some(s => !s || typeof s !== 'string')) {
      return this.handleError(new Error('status array must contain only non-empty strings'));
    }

    // Validate that status and includeAllStatuses are not combined
    // An empty array is semantically "no filter" and should not trigger this error
    const hasStatusFilter = Array.isArray(params.status) ? params.status.length > 0 : !!params.status;
    if (params.includeAllStatuses && hasStatusFilter) {
      return this.handleError(new Error(
        "Cannot combine 'includeAllStatuses' with 'status' filter. Use one or the other."
      ));
    }

    // Validate priority if provided
    if (params.priority && !isValidPriority(params.priority)) {
      return this.handleError(new Error(
        `Invalid priority "${params.priority}". Valid values are: ASAP, HIGH, MEDIUM, LOW`
      ));
    }

    // Validate and parse due date if provided
    let validatedDueDate: string | undefined;
    if (params.dueDate) {
      const parsedDate = parseFilterDate(params.dueDate);
      if (!parsedDate) {
        return this.handleError(new Error(
          `Invalid date format "${params.dueDate}". Use YYYY-MM-DD format or relative dates like 'today', 'tomorrow'`
        ));
      }
      validatedDueDate = parsedDate;
    }

    // Validate labels if provided
    if (params.labels && (!Array.isArray(params.labels) || params.labels.some(label => !label || typeof label !== 'string'))) {
      return this.handleError(new Error('Labels must be an array of non-empty strings'));
    }

    const { resolvedId: resolvedAssigneeId, display: assigneeDisplay } =
      await this.resolveAssignee(params.assigneeId, params.assignee, resolvedWorkspaceId);

    const { items: tasks, truncation } = await this.motionService.getTasks({
      workspaceId: resolvedWorkspaceId,
      projectId: resolvedProjectId,
      name: params.name,
      status: params.status,
      includeAllStatuses: params.includeAllStatuses,
      assigneeId: resolvedAssigneeId,
      priority: params.priority as ValidPriority | undefined,
      dueDate: validatedDueDate,
      labels: params.labels,
      limit: params.limit
    });

    const statusDisplay = params.includeAllStatuses
      ? 'all statuses'
      : Array.isArray(params.status) && params.status.length > 0
        ? params.status.join(', ')
        : typeof params.status === 'string'
          ? params.status
          : undefined;

    return formatTaskList(tasks, {
      workspaceName: resolvedWorkspaceName,
      projectName: resolvedProjectName,
      status: statusDisplay,
      assigneeName: assigneeDisplay || resolvedAssigneeId,
      priority: params.priority,
      dueDate: params.dueDate,
      limit: params.limit,
      truncation
    });
  }

  /**
   * Retrieves detailed information for a single task.
   * @param params - Parameters containing the task ID
   * @returns Formatted task details or error if task not found
   */
  private async handleGet(params: GetTaskParams): Promise<McpToolResponse> {
    if (!params.taskId) {
      return this.handleError(new Error("Task ID is required for get operation"));
    }

    const taskDetails = await this.motionService.getTask(params.taskId);
    return formatTaskDetail(taskDetails);
  }

  /**
   * Updates an existing task with new values.
   *
   * Only updates fields that are explicitly provided in params.
   * Validates priority values and converts duration strings to appropriate format.
   * Labels are converted to the Motion API's expected object format.
   *
   * @param params - Update parameters including taskId and fields to update
   * @returns Success response with updated task info or validation error
   */
  private async handleUpdate(params: UpdateTaskParams): Promise<McpToolResponse> {
    if (!params.taskId) {
      return this.handleError(new Error("Task ID is required for update operation"));
    }
    if (Array.isArray(params.status)) {
      return this.handleError(new Error("'status' must be a single string for update operation, not an array"));
    }

    // Create update object with only valid MotionTask fields
    const updateData: MotionTaskUpdateData = {};
    if (params.name !== undefined) updateData.name = params.name;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.status !== undefined) updateData.status = params.status;
    if (params.priority !== undefined) {
      if (!isValidPriority(params.priority)) {
        return this.handleError(new Error(
          `Invalid priority "${params.priority}". Valid values are: ASAP, HIGH, MEDIUM, LOW`
        ));
      }
      updateData.priority = params.priority;
    }
    if (params.dueDate !== undefined) {
      updateData.dueDate = normalizeDueDateForApi(params.dueDate);
    }
    if (params.duration !== undefined) {
      updateData.duration = this.parseDurationValue(params.duration);
    }
    // API accepts labels as plain string array per docs
    if (params.labels !== undefined) updateData.labels = params.labels;
    if (params.assigneeId !== undefined) updateData.assigneeId = params.assigneeId;
    if (params.autoScheduled !== undefined) {
      // Normalize string shorthand (e.g., "Work Hours") to { schedule: "Work Hours" }
      updateData.autoScheduled = parseAutoScheduledParam(params.autoScheduled);

      // Validate auto-scheduling (same as create): catches "true" → {} silent no-op
      if (updateData.autoScheduled !== null && updateData.autoScheduled !== undefined) {
        // Use provided workspaceId to avoid an extra GET; fall back to fetching if not supplied
        let workspaceId = params.workspaceId;
        if (!workspaceId) {
          const task = await this.motionService.getTask(params.taskId!);
          workspaceId = task.workspaceId;
        }
        updateData.autoScheduled = await this.validateAndNormalizeAutoScheduling(
          updateData.autoScheduled,
          workspaceId
        );
      }
    }

    const updatedTask = await this.motionService.updateTask(params.taskId, updateData);
    return formatMcpSuccess(`Successfully updated task "${updatedTask.name}" (ID: ${updatedTask.id})`);
  }

  /**
   * Permanently deletes a task from Motion.
   * @param params - Parameters containing the task ID to delete
   * @returns Success response confirming deletion
   */
  private async handleDelete(params: DeleteTaskParams): Promise<McpToolResponse> {
    if (!params.taskId) {
      return this.handleError(new Error("Task ID is required for delete operation"));
    }

    await this.motionService.deleteTask(params.taskId);
    return formatMcpSuccess(`Successfully deleted task ${params.taskId}`);
  }

  /**
   * Moves a task to a different workspace.
   * Requires a target workspace ID. Optionally reassigns the task.
   * @param params - Parameters with taskId, target workspace, and optional assignee
   * @returns Success response with moved task info
   */
  private async handleMove(params: MoveTaskParams): Promise<McpToolResponse> {
    if (!params.taskId) {
      return this.handleError(new Error("Task ID is required for move operation"));
    }
    if (!params.targetWorkspaceId) {
      return this.handleError(new Error("Target workspace ID is required for move operation"));
    }

    const movedTask = await this.motionService.moveTask(params.taskId, params.targetWorkspaceId, params.assigneeId);
    if (movedTask?.name) {
      return formatMcpSuccess(`Successfully moved task "${movedTask.name}" (ID: ${movedTask.id})`);
    }
    return formatMcpSuccess(`Successfully moved task (ID: ${params.taskId})`);
  }

  /**
   * Removes the assignee from a task, making it unassigned.
   * @param params - Parameters containing the task ID
   * @returns Success response confirming unassignment
   */
  private async handleUnassign(params: UnassignTaskParams): Promise<McpToolResponse> {
    if (!params.taskId) {
      return this.handleError(new Error("Task ID is required for unassign operation"));
    }

    const unassignedTask = await this.motionService.unassignTask(params.taskId);
    if (unassignedTask?.name) {
      return formatMcpSuccess(`Successfully unassigned task "${unassignedTask.name}" (ID: ${unassignedTask.id})`);
    }
    return formatMcpSuccess(`Successfully unassigned task (ID: ${params.taskId})`);
  }

  /**
   * Lists all uncompleted tasks across all accessible workspaces.
   * Useful for getting a complete view of pending work regardless of workspace.
   * @param params - Optional limit for maximum number of tasks to return
   * @returns Formatted list of uncompleted tasks from all workspaces
   */
  private async handleListAllUncompleted(params: ListAllUncompletedParams): Promise<McpToolResponse> {
    const { resolvedId, display } =
      await this.resolveAssignee(params.assigneeId, params.assignee);

    const { items: tasks, truncation } = await this.motionService.getAllUncompletedTasks(params.limit, resolvedId);

    return formatTaskList(tasks, {
      status: 'uncompleted',
      assigneeName: display || resolvedId,
      limit: params.limit,
      allWorkspaces: true,
      truncation
    });
  }

  /**
   * Resolves assignee parameters into a concrete user ID and display name.
   * Supports the 'me' shortcut (in either assigneeId or assignee), name/email lookup,
   * and direct ID passthrough. When no workspaceId is provided, name lookups search
   * across all workspaces.
   *
   * @param assigneeId - Direct user ID or the literal 'me'
   * @param assignee - User name, email, or the literal 'me'
   * @param workspaceId - Workspace to search for name lookups; omit for cross-workspace search
   * @returns Resolved user ID and human-readable display name
   */
  private async resolveAssignee(
    assigneeId?: string,
    assignee?: string,
    workspaceId?: string
  ): Promise<{ resolvedId?: string; display?: string }> {
    const displayFromUser = (user: { name?: string; email?: string; id: string }) =>
      user.name || user.email || user.id;

    if (assigneeId) {
      if (assigneeId.toLowerCase() === 'me') {
        const currentUser = await this.motionService.getCurrentUser();
        return { resolvedId: currentUser.id, display: displayFromUser(currentUser) };
      }
      return { resolvedId: assigneeId, display: assignee };
    }

    if (assignee) {
      const input = assignee.trim();
      if (input.toLowerCase() === 'me') {
        const currentUser = await this.motionService.getCurrentUser();
        return { resolvedId: currentUser.id, display: displayFromUser(currentUser) };
      }

      if (workspaceId) {
        const user = await this.motionService.resolveUserIdentifier(
          { userName: input },
          workspaceId,
          { strictWorkspace: true }
        );
        if (!user) {
          throw new Error(`Assignee "${input}" not found in workspace "${workspaceId}"`);
        }
        return { resolvedId: user.id, display: displayFromUser(user) };
      }

      // Cross-workspace lookup
      const workspaces = await this.motionService.getWorkspaces();
      for (const ws of workspaces) {
        const user = await this.motionService.resolveUserIdentifier(
          { userName: input },
          ws.id,
          { strictWorkspace: true }
        );
        if (user) {
          return { resolvedId: user.id, display: displayFromUser(user) };
        }
      }
      throw new Error(`Assignee "${input}" not found in any workspace`);
    }

    return {};
  }

  /**
   * Parse and validate task duration from user input.
   * Accepts non-negative integer minutes or special values NONE/REMINDER.
   */
  private parseDurationValue(duration: string | number): number | 'NONE' | 'REMINDER' {
    if (typeof duration === 'number') {
      if (!Number.isInteger(duration) || duration < 0) {
        throw new Error('Duration must be a non-negative integer number of minutes, or "NONE"/"REMINDER".');
      }
      return duration;
    }

    const trimmed = duration.trim();
    if (trimmed === 'NONE' || trimmed === 'REMINDER') {
      return trimmed;
    }

    if (!/^\d+$/.test(trimmed)) {
      throw new Error('Duration must be a non-negative integer number of minutes, or "NONE"/"REMINDER".');
    }

    return parseInt(trimmed, 10);
  }

  /**
   * Validate and normalize auto-scheduling configuration and provide helpful error messages
   * @param autoScheduled - The autoScheduled configuration
   * @param workspaceId - The workspace ID for context
   * @returns Normalized autoScheduled object (with canonical schedule casing), or original null/undefined
   * @throws Error if validation fails with helpful guidance
   */
  private async validateAndNormalizeAutoScheduling(
    autoScheduled: Record<string, unknown> | null | undefined,
    workspaceId: string
  ): Promise<Record<string, unknown> | null | undefined> {
    // If auto-scheduling is not enabled, no validation needed
    if (!autoScheduled || autoScheduled === null) {
      return autoScheduled;
    }

    // If it's an object, check if schedule is provided
    if (typeof autoScheduled === 'object' && autoScheduled !== null) {
      const scheduleValue = autoScheduled.schedule;
      const schedule = typeof scheduleValue === 'string' ? scheduleValue.trim() : '';

      // If no schedule provided, show available schedules
      if (!schedule) {
        try {
          const availableSchedules = await this.motionService.getAvailableScheduleNames(workspaceId);

          if (availableSchedules.length === 0) {
            throw new AutoSchedulingValidationError(
              'Auto-scheduling requires a schedule, but no schedules are available. Please create a schedule in Motion first.'
            );
          }

          const scheduleList = availableSchedules
            .map((name, i) => `${i + 1}. "${name}"`)
            .join('\n');

          throw new AutoSchedulingValidationError(
            `Auto-scheduling requires a schedule. Available schedules:\n${scheduleList}\n\nExample usage:\n• Set autoScheduled to {"schedule": "${availableSchedules[0]}"}\n• Or pass schedule name directly: autoScheduled = "${availableSchedules[0]}"`
          );
        } catch (error) {
          // If we can't fetch schedules, provide a generic error
          if (error instanceof AutoSchedulingValidationError) {
            throw error; // Re-throw our formatted error
          }
          throw new AutoSchedulingValidationError(
            'Auto-scheduling requires a schedule, but unable to fetch available schedules. Please specify a schedule name in autoScheduled parameter.'
          );
        }
      }

      // Validate that the provided schedule exists
      try {
        const availableSchedules = await this.motionService.getAvailableScheduleNames(workspaceId);

        // Case-insensitive matching
        const normalizedSchedule = schedule.toLowerCase().trim();
        const matchingSchedule = availableSchedules.find(
          s => s.toLowerCase().trim() === normalizedSchedule
        );

        if (!matchingSchedule) {
          // Provide suggestions for similar names
          const suggestions = availableSchedules.filter(s =>
            s.toLowerCase().includes(normalizedSchedule) ||
            normalizedSchedule.includes(s.toLowerCase())
          );

          const scheduleList = availableSchedules
            .map((name, i) => `${i + 1}. "${name}"`)
            .join('\n');

          let errorMessage = `Schedule "${schedule}" not found.`;

          if (suggestions.length > 0) {
            errorMessage += ` Did you mean: ${suggestions.map(s => `"${s}"`).join(', ')}?`;
          }

          errorMessage += `\n\nAvailable schedules:\n${scheduleList}`;

          throw new Error(errorMessage);
        }

        // Return a normalized copy with exact casing from Motion
        return {
          ...autoScheduled,
          schedule: matchingSchedule
        };
      } catch (error) {
        if (error instanceof Error) {
          throw error; // Re-throw validation errors
        }
        throw new Error(
          `Unable to validate schedule "${schedule}". Please check that the schedule exists in Motion.`
        );
      }
    }

    return autoScheduled;
  }
}
