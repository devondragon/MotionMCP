# Feature: Motion API Schema Fixes

## Metadata
- **Feature ID**: epic-001-f04
- **Feature Name**: Motion API Schema Fixes
- **Epic**: EPIC-001 - Improvements
- **Priority**: 🔴 Critical - API is broken for multiple endpoints
- **Status**: TODO
- **Created**: 2025-08-15
- **Source**: Spike-001 Investigation Results

## Context
Comprehensive investigation (spike-001) revealed severe schema mismatches between our TypeScript interfaces and the actual Motion API responses. Only 2 out of 10 API groups are correctly implemented (Schedules and Statuses). Critical issues include completely wrong interfaces for Custom Fields and Recurring Tasks APIs, inconsistent response wrappers, and missing pagination handling.

## Business Value
- **Reliability**: Eliminate runtime errors and data loss
- **Data Integrity**: Ensure all API data is correctly captured
- **Developer Experience**: Accurate types and predictable behavior
- **Maintainability**: Consistent patterns across all APIs

## Success Criteria
- [ ] All API responses correctly typed and validated
- [ ] Pagination works consistently across all list endpoints
- [ ] No runtime type errors in production
- [ ] All API data fields accessible and typed
- [ ] Validation catches malformed responses

## Technical Scope

### APIs Requiring Complete Rewrite
1. **Custom Fields API** - Wrong structure entirely
2. **Recurring Tasks API** - Wrong concept and structure

### APIs Requiring Major Fixes
3. **Comments API** - Missing fields, wrong wrapper
4. **Tasks API** - Multiple field issues, pagination
5. **Projects API** - Field issues, pagination

### APIs Requiring Minor Updates
6. **Workspaces API** - Missing teamId field
7. **Users API** - Verify additional fields

### Cross-Cutting Concerns
8. **Response Wrappers** - Standardize meta/pagination handling
9. **Type Unions** - Fix duration, status variations
10. **Validation Schemas** - Update all Zod schemas

## Dependencies
- Motion API Documentation
- Existing MCP server implementation
- TypeScript type system
- Zod validation library

## Risks
- **Breaking Changes**: Interface updates may break existing code
- **API Changes**: Motion may change their API without notice
- **Testing Gap**: No automated tests to catch regressions
- **Documentation**: Motion docs may be incomplete/outdated

## Implementation Phases

### Phase 1: Critical Fixes (1-2 days)
- Rewrite Custom Fields API
- Rewrite Recurring Tasks API
- Fix Comments API
- Standardize response wrappers
- Fix labels type

### Phase 2: High Priority (2-3 days)
- Add missing required fields
- Fix type unions
- Implement pagination
- Update chunks structure

### Phase 3: Medium Priority (1-2 days)
- Standardize inconsistent fields
- Add optional fields
- Update validation schemas
- Add type guards

## Tasks Overview
Total Tasks: 12
- Critical: 5 tasks
- High: 4 tasks
- Medium: 3 tasks

## Notes
- Investigation completed in spike-001 (2.5 hours)
- API documentation verified at docs.usemotion.com
- Current implementation causing production issues
- Immediate action required for critical APIs