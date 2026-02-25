/**
 * Custom Field resource module — getCustomFields, createCustomField, deleteCustomField,
 * addCustomFieldToProject, removeCustomFieldFromProject,
 * addCustomFieldToTask, removeCustomFieldFromTask
 */

import { AxiosResponse, isAxiosError } from 'axios';
import { MotionCustomField, MotionCustomFieldValue, CreateCustomFieldData } from '../../types/motion';
import { LOG_LEVELS, createMinimalPayload } from '../../utils/constants';
import { mcpLog } from '../../utils/logger';
import { ResourceContext } from './types';
import { getErrorMessage } from './ApiClient';

export async function getCustomFields(ctx: ResourceContext, workspaceId: string): Promise<MotionCustomField[]> {
  const cacheKey = `custom-fields:${workspaceId}`;

  return ctx.cache.customField.withCache(cacheKey, async () => {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching custom fields from Motion API', {
        method: 'getCustomFields',
        workspaceId
      });

      const url = `/beta/workspaces/${workspaceId}/custom-fields`;

      const response: AxiosResponse<MotionCustomField[]> = await ctx.api.requestWithRetry(() => ctx.api.client.get(url));

      // Beta API returns direct array, not wrapped
      const fieldsArray = response.data || [];

      mcpLog(LOG_LEVELS.INFO, 'Custom fields fetched successfully', {
        method: 'getCustomFields',
        count: fieldsArray.length,
        workspaceId
      });

      return fieldsArray;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch custom fields', {
        method: 'getCustomFields',
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
        workspaceId
      });
      throw ctx.api.formatApiError(error, 'fetch', 'custom field');
    }
  });
}

export async function createCustomField(ctx: ResourceContext, workspaceId: string, fieldData: CreateCustomFieldData): Promise<MotionCustomField> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Creating custom field in Motion API', {
      method: 'createCustomField',
      name: fieldData.name,
      field: fieldData.field,
      workspaceId
    });

    // Transform payload to match Motion API expectations
    // POST API expects 'type' in request, but returns 'field' in response
    const apiPayload = {
      name: fieldData.name,
      type: fieldData.field,  // Motion API POST expects 'type' property in request body
      ...(fieldData.required !== undefined && { required: fieldData.required }),
      ...(fieldData.metadata && { metadata: fieldData.metadata })
    };

    // Create minimal payload by removing empty/null values to avoid validation errors
    const minimalPayload = createMinimalPayload(apiPayload);

    const response: AxiosResponse<MotionCustomField> = await ctx.api.requestWithRetry(() =>
      ctx.api.client.post(`/beta/workspaces/${workspaceId}/custom-fields`, minimalPayload)
    );

    // Invalidate cache after successful creation
    ctx.cache.customField.invalidate(`custom-fields:${workspaceId}`);

    mcpLog(LOG_LEVELS.INFO, 'Custom field created successfully', {
      method: 'createCustomField',
      fieldId: response.data?.id,
      name: fieldData.name,
      workspaceId
    });

    return response.data;
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Failed to create custom field', {
      method: 'createCustomField',
      error: getErrorMessage(error),
      apiStatus: isAxiosError(error) ? error.response?.status : undefined,
      apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
      fieldName: fieldData?.name,
      workspaceId
    });
    throw ctx.api.formatApiError(error, 'create', 'custom field', undefined, fieldData.name);
  }
}

export async function deleteCustomField(ctx: ResourceContext, workspaceId: string, fieldId: string): Promise<{ success: boolean }> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Deleting custom field from Motion API', {
      method: 'deleteCustomField',
      fieldId,
      workspaceId
    });

    await ctx.api.requestWithRetry(() =>
      ctx.api.client.delete(`/beta/workspaces/${workspaceId}/custom-fields/${fieldId}`)
    );

    // Invalidate cache after successful deletion
    ctx.cache.customField.invalidate(`custom-fields:${workspaceId}`);

    mcpLog(LOG_LEVELS.INFO, 'Custom field deleted successfully', {
      method: 'deleteCustomField',
      fieldId,
      workspaceId
    });

    return { success: true };
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Failed to delete custom field', {
      method: 'deleteCustomField',
      error: getErrorMessage(error),
      apiStatus: isAxiosError(error) ? error.response?.status : undefined,
      apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
      fieldId,
      workspaceId
    });
    throw ctx.api.formatApiError(error, 'delete', 'custom field', fieldId);
  }
}

export async function addCustomFieldToProject(ctx: ResourceContext, projectId: string, fieldId: string, value?: string | number | boolean | string[] | null, fieldType?: string): Promise<MotionCustomFieldValue> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Adding custom field to project', {
      method: 'addCustomFieldToProject',
      projectId,
      fieldId,
      hasValue: value !== undefined
    });

    // API expects: { customFieldInstanceId, value: { type, value } }
    // Value type uses camelCase per API docs (e.g., text, multiSelect)
    const requestData: Record<string, unknown> = {
      customFieldInstanceId: fieldId,
    };
    if (value !== undefined) {
      if (value === null) {
        requestData.value = fieldType !== undefined
          ? { type: fieldType, value: null }
          : { value: null };
      } else {
        if (!fieldType) {
          throw new Error('Field type is required when setting a non-null custom field value');
        }
        requestData.value = {
          type: fieldType,
          value
        };
      }
    }

    const response: AxiosResponse<MotionCustomFieldValue> = await ctx.api.requestWithRetry(() =>
      ctx.api.client.post(`/beta/custom-field-values/project/${projectId}`, requestData)
    );

    // Invalidate project cache broadly — the API response is { type, value },
    // not a full project object, so we don't have workspace context
    ctx.cache.project.invalidate(`projects:`);

    mcpLog(LOG_LEVELS.INFO, 'Custom field added to project successfully', {
      method: 'addCustomFieldToProject',
      projectId,
      fieldId
    });

    return response.data;
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Failed to add custom field to project', {
      method: 'addCustomFieldToProject',
      error: getErrorMessage(error),
      apiStatus: isAxiosError(error) ? error.response?.status : undefined,
      apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
      projectId,
      fieldId
    });
    throw ctx.api.formatApiError(error, 'update', 'project', projectId);
  }
}

export async function removeCustomFieldFromProject(ctx: ResourceContext, projectId: string, valueId: string): Promise<{ success: boolean }> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Removing custom field from project', {
      method: 'removeCustomFieldFromProject',
      projectId,
      valueId
    });

    await ctx.api.requestWithRetry(() =>
      ctx.api.client.delete(`/beta/custom-field-values/project/${projectId}/custom-fields/${valueId}`)
    );

    // Invalidate all project caches since we don't have workspace context here
    ctx.cache.project.invalidate(`projects:`);

    mcpLog(LOG_LEVELS.INFO, 'Custom field removed from project successfully', {
      method: 'removeCustomFieldFromProject',
      projectId,
      valueId
    });

    return { success: true };
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Failed to remove custom field from project', {
      method: 'removeCustomFieldFromProject',
      error: getErrorMessage(error),
      apiStatus: isAxiosError(error) ? error.response?.status : undefined,
      apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
      projectId,
      valueId
    });
    throw ctx.api.formatApiError(error, 'update', 'project', projectId);
  }
}

export async function addCustomFieldToTask(ctx: ResourceContext, taskId: string, fieldId: string, value?: string | number | boolean | string[] | null, fieldType?: string): Promise<MotionCustomFieldValue> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Adding custom field to task', {
      method: 'addCustomFieldToTask',
      taskId,
      fieldId,
      hasValue: value !== undefined
    });

    // API expects: { customFieldInstanceId, value: { type, value } }
    // Value type uses camelCase per API docs (e.g., text, multiSelect)
    const requestData: Record<string, unknown> = {
      customFieldInstanceId: fieldId,
    };
    if (value !== undefined) {
      if (value === null) {
        requestData.value = fieldType !== undefined
          ? { type: fieldType, value: null }
          : { value: null };
      } else {
        if (!fieldType) {
          throw new Error('Field type is required when setting a non-null custom field value');
        }
        requestData.value = {
          type: fieldType,
          value
        };
      }
    }

    const response: AxiosResponse<MotionCustomFieldValue> = await ctx.api.requestWithRetry(() =>
      ctx.api.client.post(`/beta/custom-field-values/task/${taskId}`, requestData)
    );

    mcpLog(LOG_LEVELS.INFO, 'Custom field added to task successfully', {
      method: 'addCustomFieldToTask',
      taskId,
      fieldId
    });

    return response.data;
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Failed to add custom field to task', {
      method: 'addCustomFieldToTask',
      error: getErrorMessage(error),
      apiStatus: isAxiosError(error) ? error.response?.status : undefined,
      apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
      taskId,
      fieldId
    });
    throw ctx.api.formatApiError(error, 'update', 'task', taskId);
  }
}

export async function removeCustomFieldFromTask(ctx: ResourceContext, taskId: string, valueId: string): Promise<{ success: boolean }> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Removing custom field from task', {
      method: 'removeCustomFieldFromTask',
      taskId,
      valueId
    });

    await ctx.api.requestWithRetry(() =>
      ctx.api.client.delete(`/beta/custom-field-values/task/${taskId}/custom-fields/${valueId}`)
    );

    mcpLog(LOG_LEVELS.INFO, 'Custom field removed from task successfully', {
      method: 'removeCustomFieldFromTask',
      taskId,
      valueId
    });

    return { success: true };
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Failed to remove custom field from task', {
      method: 'removeCustomFieldFromTask',
      error: getErrorMessage(error),
      apiStatus: isAxiosError(error) ? error.response?.status : undefined,
      apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
      taskId,
      valueId
    });
    throw ctx.api.formatApiError(error, 'update', 'task', taskId);
  }
}
