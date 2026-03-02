import { BaseHandler } from './base/BaseHandler';
import { McpToolResponse } from '../types/mcp';
import { MotionCustomFieldsArgs } from '../types/mcp-tool-args';
import { CreateCustomFieldData } from '../types/motion';
import { formatCustomFieldList, formatCustomFieldDetail, formatCustomFieldSuccess, LIMITS, parseArrayParam } from '../utils';

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
    if (!args.workspaceId && !args.workspaceName) {
      return this.handleError(new Error('Workspace ID or workspace name is required for list operation'));
    }
    const workspace = await this.workspaceResolver.resolveWorkspace({
      workspaceId: args.workspaceId,
      workspaceName: args.workspaceName
    });
    const fields = await this.motionService.getCustomFields(workspace.id);
    return formatCustomFieldList(fields);
  }

  private async handleCreate(args: MotionCustomFieldsArgs): Promise<McpToolResponse> {
    if ((!args.workspaceId && !args.workspaceName) || !args.name || !args.field) {
      return this.handleError(new Error('Workspace ID/name, name, and field are required for create operation'));
    }

    if (args.name.length > LIMITS.CUSTOM_FIELD_NAME_MAX_LENGTH) {
      return this.handleError(new Error(`Field name exceeds ${LIMITS.CUSTOM_FIELD_NAME_MAX_LENGTH} characters`));
    }

    const isSelectType = ['select', 'multiSelect'].includes(args.field);
    if (!isSelectType && args.options) {
      return this.handleError(new Error('Options parameter is only allowed for select/multiSelect field types'));
    }
    if (isSelectType && !args.options) {
      return this.handleError(new Error('Options parameter is required for select/multiSelect field types'));
    }

    const workspace = await this.workspaceResolver.resolveWorkspace({
      workspaceId: args.workspaceId,
      workspaceName: args.workspaceName
    });

    const fieldData: CreateCustomFieldData = {
      name: args.name,
      field: args.field,
      ...(args.required !== undefined && { required: args.required }),
      ...(args.options && { metadata: { options: args.options } })
    };

    const newField = await this.motionService.createCustomField(workspace.id, fieldData);
    return formatCustomFieldDetail(newField);
  }

  private async handleDelete(args: MotionCustomFieldsArgs): Promise<McpToolResponse> {
    if ((!args.workspaceId && !args.workspaceName) || !args.fieldId) {
      return this.handleError(new Error('Workspace ID/name and field ID are required for delete operation'));
    }

    const workspace = await this.workspaceResolver.resolveWorkspace({
      workspaceId: args.workspaceId,
      workspaceName: args.workspaceName
    });

    await this.motionService.deleteCustomField(workspace.id, args.fieldId);
    return formatCustomFieldSuccess('deleted');
  }

  private async handleAddToProject(args: MotionCustomFieldsArgs): Promise<McpToolResponse> {
    if (!args.projectId || !args.fieldId) {
      return this.handleError(new Error('Project ID and field ID are required for add_to_project operation'));
    }
    if (args.value !== undefined && args.value !== null && !args.field) {
      return this.handleError(new Error('Field type (field) is required when providing a value. Use "text", "number", "multiSelect", etc.'));
    }

    // Defensive: LLMs may stringify array values for multiSelect fields
    let value = args.value;
    if (typeof value === 'string' && args.field === 'multiSelect') {
      const parsed = parseArrayParam(value);
      if (parsed && parsed.every(v => typeof v === 'string')) {
        value = parsed as string[];
      }
    }

    const result = await this.motionService.addCustomFieldToProject(args.projectId, args.fieldId, value, args.field);
    return formatCustomFieldSuccess('added', 'project', args.projectId, result);
  }

  private async handleRemoveFromProject(args: MotionCustomFieldsArgs): Promise<McpToolResponse> {
    if (!args.projectId || !args.valueId) {
      return this.handleError(new Error('Project ID and valueId (custom field value ID) are required for remove_from_project operation'));
    }

    await this.motionService.removeCustomFieldFromProject(args.projectId, args.valueId);
    return formatCustomFieldSuccess('removed', 'project', args.projectId);
  }

  private async handleAddToTask(args: MotionCustomFieldsArgs): Promise<McpToolResponse> {
    if (!args.taskId || !args.fieldId) {
      return this.handleError(new Error('Task ID and field ID are required for add_to_task operation'));
    }
    if (args.value !== undefined && args.value !== null && !args.field) {
      return this.handleError(new Error('Field type (field) is required when providing a value. Use "text", "number", "multiSelect", etc.'));
    }

    // Defensive: LLMs may stringify array values for multiSelect fields
    let taskValue = args.value;
    if (typeof taskValue === 'string' && args.field === 'multiSelect') {
      const parsed = parseArrayParam(taskValue);
      if (parsed && parsed.every(v => typeof v === 'string')) {
        taskValue = parsed as string[];
      }
    }

    const result = await this.motionService.addCustomFieldToTask(args.taskId, args.fieldId, taskValue, args.field);
    return formatCustomFieldSuccess('added', 'task', args.taskId, result);
  }

  private async handleRemoveFromTask(args: MotionCustomFieldsArgs): Promise<McpToolResponse> {
    if (!args.taskId || !args.valueId) {
      return this.handleError(new Error('Task ID and valueId (custom field value ID) are required for remove_from_task operation'));
    }

    await this.motionService.removeCustomFieldFromTask(args.taskId, args.valueId);
    return formatCustomFieldSuccess('removed', 'task', args.taskId);
  }
}
