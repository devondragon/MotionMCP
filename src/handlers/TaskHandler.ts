import { BaseHandler } from './base/BaseHandler';
import { McpToolResponse } from '../types/mcp';
import { MotionTasksArgs } from '../types/mcp-tool-args';
import { MotionTask } from '../types/motion';
import {
  formatMcpSuccess,
  parseTaskArgs,
  formatTaskList,
  formatTaskDetail
} from '../utils';
import { isValidPriority, parseFilterDate, ValidPriority } from '../utils/constants';

interface CreateTaskParams {
  name?: string;
  workspaceId?: string;
  workspaceName?: string;
  projectId?: string;
  projectName?: string;
  description?: string;
  priority?: string;
  dueDate?: string;
  duration?: string | number;
  labels?: string[];
  autoScheduled?: Record<string, unknown> | null;
}

interface ListTaskParams {
  workspaceId?: string;
  workspaceName?: string;
  projectId?: string;
  projectName?: string;
  status?: string;
  assigneeId?: string;
  assignee?: string;
  priority?: string;
  dueDate?: string;
  labels?: string[];
  limit?: number;
}

interface GetTaskParams {
  taskId?: string;
}

interface UpdateTaskParams {
  taskId?: string;
  name?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  duration?: string | number;
  labels?: string[];
  autoScheduled?: Record<string, unknown> | null;
}

interface DeleteTaskParams {
  taskId?: string;
}

interface MoveTaskParams {
  taskId?: string;
  targetProjectId?: string;
  targetWorkspaceId?: string;
}

interface UnassignTaskParams {
  taskId?: string;
}

interface ListAllUncompletedParams {
  limit?: number;
}

export class TaskHandler extends BaseHandler {
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

  private async handleCreate(params: CreateTaskParams): Promise<McpToolResponse> {
    if (!params.name) {
      return this.handleError(new Error("Task name is required for create operation"));
    }

    const taskData = parseTaskArgs(params as unknown as Record<string, unknown>);
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
      if (typeof taskData.duration === 'string') {
        if (taskData.duration === 'NONE' || taskData.duration === 'REMINDER') {
          convertedDuration = taskData.duration;
        } else {
          const numDuration = parseInt(taskData.duration, 10);
          if (!isNaN(numDuration)) {
            convertedDuration = numDuration;
          }
        }
      } else {
        convertedDuration = taskData.duration;
      }
    }

    const convertedLabels = taskData.labels?.map(name => ({ name }));

    // Validate auto-scheduling configuration
    await this.validateAutoScheduling(taskData.autoScheduled, targetWorkspaceId);

    const task = await this.motionService.createTask({
      name: taskData.name,
      description: taskData.description,
      projectId: resolvedProjectId,
      status: taskData.status,
      priority: taskData.priority,
      dueDate: taskData.dueDate,
      duration: convertedDuration,
      labels: convertedLabels,
      assigneeId: taskData.assigneeId,
      autoScheduled: taskData.autoScheduled,
      workspaceId: targetWorkspaceId
    });

    return formatMcpSuccess(`Successfully created task "${task.name}" (ID: ${task.id})`);
  }

  private async handleList(params: ListTaskParams): Promise<McpToolResponse> {
    const workspace = await this.workspaceResolver.resolveWorkspace({
      workspaceId: params.workspaceId,
      workspaceName: params.workspaceName
    });

    // Resolve project identifier (projectId or projectName) using the centralized utility
    let resolvedProjectId = params.projectId;
    let resolvedProjectName = params.projectName;

    if (params.projectId || params.projectName) {
      const project = await this.motionService.resolveProjectIdentifier(
        { projectId: params.projectId, projectName: params.projectName },
        workspace.id
      );
      if (project) {
        resolvedProjectId = project.id;
        resolvedProjectName = project.name;
      } else {
        const identifier = params.projectId ? `ID "${params.projectId}"` : `name "${params.projectName}"`;
        return this.handleError(new Error(`Project with ${identifier} not found in any workspace`));
      }
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

    let resolvedAssigneeId = params.assigneeId;
    let assigneeDisplay: string | undefined = params.assignee;

    const normalizeDisplayFromUser = (user: { name?: string; email?: string; id: string }) => {
      return user.name || user.email || user.id;
    };

    const resolveCurrentUser = async () => {
      const currentUser = await this.motionService.getCurrentUser();
      resolvedAssigneeId = currentUser.id;
      assigneeDisplay = normalizeDisplayFromUser(currentUser);
    };

    if (resolvedAssigneeId) {
      if (resolvedAssigneeId.toLowerCase() === 'me') {
        await resolveCurrentUser();
      }
    } else if (params.assignee) {
      const assigneeInput = params.assignee.trim();
      if (assigneeInput.toLowerCase() === 'me') {
        await resolveCurrentUser();
      } else {
        const user = await this.motionService.resolveUserIdentifier({ userName: assigneeInput }, workspace.id);
        if (!user) {
          return this.handleError(new Error(`Assignee "${assigneeInput}" not found in any workspace`));
        }
        resolvedAssigneeId = user.id;
        assigneeDisplay = normalizeDisplayFromUser(user);
      }
    }

    const tasks = await this.motionService.getTasks({
      workspaceId: workspace.id,
      projectId: resolvedProjectId,
      status: params.status,
      assigneeId: resolvedAssigneeId,
      priority: params.priority as ValidPriority | undefined,
      dueDate: validatedDueDate,
      labels: params.labels,
      limit: params.limit
    });

    return formatTaskList(tasks, {
      workspaceName: workspace.name,
      projectName: resolvedProjectName,
      status: params.status,
      assigneeName: assigneeDisplay || resolvedAssigneeId,
      priority: params.priority,
      dueDate: params.dueDate,
      limit: params.limit
    });
  }

  private async handleGet(params: GetTaskParams): Promise<McpToolResponse> {
    if (!params.taskId) {
      return this.handleError(new Error("Task ID is required for get operation"));
    }

    const taskDetails = await this.motionService.getTask(params.taskId);
    return formatTaskDetail(taskDetails);
  }

  private async handleUpdate(params: UpdateTaskParams): Promise<McpToolResponse> {
    if (!params.taskId) {
      return this.handleError(new Error("Task ID is required for update operation"));
    }

    // Create update object with only valid MotionTask fields
    const updateData: Partial<MotionTask> = {};
    if (params.name !== undefined) updateData.name = params.name;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.status !== undefined) updateData.status = params.status;
    if (params.priority !== undefined) updateData.priority = params.priority as any;
    if (params.dueDate !== undefined) updateData.dueDate = params.dueDate;
    if (params.duration !== undefined) {
      // Convert string duration to number or keep special values
      if (typeof params.duration === 'string') {
        if (params.duration === 'NONE' || params.duration === 'REMINDER') {
          updateData.duration = params.duration;
        } else {
          const numDuration = parseInt(params.duration, 10);
          if (!isNaN(numDuration)) {
            updateData.duration = numDuration;
          }
        }
      } else {
        updateData.duration = params.duration;
      }
    }
    if (params.labels !== undefined) updateData.labels = params.labels?.map(name => ({ name }));
    if (params.autoScheduled !== undefined) updateData.autoScheduled = params.autoScheduled as Record<string, unknown> | null;

    const updatedTask = await this.motionService.updateTask(params.taskId, updateData);
    return formatMcpSuccess(`Successfully updated task "${updatedTask.name}" (ID: ${updatedTask.id})`);
  }

  private async handleDelete(params: DeleteTaskParams): Promise<McpToolResponse> {
    if (!params.taskId) {
      return this.handleError(new Error("Task ID is required for delete operation"));
    }

    await this.motionService.deleteTask(params.taskId);
    return formatMcpSuccess(`Successfully deleted task ${params.taskId}`);
  }

  private async handleMove(params: MoveTaskParams): Promise<McpToolResponse> {
    if (!params.taskId) {
      return this.handleError(new Error("Task ID is required for move operation"));
    }
    if (!params.targetProjectId && !params.targetWorkspaceId) {
      return this.handleError(new Error("Either target project ID or target workspace ID is required for move operation"));
    }

    const movedTask = await this.motionService.moveTask(params.taskId, params.targetProjectId, params.targetWorkspaceId);
    return formatMcpSuccess(`Successfully moved task "${movedTask.name}" (ID: ${movedTask.id})`);
  }

  private async handleUnassign(params: UnassignTaskParams): Promise<McpToolResponse> {
    if (!params.taskId) {
      return this.handleError(new Error("Task ID is required for unassign operation"));
    }

    const unassignedTask = await this.motionService.unassignTask(params.taskId);
    return formatMcpSuccess(`Successfully unassigned task "${unassignedTask.name}" (ID: ${unassignedTask.id})`);
  }

  private async handleListAllUncompleted(params: ListAllUncompletedParams): Promise<McpToolResponse> {
    const tasks = await this.motionService.getAllUncompletedTasks(params.limit);

    return formatTaskList(tasks, {
      status: 'uncompleted',
      limit: params.limit,
      allWorkspaces: true
    });
  }

  /**
   * Validate auto-scheduling configuration and provide helpful error messages
   * @param autoScheduled - The autoScheduled configuration
   * @param workspaceId - The workspace ID for context
   * @throws Error if validation fails with helpful guidance
   */
  private async validateAutoScheduling(
    autoScheduled: Record<string, unknown> | null | undefined,
    workspaceId: string
  ): Promise<void> {
    // If auto-scheduling is not enabled, no validation needed
    if (!autoScheduled || autoScheduled === null) {
      return;
    }

    // If it's an object, check if schedule is provided
    if (typeof autoScheduled === 'object' && autoScheduled !== null) {
      const schedule = autoScheduled.schedule as string | undefined;

      // If no schedule provided, show available schedules
      if (!schedule) {
        try {
          const availableSchedules = await this.motionService.getAvailableScheduleNames(workspaceId);

          if (availableSchedules.length === 0) {
            throw new Error(
              'Auto-scheduling requires a schedule, but no schedules are available. Please create a schedule in Motion first.'
            );
          }

          const scheduleList = availableSchedules
            .map((name, i) => `${i + 1}. "${name}"`)
            .join('\n');

          throw new Error(
            `Auto-scheduling requires a schedule. Available schedules:\n${scheduleList}\n\nExample usage:\n• Set autoScheduled to {"schedule": "${availableSchedules[0]}"}\n• Or pass schedule name directly: autoScheduled = "${availableSchedules[0]}"`
          );
        } catch (error) {
          // If we can't fetch schedules, provide a generic error
          if (error instanceof Error && error.message.includes('Auto-scheduling requires a schedule')) {
            throw error; // Re-throw our formatted error
          }
          throw new Error(
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

        // Update the schedule with the exact match (fixes casing)
        autoScheduled.schedule = matchingSchedule;
      } catch (error) {
        if (error instanceof Error) {
          throw error; // Re-throw validation errors
        }
        throw new Error(
          `Unable to validate schedule "${schedule}". Please check that the schedule exists in Motion.`
        );
      }
    }
  }
}
