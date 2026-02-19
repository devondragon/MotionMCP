import { BaseHandler } from './base/BaseHandler';
import { McpToolResponse } from '../types/mcp';
import { MotionRecurringTasksArgs } from '../types/mcp-tool-args';
import { CreateRecurringTaskData } from '../types/motion';
import { formatRecurringTaskList, formatRecurringTaskDetail, formatMcpSuccess } from '../utils';

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
    if (!args.workspaceId) {
      return this.handleError(new Error('Workspace ID is required for list operation'));
    }
    const { items: recurringTasks, truncation } = await this.motionService.getRecurringTasks(args.workspaceId);
    return formatRecurringTaskList(recurringTasks, truncation);
  }

  private async handleCreate(args: MotionRecurringTasksArgs): Promise<McpToolResponse> {
    if (!args.name || !args.workspaceId || !args.assigneeId || !args.frequency) {
      return this.handleError(new Error('Name, workspace ID, assignee ID, and frequency are required for create operation'));
    }

    // Validate frequency
    if (!args.frequency.type || !['daily', 'weekly', 'monthly', 'yearly'].includes(args.frequency.type)) {
      return this.handleError(new Error('Frequency type must be one of: daily, weekly, monthly, yearly'));
    }

    // Additional validations would go here...
    
    const workspace = await this.workspaceResolver.resolveWorkspace({ workspaceId: args.workspaceId });

    const taskData: CreateRecurringTaskData = {
      name: args.name,
      workspaceId: workspace.id,
      assigneeId: args.assigneeId,
      frequency: args.frequency,
      ...(args.description && { description: args.description }),
      ...(args.projectId && { projectId: args.projectId }),
      ...(args.deadlineType && { deadlineType: args.deadlineType }),
      ...(args.duration && { duration: args.duration }),
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