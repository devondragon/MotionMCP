import { BaseHandler } from './base/BaseHandler';
import { McpToolResponse } from '../types/mcp';
import { MotionRecurringTasksArgs } from '../types/mcp-tool-args';
import { CreateRecurringTaskData, FrequencyObject } from '../types/motion';
import { formatRecurringTaskList, formatRecurringTaskDetail, formatMcpSuccess, parseObjectParam } from '../utils';

export class RecurringTaskHandler extends BaseHandler {
  async handle(args: MotionRecurringTasksArgs): Promise<McpToolResponse> {
    try {
      const { operation } = args;

      switch(operation) {
        case 'list':
          return await this.handleList(args);
        case 'create':
          return await this.handleCreate(args);
        case 'delete':
          return await this.handleDelete(args);
        default:
          return this.handleUnknownOperation(operation);
      }
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  private async handleList(args: MotionRecurringTasksArgs): Promise<McpToolResponse> {
    if (!args.workspaceId && !args.workspaceName) {
      return this.handleError(new Error('Workspace ID or workspace name is required for list operation'));
    }
    const workspace = await this.workspaceResolver.resolveWorkspace({
      workspaceId: args.workspaceId,
      workspaceName: args.workspaceName
    });
    const { items: recurringTasks, truncation } = await this.motionService.getRecurringTasks(workspace.id);
    return formatRecurringTaskList(recurringTasks, truncation);
  }

  private async handleCreate(args: MotionRecurringTasksArgs): Promise<McpToolResponse> {
    if (!args.name || (!args.workspaceId && !args.workspaceName) || !args.assigneeId || !args.frequency) {
      return this.handleError(new Error('Name, workspace ID/workspace name, assignee ID, and frequency are required for create operation'));
    }

    // Defensive: LLMs may stringify the frequency object
    const frequency = parseObjectParam(args.frequency) as FrequencyObject | undefined;
    if (!frequency) {
      return this.handleError(new Error('frequency must be an object with a "type" property'));
    }

    // Validate frequency
    if (!frequency.type || !['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom'].includes(frequency.type)) {
      return this.handleError(new Error('Frequency type must be one of: daily, weekly, biweekly, monthly, quarterly, yearly, custom'));
    }

    const workspace = await this.workspaceResolver.resolveWorkspace({
      workspaceId: args.workspaceId,
      workspaceName: args.workspaceName
    });

    const taskData: CreateRecurringTaskData = {
      name: args.name,
      workspaceId: workspace.id,
      assigneeId: args.assigneeId,
      frequency,
      ...(args.description && { description: args.description }),
      ...(args.projectId && { projectId: args.projectId }),
      ...(args.deadlineType && { deadlineType: args.deadlineType }),
      ...(args.duration !== undefined && args.duration !== null && { duration: args.duration }),
      ...(args.startingOn && { startingOn: args.startingOn }),
      ...(args.idealTime && { idealTime: args.idealTime }),
      ...(args.schedule && { schedule: args.schedule }),
      ...(args.priority && { priority: args.priority })
    };

    const newTask = await this.motionService.createRecurringTask(taskData);
    return formatRecurringTaskDetail(newTask);
  }

  private async handleDelete(args: MotionRecurringTasksArgs): Promise<McpToolResponse> {
    if (!args.recurringTaskId) {
      return this.handleError(new Error('Recurring task ID is required for delete operation'));
    }

    await this.motionService.deleteRecurringTask(args.recurringTaskId);
    return formatMcpSuccess(`Recurring task ${args.recurringTaskId} deleted successfully`);
  }
}
