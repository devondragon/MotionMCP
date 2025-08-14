# Task 2.2: Implement Custom Fields API

**Priority:** Missing Core API Features (Priority 2)
**Status:** Current

**Endpoints:** GET /custom-fields, POST /custom-fields, DELETE /custom-fields/{id}  
**Purpose:** Allow flexible data management for tasks and projects

## Implementation Details

### 1. Add to `src/services/motionApi.js`:

```javascript
async getCustomFields(workspaceId = null) {
  try {
    const params = workspaceId ? `?workspaceId=${workspaceId}` : '';
    const response = await this.client.get(`/custom-fields${params}`);
    return response.data?.customFields || response.data || [];
  } catch (error) {
    mcpLog('error', 'Failed to fetch custom fields', {
      method: 'getCustomFields',
      workspaceId,
      error: error.message
    });
    throw new Error(`Failed to fetch custom fields: ${error.message}`);
  }
}

async createCustomField(fieldData) {
  try {
    // fieldData: { name, type, workspaceId, options?, required? }
    const response = await this.client.post('/custom-fields', fieldData);
    return response.data;
  } catch (error) {
    mcpLog('error', 'Failed to create custom field', {
      method: 'createCustomField',
      error: error.message
    });
    throw new Error(`Failed to create custom field: ${error.message}`);
  }
}

async deleteCustomField(fieldId) {
  try {
    await this.client.delete(`/custom-fields/${fieldId}`);
    return { success: true };
  } catch (error) {
    mcpLog('error', 'Failed to delete custom field', {
      method: 'deleteCustomField',
      fieldId,
      error: error.message
    });
    throw new Error(`Failed to delete custom field: ${error.message}`);
  }
}

async addCustomFieldToProject(projectId, fieldId, value = null) {
  try {
    const response = await this.client.post(`/projects/${projectId}/custom-fields`, {
      fieldId,
      value
    });
    return response.data;
  } catch (error) {
    mcpLog('error', 'Failed to add custom field to project', {
      method: 'addCustomFieldToProject',
      projectId,
      fieldId,
      error: error.message
    });
    throw new Error(`Failed to add custom field to project: ${error.message}`);
  }
}

async removeCustomFieldFromProject(projectId, fieldId) {
  try {
    await this.client.delete(`/projects/${projectId}/custom-fields/${fieldId}`);
    return { success: true };
  } catch (error) {
    mcpLog('error', 'Failed to remove custom field from project', {
      method: 'removeCustomFieldFromProject',
      projectId,
      fieldId,
      error: error.message
    });
    throw new Error(`Failed to remove custom field from project: ${error.message}`);
  }
}

// Similar methods for tasks: addCustomFieldToTask, removeCustomFieldFromTask
```

### 2. Add consolidated tool in `src/mcp-server.js`:

```javascript
{
  name: "motion_custom_fields",
  description: "Manage custom fields for tasks and projects",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["list", "create", "delete", "add_to_project", "remove_from_project", "add_to_task", "remove_from_task"],
        description: "Operation to perform"
      },
      fieldId: { type: "string", description: "Custom field ID" },
      workspaceId: { type: "string", description: "Workspace ID" },
      name: { type: "string", description: "Field name (for create)" },
      type: { type: "string", enum: ["text", "number", "date", "select", "multiselect", "checkbox"], description: "Field type (for create)" },
      options: { type: "array", items: { type: "string" }, description: "Options for select/multiselect fields" },
      required: { type: "boolean", description: "Whether field is required" },
      projectId: { type: "string", description: "Project ID (for add/remove operations)" },
      taskId: { type: "string", description: "Task ID (for add/remove operations)" },
      value: { type: ["string", "number", "boolean", "array"], description: "Field value" }
    },
    required: ["operation"]
  }
}
```