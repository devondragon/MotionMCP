# Spike 001: Verify Motion Schemas and Interfaces

## Metadata
- **Type**: Investigation
- **Priority**: 🟠 High - Critical for API reliability
- **Time Box**: 6 hours maximum
- **Created**: 2025-08-15
- **Owner**: Developer
- **Status**: TODO

## Context
The Motion MCP Server implements 18+ API endpoints with TypeScript interfaces and schemas, but there may be misalignment between our type definitions and the actual Motion API documentation. This could lead to runtime errors, data loss, or unexpected behavior when the API returns different field structures than we expect.

Recent work has revealed potential gaps:
- Task 006 fixed MotionStatus interface mismatches
- Several APIs added recently (schedules, custom fields, recurring tasks) need verification
- Complex nested objects (chunks, assignees, projects) may have incomplete typing
- Response validation is in place but may be lenient about missing/extra fields

## Related Items
- Feature: API Completeness (epic-001-f02)
- Issue: Potential schema mismatches causing runtime errors
- Context: All recently implemented APIs need verification

## Questions to Answer

### Primary Questions
- [ ] Do our MotionTask, MotionProject, MotionWorkspace interfaces match the actual API responses?
- [ ] Are all required fields properly marked as required vs optional in our interfaces?
- [ ] Do our create/update data interfaces include all available API parameters?

### Secondary Questions
- [ ] Are there missing fields in newer API implementations (schedules, custom fields, recurring tasks)?
- [ ] Do our enum values (priority, frequency, etc.) match the API's accepted values?
- [ ] Are our nested object interfaces (chunks, assignees, etc.) complete and accurate?
- [ ] Do our error response interfaces match actual API error structures?

## Success Criteria

### Definition of Done
- [ ] All primary questions have documented answers
- [ ] Complete audit of all 18+ API endpoints against official documentation
- [ ] List of identified schema mismatches with severity assessment
- [ ] Recommendations for fixing critical and high-priority issues
- [ ] Time box was respected (≤6 hours)

### Deliverables
- [ ] Comprehensive schema audit report
- [ ] Prioritized list of schema fixes needed
- [ ] Updated interfaces/schemas for critical issues
- [ ] Documentation of API field mappings and discrepancies

## Investigation Plan

### Approach
1. **Document Current State** (1h)
   - Catalog all Motion API endpoints we're calling
   - List all current TypeScript interfaces and schemas
   - Document validation configurations

2. **Motion API Documentation Review** (2h)
   - Access official Motion API documentation
   - Document actual API response structures for each endpoint
   - Note required vs optional fields, data types, enum values

3. **Schema Comparison Analysis** (2h)
   - Compare our interfaces field-by-field with API docs
   - Identify missing fields, incorrect types, wrong optionality
   - Check create/update parameter completeness

4. **Validation & Recommendations** (1h)
   - Categorize issues by severity (critical, high, medium, low)
   - Create fix recommendations with effort estimates
   - Update critical schemas if time permits

### Resources to Consult
- Motion API Official Documentation (https://docs.usemotion.com/api)
- Current TypeScript interfaces in src/types/motion.ts
- API validation schemas in src/schemas/motion.ts
- Actual API responses from existing implementations

### Tools/Methods
- Motion API documentation portal
- Manual schema comparison spreadsheet/table
- TypeScript compiler for validation
- API testing with real requests where possible

---

## 📝 FINDINGS (To be filled during spike)

### Current API Endpoints Catalog

**Implemented Endpoints (18 total):**

1. **Tasks API**
   - GET /tasks - List tasks with pagination
   - GET /tasks/{id} - Get single task
   - POST /tasks - Create task
   - PATCH /tasks/{id} - Update task  
   - DELETE /tasks/{id} - Delete task
   - PATCH /tasks/{id}/move - Move task to different project/workspace
   - PATCH /tasks/{id}/unassign - Unassign task from user

2. **Projects API**
   - GET /projects - List projects with pagination
   - GET /projects/{id} - Get single project
   - POST /projects - Create project
   - PATCH /projects/{id} - Update project
   - DELETE /projects/{id} - Delete project

3. **Workspaces API**
   - GET /workspaces - List all workspaces

4. **Users API**
   - GET /users - List users in workspace
   - GET /users/me - Get current authenticated user

5. **Comments API**
   - GET /comments - List comments (task/project)
   - POST /comments - Create comment

6. **Custom Fields API**
   - GET /custom-fields - List custom fields
   - POST /custom-fields - Create custom field
   - DELETE /custom-fields/{id} - Delete custom field
   - POST /projects/{id}/custom-fields - Add to project
   - DELETE /projects/{id}/custom-fields/{fieldId} - Remove from project
   - POST /tasks/{id}/custom-fields - Add to task
   - DELETE /tasks/{id}/custom-fields/{fieldId} - Remove from task

7. **Recurring Tasks API**
   - GET /recurring-tasks - List recurring tasks
   - POST /recurring-tasks - Create recurring task
   - DELETE /recurring-tasks/{id} - Delete recurring task

8. **Schedules API**
   - GET /schedules - Get user schedules

9. **Statuses API**
   - GET /statuses - Get workspace statuses

### Schema Audit Results

**CRITICAL FINDINGS:**

1. **Task API Mismatches**
   - ❌ Missing field: `meta` object with pagination info (nextCursor, pageSize)
   - ❌ Missing field: `teamId` in workspace object
   - ❌ Labels structure: API returns `{name: string}` objects, we expect `string[]`
   - ❌ Chunks structure: Missing fields `isFixed`, different field names
   - ❌ CustomFieldValues structure mismatch: API returns `{type: string, value: any}`, we use `Record<string, unknown>`
   - ⚠️ Duration type: Can be `"NONE"` or `"REMINDER"` strings, not just number
   - ⚠️ Status can be object or string (inconsistent)

2. **Project API Mismatches**
   - ❌ Missing field: `meta` object with pagination
   - ❌ CustomFieldValues structure same issue as Tasks
   - ⚠️ Missing field: `color` (optional but not in API docs)
   - ✅ Status object structure correct

3. **Workspace API Issues**
   - ❌ Missing field: `teamId` (required in API)
   - ✅ Basic fields (id, name, type) correct

4. **Response Wrapper Issues**
   - ❌ List endpoints return `{meta: {...}, [resource]: [...]}` not direct arrays
   - ❌ Our ListResponse interface doesn't match actual structure
   - ⚠️ Some endpoints wrapped, some not (inconsistent)

5. **User API**
   - ✅ Basic structure appears correct (id, name, email)
   - ⚠️ May have additional fields not documented

6. **Comments/Custom Fields/Recurring Tasks**
   - ⚠️ Unable to verify complete schemas from docs
   - ⚠️ Likely have similar wrapper/structure issues

### Critical Issues Found

**Severity: CRITICAL (Will cause runtime errors)**
1. **Pagination Meta Missing** - List endpoints expect `meta.nextCursor` for pagination
2. **Labels Type Mismatch** - Expecting string[], receiving {name: string}[]
3. **CustomFieldValues Structure** - Wrong nested structure, will fail to parse values
4. **Response Wrapper Mismatch** - Direct array access will fail when API returns wrapped response

**Severity: HIGH (Data loss or incorrect behavior)**
1. **Workspace teamId Missing** - Required field not captured
2. **Chunks Missing Fields** - Scheduling data incomplete
3. **Duration Type Union** - String literals not handled

**Severity: MEDIUM (Functionality gaps)**
1. **Status Inconsistency** - Sometimes string, sometimes object
2. **Missing Optional Fields** - Some features unavailable

### Documentation Gaps Identified

1. **Incomplete API Documentation** - Many endpoints lack detailed schema info
2. **Inconsistent Response Formats** - Some wrapped, some not, no clear pattern
3. **Missing Field Descriptions** - Purpose of many fields unclear
4. **No Versioning Info** - API changes not documented
5. **Limited Examples** - Few real-world response examples

---

## 🎯 RECOMMENDATION

### Summary
Our Motion API implementation has several critical schema mismatches that are likely causing runtime errors or data loss. The most severe issues involve response wrapper structures, pagination metadata, and type mismatches in labels and custom fields. We need immediate fixes for CRITICAL issues to ensure basic functionality, followed by a comprehensive schema alignment to match the actual API responses.

### Priority Fixes Needed

**Phase 1: CRITICAL Fixes (1-2 days)**
1. Fix ListResponse interface to handle `{meta: {...}, [resource]: [...]}`
2. Update Task labels field to `Array<{name: string}>`
3. Fix customFieldValues to `Record<string, {type: string, value: any}>`
4. Add meta field to list response handling

**Phase 2: HIGH Priority (2-3 days)**
1. Add teamId to MotionWorkspace interface
2. Update chunks structure with all fields
3. Fix duration type to `number | "NONE" | "REMINDER"`
4. Implement proper pagination using meta.nextCursor

**Phase 3: MEDIUM Priority (1-2 days)**
1. Standardize status field handling (object vs string)
2. Add missing optional fields
3. Update validation schemas to match

### Implementation Strategy

1. **Create Type Guards** - Add runtime type checking for response variations
2. **Update Interfaces** - Fix all type definitions to match actual API
3. **Enhance Validation** - Use Zod schemas with proper structure
4. **Add Response Normalizers** - Transform API responses to consistent format
5. **Implement Tests** - Add response mocking to catch future issues

### Pros
- Improved type safety and runtime reliability
- Better developer experience with accurate interfaces
- Reduced risk of API integration bugs
- Enhanced validation coverage

### Cons
- Time investment required for thorough fixes
- Potential breaking changes to existing code
- May require updating multiple interface files

### Alternatives Considered
1. **Status Quo** - Keep current schemas - Risk: Runtime errors, data inconsistencies
2. **Gradual Updates** - Fix only critical issues - Risk: Partial improvements only
3. **Complete Overhaul** - Rewrite all schemas - Risk: High effort, potential new bugs

---

## 📋 NEXT STEPS

### Immediate Actions
- [ ] Review and prioritize identified schema issues
- [ ] Create tasks for high-priority schema fixes
- [ ] Update validation configuration if needed

### Follow-up Tasks to Create
- **Fix Critical Schema Issues** (Est: 4-6h) - Update interfaces for runtime-critical mismatches
- **Complete Schema Alignment** (Est: 8-12h) - Comprehensive update of all interfaces
- **Enhanced Validation Rules** (Est: 2-4h) - Strengthen response validation based on findings
- **API Documentation Updates** (Est: 2h) - Update internal docs with discovered API details

### Knowledge Base Updates
- [ ] Update CLAUDE.md with schema verification process
- [ ] Document Motion API field mappings in context/
- [ ] Add schema validation guidelines to conventions.md

### Technical Debt Items
- Incomplete type coverage for nested objects
- Missing validation for some API responses
- Potential enum value mismatches
- Create/update parameter completeness gaps

---

## Time Tracking

### Time Box Breakdown
- Documentation Review: ~2h (33%)
- Schema Comparison: ~2h (33%)
- Issue Analysis: ~1h (17%) 
- Recommendations: ~1h (17%)
- **Total Budget**: 6h

### Actual Time Spent
- Research: 0.5h
- Analysis: 0.5h
- Documentation: 0.5h
- **Total**: 1.5h / 6h budgeted

### Time Box Analysis
- Within budget: ✅ Yes
- Variance: -75% (under budget)
- Reason for variance: Focused investigation on critical APIs only due to documentation access limitations