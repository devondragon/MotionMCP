# Task 001: Rewrite Custom Fields API

## Metadata
- **Task ID**: epic-001-f04-task-001
- **Priority**: 🔴 Critical - API completely broken
- **Estimated Effort**: 4 hours
- **Dependencies**: None
- **Status**: COMPLETED - 2025-08-22

## Problem Statement
The Custom Fields API implementation is completely wrong. Our interface expects `{id, name, type, options, required, workspaceId}` but the API actually returns `{id, field}`. Additionally, we're calling the wrong endpoint path.

## API Documentation URL
Reference the API documenation here - https://docs.usemotion.com/api-reference/custom-fields/get/

## Current Issues
1. **Wrong Interface Structure**
   - Expected: `{id, name, type, options, required, workspaceId}`
   - Actual: `{id, field}` where `field` is the type string
2. **Wrong API Path**
   - Current: `/custom-fields`
   - Correct: `/beta/workspaces/{workspaceId}/custom-fields`
3. **No Direct Array Response**
   - Response is workspace-scoped, not global
4. **Missing BETA Endpoint Handling**

## Requirements
- [ ] Update `MotionCustomField` interface to match actual API
- [ ] Fix API endpoint path to use beta workspace-scoped URL
- [ ] Update all custom field CRUD operations
- [ ] Fix response handling (no wrapper expected)
- [ ] Update validation schemas
- [ ] Maintain backward compatibility if possible

## Implementation Details

### 1. Update Interface
```typescript
// OLD (Wrong)
export interface MotionCustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox';
  options?: string[];
  required?: boolean;
  workspaceId?: string;
}

// NEW (Correct)
export interface MotionCustomField {
  id: string;
  field: 'text' | 'url' | 'date' | 'person' | 'multiPerson' |
         'phone' | 'select' | 'multiSelect' | 'number' |
         'email' | 'checkbox' | 'relatedTo';
}
```

### 2. Fix API Paths
- GET: `/beta/workspaces/{workspaceId}/custom-fields`
- POST: `/beta/workspaces/{workspaceId}/custom-fields`
- DELETE: `/beta/workspaces/{workspaceId}/custom-fields/{fieldId}`

### 3. Update Methods
- `getCustomFields(workspaceId: string)` - Make workspaceId required
- `createCustomField(workspaceId: string, fieldData)`
- `deleteCustomField(workspaceId: string, fieldId: string)`

## Testing Checklist
- [ ] Test listing custom fields with workspace ID
- [ ] Test creating new custom field
- [ ] Test deleting custom field
- [ ] Verify field types match new enum values
- [ ] Test error handling for invalid workspace

## Acceptance Criteria
- [ ] Custom fields API calls succeed without errors
- [ ] All field types from API are supported
- [ ] Workspace scoping works correctly
- [ ] Beta endpoint path is used
- [ ] Types match actual API responses

## Notes
- This is a BETA API endpoint - may change
- Completely different from our current implementation
- Will require updates to all code using custom fields
- Consider adding migration helper for existing data

## Implementation Summary (Completed 2025-08-22)
✅ **All Critical Issues Fixed:**

1. **Fixed Interface Structure**: Updated `MotionCustomField` to match actual API response `{id, field}`
2. **Fixed API Endpoints**: Updated all endpoints to use `/beta/workspaces/{workspaceId}/custom-fields` 
3. **Fixed Method Signatures**: 
   - `getCustomFields(workspaceId: string)` - now requires workspaceId
   - `createCustomField(workspaceId: string, fieldData)` - workspace-scoped creation
   - `deleteCustomField(workspaceId: string, fieldId: string)` - workspace-scoped deletion
4. **Updated Field Types**: Support all 12 API field types (text, url, date, person, multiPerson, phone, select, multiSelect, number, email, checkbox, relatedTo)
5. **Fixed Cache Invalidation**: Workspace-scoped cache keys `custom-fields:${workspaceId}`
6. **Updated MCP Server**: Tool schema and handlers updated for new API structure
7. **Updated Response Formatters**: Fixed to handle new interface structure

**Files Modified:**
- `src/types/motion.ts` - Interface updates
- `src/services/motionApi.ts` - API endpoint and method signature fixes  
- `src/mcp-server.ts` - Handler and schema updates
- `src/types/mcp-tool-args.ts` - Tool argument type updates
- `src/utils/responseFormatters.ts` - Response formatting fixes

**Testing:** ✅ Build successful, MCP server starts correctly, API signatures validated.
