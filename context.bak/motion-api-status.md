# Motion API Implementation Status

## Implemented Endpoints ✅

### Projects
- `GET /projects` - List all projects
- `POST /projects` - Create new project
- `GET /projects/{id}` - Get project details
- `PATCH /projects/{id}` - Update project
- `DELETE /projects/{id}` - Delete project

### Tasks
- `GET /tasks` - List all tasks
- `POST /tasks` - Create new task
- `GET /tasks/{id}` - Get task details
- `PATCH /tasks/{id}` - Update task
- `DELETE /tasks/{id}` - Delete task

### Workspaces
- `GET /workspaces` - List all workspaces

### Users
- `GET /users` - List all users

## Planned Endpoints 🔄

### Comments (Task 2.1)
- `GET /comments` - List comments
- `POST /comments` - Create comment

### Custom Fields (Task 2.2)
- `GET /custom-fields` - List custom fields
- `POST /custom-fields` - Create custom field
- `DELETE /custom-fields/{id}` - Delete custom field
- `POST /projects/{id}/custom-fields` - Add field to project
- `DELETE /projects/{id}/custom-fields/{fieldId}` - Remove field from project
- `POST /tasks/{id}/custom-fields` - Add field to task
- `DELETE /tasks/{id}/custom-fields/{fieldId}` - Remove field from task

### Recurring Tasks (Task 2.3)
- `GET /recurring-tasks` - List recurring tasks
- `POST /recurring-tasks` - Create recurring task
- `DELETE /recurring-tasks/{id}` - Delete recurring task

### Task Operations (Task 2.4)
- `PATCH /tasks/{id}/move` - Move task to different project/workspace
- `PATCH /tasks/{id}/unassign` - Remove task assignment

### Schedules (Task 3.1)
- `GET /schedules` - Get user schedules

### Statuses (Task 3.2)
- `GET /statuses` - List available statuses

### Current User (Task 3.3)
- `GET /users/me` - Get authenticated user details

## Response Format Notes

### Wrapped Responses
Some endpoints wrap data in an object:
```json
{
  "projects": [...],
  "meta": { ... }
}
```

### Direct Responses
Some endpoints return data directly:
```json
[
  { "id": "1", "name": "Project 1" },
  { "id": "2", "name": "Project 2" }
]
```

### Error Responses
Standard error format:
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Description of error",
    "status": 400
  }
}
```

## Query Parameters

### Common Filters
- `workspaceId` - Filter by workspace
- `projectId` - Filter by project (tasks)
- `status` - Filter by status
- `assigneeId` - Filter by assigned user

### Pagination
- `limit` - Number of results (default: 100)
- `offset` - Skip N results
- `cursor` - Cursor-based pagination (some endpoints)

### Sorting
- `sortBy` - Field to sort by
- `sortOrder` - asc/desc

## Rate Limiting

- Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- 429 responses include `Retry-After` header
- Implement exponential backoff for retries

## Authentication

- Header: `X-API-Key: {api_key}`
- All endpoints require authentication
- API keys are workspace-specific

## Known Limitations

- No webhook support currently
- No batch operations endpoint
- Limited search capabilities
- No GraphQL API
- Custom fields API may be limited in free tier