import { BaseHandler } from './base/BaseHandler';
import { McpToolResponse } from '../types/mcp';
import { MotionCustomFieldsArgs } from '../types/mcp-tool-args';
import { CreateCustomFieldData } from '../types/motion';
import { formatCustomFieldList, formatCustomFieldDetail, formatCustomFieldSuccess, LIMITS } from '../utils';

export class CustomFieldHandler extends BaseHandler {
  async handle(args: MotionCustomFieldsArgs): Promise<McpToolResponse> {
    try {
      const { operation } = args;

      switch(operation) {
        case 'list':
          return await this.handleList(args);
        case 'create':
          return await this.handleCreate(args);
        case 'delete':
          return await this.handleDelete(args);
        case 'add_to_project':
          return await this.handleAddToProject(args);
        case 'remove_from_project':
          return await this.handleRemoveFromProject(args);
        case 'add_to_task':
          return await this.handleAddToTask(args);
        case 'remove_from_task':
          return await this.handleRemoveFromTask(args);
        default:
          return this.handleUnknownOperation(operation);
      }
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  private async handleList(args: MotionCustomFieldsArgs): Promise<McpToolResponse> {
    if (!args.workspaceId) {
      return this.handleError(new Error('Workspace ID is required for list operation'));
    }
    const fields = await this.motionService.getCustomFields(args.workspaceId);
    return formatCustomFieldList(fields);
  }

  private async handleCreate(args: MotionCustomFieldsArgs): Promise<McpToolResponse> {
    if (!args.workspaceId || !args.name || !args.field) {
      return this.handleError(new Error('Workspace ID, name, and field are required for create operation'));
    }

    if (args.name.length > LIMITS.CUSTOM_FIELD_NAME_MAX_LENGTH) {
      return this.handleError(new Error(`Field name exceeds ${LIMITS.CUSTOM_FIELD_NAME_MAX_LENGTH} characters`));
    }

    if (['select', 'multiSelect'].includes(args.field) !== Boolean(args.options)) {
      return this.handleError(new Error('Options parameter only allowed for select/multiSelect field types'));
    }

    const fieldData: CreateCustomFieldData = {
      name: args.name,
      field: args.field,
      ...(args.options && { metadata: { options: args.options } })
    };

    const newField = await this.motionService.createCustomField(args.workspaceId, fieldData);
    return formatCustomFieldDetail(newField);
  }

  private async handleDelete(args: MotionCustomFieldsArgs): Promise<McpToolResponse> {
    if (!args.workspaceId || !args.fieldId) {
      return this.handleError(new Error('Workspace ID and field ID are required for delete operation'));
    }

    await this.motionService.deleteCustomField(args.workspaceId, args.fieldId);
    return formatCustomFieldSuccess('deleted');
  }

  private async handleAddToProject(args: MotionCustomFieldsArgs): Promise<McpToolResponse> {
    if (!args.projectId || !args.fieldId) {
      return this.handleError(new Error('Project ID and field ID are required for add_to_project operation'));
    }

    await this.motionService.addCustomFieldToProject(args.projectId, args.fieldId, args.value);
    return formatCustomFieldSuccess('added', 'project', args.projectId);
  }

  private async handleRemoveFromProject(args: MotionCustomFieldsArgs): Promise<McpToolResponse> {
    if (!args.projectId || !args.fieldId) {
      return this.handleError(new Error('Project ID and field ID are required for remove_from_project operation'));
    }

    await this.motionService.removeCustomFieldFromProject(args.projectId, args.fieldId);
    return formatCustomFieldSuccess('removed', 'project', args.projectId);
  }

  private async handleAddToTask(args: MotionCustomFieldsArgs): Promise<McpToolResponse> {
    if (!args.taskId || !args.fieldId) {
      return this.handleError(new Error('Task ID and field ID are required for add_to_task operation'));
    }

    await this.motionService.addCustomFieldToTask(args.taskId, args.fieldId, args.value);
    return formatCustomFieldSuccess('added', 'task', args.taskId);
  }

  private async handleRemoveFromTask(args: MotionCustomFieldsArgs): Promise<McpToolResponse> {
    if (!args.taskId || !args.fieldId) {
      return this.handleError(new Error('Task ID and field ID are required for remove_from_task operation'));
    }

    await this.motionService.removeCustomFieldFromTask(args.taskId, args.fieldId);
    return formatCustomFieldSuccess('removed', 'task', args.taskId);
  }
}