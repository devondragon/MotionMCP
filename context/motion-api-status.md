# Motion API Implementation Status

## Critical API Issues Found 🚨
**Investigation Date**: 2025-08-15
**Status**: Only 2 of 10 API groups correctly implemented (Schedules, Statuses)

## Implemented Endpoints ✅

### Projects
- `GET /projects` - List all projects
- `POST /projects` - Create new project
- `GET /projects/{id}` - Get project details
- `PATCH /projects/{id}` - Update project
- `DELETE /projects/{id}` - Delete project

**Issues Found:**
- ❌ Response wrapped as `{meta: {...}, projects: [...]}`
- ❌ CustomFieldValues wrong structure
- ❌ Missing pagination handling

### Tasks
- `GET /tasks` - List all tasks
- `POST /tasks` - Create new task
- `GET /tasks/{id}` - Get task details
- `PATCH /tasks/{id}` - Update task
- `DELETE /tasks/{id}` - Delete task
- `PATCH /tasks/{id}/move` - Move task ✅
- `PATCH /tasks/{id}/unassign` - Unassign task ✅

**Issues Found:**
- ❌ Response wrapped as `{meta: {...}, tasks: [...]}`
- ❌ Labels are `Array<{name: string}>` not `string[]`
- ❌ Duration can be `number | "NONE" | "REMINDER"`
- ❌ Missing teamId in workspace object
- ❌ CustomFieldValues structure wrong
- ❌ Chunks missing isFixed field

### Workspaces
- `GET /workspaces` - List all workspaces

**Issues Found:**
- ❌ Missing required `teamId` field
- ✅ Direct array response (no wrapper)

### Users
- `GET /users` - List users in workspace
- `GET /users/me` - Get current user ✅

**Status:** Appears mostly correct

### Comments ✅
- `GET /comments` - List comments (requires taskId)
- `POST /comments` - Create comment

**Issues Found:**
- ❌ Response wrapped as `{meta: {...}, comments: [...]}`
- ❌ Missing `creator` object field
- ❌ Returns `createdAt` not `createdTime`

### Custom Fields ⚠️ COMPLETELY WRONG
- `GET /beta/workspaces/{workspaceId}/custom-fields` - List custom fields
- `POST /beta/workspaces/{workspaceId}/custom-fields` - Create custom field
- `DELETE /beta/workspaces/{workspaceId}/custom-fields/{id}` - Delete custom field

**Critical Issues:**
- ❌ Wrong endpoint path (using `/custom-fields` instead of `/beta/workspaces/{id}/custom-fields`)
- ❌ Completely wrong interface structure
- ❌ API returns `{id, field}` not `{id, name, type, options, required, workspaceId}`

### Recurring Tasks ⚠️ COMPLETELY WRONG
- `GET /recurring-tasks` - List recurring tasks
- `POST /recurring-tasks` - Create recurring task
- `DELETE /recurring-tasks/{id}` - Delete recurring task

**Critical Issues:**
- ❌ Response wrapped as `{meta: {...}, tasks: [...]}` (note: "tasks" not "recurringTasks")
- ❌ Returns full task objects, not recurrence configuration
- ❌ Missing all recurrence pattern fields we defined

### Schedules ✅ CORRECT
- `GET /schedules` - Get user schedules

**Status:** 
- ✅ Direct array response
- ✅ Structure matches perfectly

### Statuses ✅ CORRECT
- `GET /statuses` - List available statuses

**Status:**
- ✅ Direct array response
- ✅ All fields correct

## Response Format Patterns

### Wrapped Responses (with pagination)
These endpoints return `{meta: {nextCursor, pageSize}, [resource]: [...]}`
- Tasks: `{meta: {...}, tasks: [...]}`
- Projects: `{meta: {...}, projects: [...]}`
- Comments: `{meta: {...}, comments: [...]}`
- Recurring Tasks: `{meta: {...}, tasks: [...]}` ⚠️ Note: uses "tasks" key

### Direct Array Responses (no pagination)
These endpoints return arrays directly:
- Workspaces: `[...]`
- Schedules: `[...]`
- Statuses: `[...]`
- Custom Fields: `[...]` (when correctly implemented)

### Pagination
Wrapped responses include:
```json
{
  "meta": {
    "nextCursor": "string",  // For next page
    "pageSize": 20          // Items per page
  },
  "resource": [...]
}
```

## Field Type Issues

### Labels
- **Wrong**: `labels: string[]`
- **Correct**: `labels: Array<{name: string}>`

### Duration
- **Wrong**: `duration: number`
- **Correct**: `duration: number | "NONE" | "REMINDER"`

### Status
- **Inconsistent**: Can be `string` or `{name, isDefaultStatus, isResolvedStatus}`

### Custom Field Values
- **Wrong**: `Record<string, unknown>`
- **Correct**: `Record<string, {type: string, value: any}>`

### Workspace
- **Missing**: `teamId` field (required)

## Query Parameters

### Common Filters
- `workspaceId` - Filter by workspace (required for some endpoints)
- `taskId` - Required for comments
- `cursor` - For pagination (not limit/offset)

### Schedules Specific
- `userId` - Filter by user
- `startDate` - Date range start
- `endDate` - Date range end

## Rate Limiting
- Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- 429 responses include `Retry-After` header
- Implement exponential backoff for retries

## Authentication
- Header: `X-API-Key: {api_key}`
- All endpoints require authentication

## Priority Fixes Required

### Critical (Breaking Issues)
1. Custom Fields API - Complete rewrite needed
2. Recurring Tasks API - Complete rewrite needed
3. Response wrapper handling - Standardize across all APIs
4. Pagination implementation - Add cursor support

### High Priority
1. Fix Task/Project labels type
2. Add missing workspace teamId
3. Fix duration type union
4. Fix customFieldValues structure

### Medium Priority
1. Standardize status field handling
2. Add type guards for runtime safety
3. Update all validation schemas

## Notes
- Motion API has inconsistent response patterns
- Some endpoints are BETA (custom fields)
- Documentation at https://docs.usemotion.com/api-reference/
- Investigation spike completed in spike-001