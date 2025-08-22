# Code Review Fixes Implementation Plan

## Priority Order & Detailed Steps

### 🔴 HIGH PRIORITY FIXES (Must complete before merge)

#### H1: Fix API Payload Structure (CRITICAL)
**Location**: `src/services/motionApi.ts:1046-1047`
**Issue**: Motion API expects `{name, field, metadata?}` but we're sending `{name, type, metadata?}`

**Steps**:
1. Update `createCustomField` method to transform payload:
   ```typescript
   const apiPayload = { 
     name: fieldData.name, 
     field: fieldData.type,  // Map type -> field
     ...(fieldData.metadata && { metadata: fieldData.metadata }) 
   };
   this.client.post(`/beta/workspaces/${workspaceId}/custom-fields`, apiPayload)
   ```

#### H2: Align Interface Property Naming
**Location**: `src/types/motion.ts:126-132`
**Issue**: Inconsistent naming between `CreateCustomFieldData.type` and `MotionCustomField.field`

**Steps**:
1. Rename `CreateCustomFieldData.type` to `field`
2. Update all references in:
   - `src/mcp-server.ts` handler
   - Type annotations
   - Validation logic

#### H3: Update MCP Server Handler
**Location**: `src/mcp-server.ts:1366-1370`
**Issue**: Handler uses old `type` property after interface change

**Steps**:
1. Update destructuring to use `field` instead of `type`
2. Update fieldData construction
3. Update validation references

### 🟡 MEDIUM PRIORITY FIXES

#### M1: Add Field Type Validation
**Location**: `src/mcp-server.ts:1366-1370`
**Issue**: Options parameter accepted for all field types

**Steps**:
1. Add validation before creating fieldData:
   ```typescript
   if (['select', 'multiSelect'].includes(field) !== Boolean(options)) {
     return formatMcpError(new Error('Options only allowed for select/multiSelect fields'));
   }
   ```

#### M2: Fix Schema Over-Constraint
**Location**: `src/mcp-server.ts:752`
**Issue**: workspaceId required for operations that don't need it

**Steps**:
1. Analyze which operations actually need workspaceId
2. Either make conditionally required or update handlers to use it

### 🟢 LOW PRIORITY FIXES

#### L1: Remove Duplicate Error Helper
**Location**: `src/services/motionApi.ts:32`
**Steps**:
1. Replace custom `isAxiosError` with native `axios.isAxiosError`
2. Update all references

## Implementation Order

1. **H2 first** - Fix interface naming (affects everything else)
2. **H1** - Fix API payload (depends on interface changes)  
3. **H3** - Update MCP handler (depends on interface changes)
4. **M1** - Add validation (independent)
5. **M2** - Fix schema constraint (independent)
6. **L1** - Clean up error helper (independent)
7. **Test compilation and functionality**
8. **Update documentation**

## Files to Modify

- `src/types/motion.ts` - Interface changes
- `src/services/motionApi.ts` - API payload fix, error helper cleanup
- `src/mcp-server.ts` - Handler updates, validation, schema fixes  
- `src/types/mcp-tool-args.ts` - Type updates if needed

## Testing Checklist

- [ ] TypeScript compilation successful
- [ ] MCP server starts without errors
- [ ] Custom field creation payload matches Motion API spec
- [ ] Validation works for select/multiSelect options
- [ ] All operations handle workspaceId correctly

## Context Save Notes

**Current State**: Code review completed, 8 fixes identified across 3 priority levels
**Branch**: `feature/task-001-rewrite-custom-fields-api` 
**Last Action**: Generated detailed implementation plan
**Next Action**: Start with H2 (interface naming) as it affects other fixes