import { BaseHandler } from './base/BaseHandler';
import { HandlerContext } from './base/HandlerInterface';
import { TOOL_NAMES } from '../tools/ToolDefinitions';

// Import all handler classes
import { TaskHandler } from './TaskHandler';
import { ProjectHandler } from './ProjectHandler';
import { WorkspaceHandler } from './WorkspaceHandler';
import { UserHandler } from './UserHandler';
import { SearchHandler } from './SearchHandler';
import { CommentHandler } from './CommentHandler';
import { CustomFieldHandler } from './CustomFieldHandler';
import { RecurringTaskHandler } from './RecurringTaskHandler';
import { ScheduleHandler } from './ScheduleHandler';
import { StatusHandler } from './StatusHandler';

export class HandlerFactory {
  private handlers: Map<string, new(context: HandlerContext) => BaseHandler>;
  private context: HandlerContext;

  constructor(context: HandlerContext) {
    this.context = context;
    this.handlers = new Map();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.handlers.set(TOOL_NAMES.TASKS, TaskHandler);
    this.handlers.set(TOOL_NAMES.PROJECTS, ProjectHandler);
    this.handlers.set(TOOL_NAMES.WORKSPACES, WorkspaceHandler);
    this.handlers.set(TOOL_NAMES.USERS, UserHandler);
    this.handlers.set(TOOL_NAMES.SEARCH, SearchHandler);
    this.handlers.set(TOOL_NAMES.COMMENTS, CommentHandler);
    this.handlers.set(TOOL_NAMES.CUSTOM_FIELDS, CustomFieldHandler);
    this.handlers.set(TOOL_NAMES.RECURRING_TASKS, RecurringTaskHandler);
    this.handlers.set(TOOL_NAMES.SCHEDULES, ScheduleHandler);
    this.handlers.set(TOOL_NAMES.STATUSES, StatusHandler);
  }

  createHandler(toolName: string): BaseHandler {
    const HandlerClass = this.handlers.get(toolName);
    if (!HandlerClass) {
      throw new Error(`No handler registered for tool: ${toolName}`);
    }
    return new HandlerClass(this.context);
  }

  hasHandler(toolName: string): boolean {
    return this.handlers.has(toolName);
  }

  getRegisteredToolNames(): string[] {
    return Array.from(this.handlers.keys());
  }

  registerHandler(toolName: string, handlerClass: new(context: HandlerContext) => BaseHandler): void {
    this.handlers.set(toolName, handlerClass);
  }

  unregisterHandler(toolName: string): boolean {
    return this.handlers.delete(toolName);
  }

  getHandlerCount(): number {
    return this.handlers.size;
  }
}