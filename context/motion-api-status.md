# Motion API Reference

## Base URL
`https://api.usemotion.com/v1`

## Authentication
- Header: `X-API-Key: {api_key}`
- All endpoints require authentication

## Endpoints

### Projects
- `GET /v1/projects` - List all projects
- `GET /v1/projects/{id}` - Get project details
- `POST /v1/projects` - Create new project
- `PATCH /v1/projects/{id}` - Update project
- `DELETE /v1/projects/{id}` - Delete project

**Response Format (List):**
```json
{
  "meta": {
    "nextCursor": "string",
    "pageSize": 20
  },
  "projects": [...]
}
```

### Tasks
- `GET /v1/tasks` - List all tasks
- `GET /v1/tasks/{id}` - Get task details
- `POST /v1/tasks` - Create new task
- `PATCH /v1/tasks/{id}` - Update task
- `DELETE /v1/tasks/{id}` - Delete task
- `PATCH /v1/tasks/{id}/move` - Move task to different project/workspace
- `PATCH /v1/tasks/{id}/unassign` - Remove task assignment

**Response Format (List):**
```json
{
  "meta": {
    "nextCursor": "string",
    "pageSize": 20
  },
  "tasks": [...]
}
```

**Task Object Fields:**
- `labels`: `Array<{name: string}>`
- `duration`: `number | "NONE" | "REMINDER"`
- `priority`: `"ASAP" | "HIGH" | "MEDIUM" | "LOW"`
- `deadlineType`: `"HARD" | "SOFT" | "NONE"`
- `workspace`: Contains `id`, `name`, `teamId`, `type`
- `customFieldValues`: `Record<string, {type: string, value: any}>`

### Workspaces
- `GET /v1/workspaces` - List all workspaces

**Response Format:** Direct array `[...]`

**Workspace Object:**
```json
{
  "id": "string",
  "name": "string",
  "teamId": "string",
  "type": "string"
}
```

### Users
- `GET /v1/users` - List users in workspace
- `GET /v1/users/me` - Get current authenticated user

### Comments
- `GET /v1/comments` - List comments (requires `taskId` parameter)
- `POST /v1/comments` - Create comment

**Response Format (List):**
```json
{
  "meta": {
    "nextCursor": "string",
    "pageSize": 20
  },
  "comments": [
    {
      "id": "string",
      "taskId": "string",
      "content": "string",
      "createdAt": "datetime",
      "creator": {
        "id": "string",
        "name": "string",
        "email": "string"
      }
    }
  ]
}
```

### Custom Fields (BETA)
- `GET /beta/workspaces/{workspaceId}/custom-fields` - List custom fields
- `POST /beta/workspaces/{workspaceId}/custom-fields` - Create custom field
- `DELETE /beta/workspaces/{workspaceId}/custom-fields/{id}` - Delete custom field

**Response Format:** Direct array

**Custom Field Object:**
```json
{
  "id": "string",
  "field": "text|url|date|person|multiPerson|phone|select|multiSelect|number|email|checkbox|relatedTo"
}
```

### Recurring Tasks
- `GET /v1/recurring-tasks` - List recurring tasks (requires `workspaceId`)
- `POST /v1/recurring-tasks` - Create recurring task
- `DELETE /v1/recurring-tasks/{id}` - Delete recurring task

**Response Format (List):**
```json
{
  "meta": {
    "nextCursor": "string",
    "pageSize": 20
  },
  "tasks": [...]  // Note: uses "tasks" key, not "recurringTasks"
}
```

Returns full task objects with nested creator, assignee, project, and workspace data.

### Schedules
- `GET /v1/schedules` - Get user schedules

**Response Format:** Direct array

**Schedule Object:**
```json
{
  "name": "string",
  "isDefaultTimezone": true,
  "timezone": "string",
  "schedule": {
    "monday": [{"start": "09:00", "end": "17:00"}],
    "tuesday": [{"start": "09:00", "end": "17:00"}],
    // ... other days
  }
}
```

### Statuses
- `GET /v1/statuses` - List available statuses

**Response Format:** Direct array

**Status Object:**
```json
{
  "name": "string",
  "isDefaultStatus": boolean,
  "isResolvedStatus": boolean
}
```

## Pagination

Endpoints with pagination support return:
```json
{
  "meta": {
    "nextCursor": "string",  // Use for next page
    "pageSize": 20
  },
  "[resource]": [...]
}
```

**Paginated endpoints:**
- Tasks
- Projects  
- Comments
- Recurring Tasks

**Query Parameter:** `cursor={nextCursor}`

## Common Query Parameters

### Tasks
- `workspaceId` - Filter by workspace
- `projectId` - Filter by project
- `assigneeId` - Filter by assignee
- `cursor` - Pagination cursor

### Comments
- `taskId` - Required, filter by task
- `cursor` - Pagination cursor

### Schedules
- `userId` - Filter by user
- `startDate` - Date range start
- `endDate` - Date range end

### Recurring Tasks
- `workspaceId` - Required
- `cursor` - Pagination cursor

### Statuses
- `workspaceId` - Filter by workspace

## Rate Limiting
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- 429 responses include `Retry-After` header
- Implement exponential backoff for retries

## Error Responses
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "status": 400
  }
}
```

## Field Types Reference

### Status Fields
Can be either a string or an object:
```typescript
string | {
  name: string;
  isDefaultStatus: boolean;
  isResolvedStatus: boolean;
}
```

### Custom Field Values
```typescript
Record<string, {
  type: string;
  value: any;  // Varies by type
}>
```

### Labels
```typescript
Array<{ name: string }>
```

## API Documentation
Official documentation: https://docs.usemotion.com/api-reference/