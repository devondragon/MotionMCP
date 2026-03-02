# Changelog

All notable changes to this project will be documented in this file.

## [2.8.0] - 2026-03-02

### 🐛 Bug Fixes

- **Hardened object/array parameters against LLM stringification**: Some MCP transports serialize structured parameters as JSON strings (e.g., `'{"type":"weekly"}'` instead of `{"type":"weekly"}`). Added defensive parsing with `parseObjectParam()` and `parseArrayParam()` utilities that transparently handle both native and stringified inputs. Applied to: (#88, #89)
  - `autoScheduled` parameter in task create/update (fixed in PR #89)
  - `frequency` object in recurring task creation
  - `status` array in task list filtering
  - `value` array for multiSelect custom fields

### 📖 Documentation

- **Fixed stale README tool descriptions**: Corrected `motion_search` operations (only `content` exists; removed references to deleted `context` and `smart` operations) and `motion_workspaces` operations (removed non-existent `set_default`).

### 📦 Dependencies

- **hono**: 4.12.1 → 4.12.2 (#86)
- **rollup**: 4.57.1 → 4.59.0 (#87)

## [2.7.0] - 2026-02-25

### 🏗️ Refactoring

- **Split `motionApi.ts` into resource modules**: Decomposed the monolithic 1,850-line `MotionApiService` into 10 focused resource modules under `src/services/api/`. The facade class (`motionApi.ts`) is now ~254 lines of pure delegation with no business logic. Each module exports standalone async functions that accept a `ResourceContext` (`{ api, cache }`), making the codebase easier to navigate, test, and extend. (#52, #85)
  - New modules: `tasks`, `projects`, `workspaces`, `users`, `comments`, `customFields`, `recurringTasks`, `schedules`, `search`, `statuses`
  - Extracted `ApiClient` (HTTP client with retry/backoff) and `CacheManager` (per-resource TTL cache) as shared infrastructure
  - Shared types in `src/services/api/types.ts` (`ResourceContext`, `IApiClient`, `ICacheManager`)
  - Barrel export at `src/services/api/index.ts`
  - Added `facade-contract.spec.ts` — 314-line test suite verifying the facade delegates correctly to all resource modules

### 🔧 Technical Improvements

- **Consolidated error modules**: Merged separate error files into a single `errors.ts` module. (#81)
- **Dead code removal**: Removed unused exports, stubs, and consolidated scattered constants. (#78)
- **`UserFacingError` statusCode parameter**: Added an explicit `statusCode` constructor parameter for cleaner error construction. (#83)
- **`ToolRegistry.register()` made private**: Encapsulated tool registration as an internal implementation detail. (#79, #84)

## [2.6.0] - 2026-02-24

### 🚀 New Features

- **Auto-generated tool argument types**: New `scripts/generate-types.ts` derives `mcp-tool-args.ts` from JSON Schema definitions, eliminating manual type maintenance and ensuring handler argument types always match tool schemas. (#76)
- **Integration test suite**: Added real-API integration tests (`api-contracts.integration.test.ts`, `enum-values.integration.test.ts`) that verify response shapes, enum casing, and parameter semantics against the live Motion API. Skipped gracefully when `MOTION_API_KEY` is absent.
- **Client-side-filter-aware truncation notices**: When priority or due-date filtering is applied client-side after paginated fetching, the truncation notice now accurately reports the post-filter count and warns that matching tasks may exist on unfetched pages.

### 🐛 Bug Fixes

- **API alignment**: Corrected Motion API call patterns, parameter naming, and response handling to match official documentation — including custom field endpoints, task search, and pagination cursor handling.
- **Custom field `valueId` exposure**: The `add_to_task` / `add_to_project` responses now surface the `valueId` needed for subsequent removal operations.
- **`autoScheduled` validation on update**: Task updates now validate `autoScheduled` parameters (schedule name, deadline type) the same way task creation does.
- **Integration test cleanup**: Removed incorrect `removeCustomFieldFromTask` calls that passed a field definition ID where a value assignment ID was expected; task deletion handles cleanup.

### 🔧 Technical Improvements

- **Dead code removal**: Removed unused stubs, placeholder comments, `validateArgs`/`ValidationResult` from handler base, and legacy search operations (`context`, `smart`).
- **Hardened types and validation**: Strengthened TypeScript types across Motion API types, handler arguments, and service methods; improved runtime validation for priorities, durations, frequencies, and custom field operations.
- **Parameter and caching fixes**: Corrected parameter naming inconsistencies, cache key construction, and log levels throughout the service layer.
- **Response formatting improvements**: Enriched recurring task and schedule formatters with full object details; improved workspace resolver fuzzy matching.

### 📖 Documentation

- Condensed CLAUDE.md to remove duplication, updated tool default references to `complete`.

## [2.5.0] - 2026-02-22

### 🚀 New Features

- **Default tool configuration changed to `complete`**: All 10 tools are now enabled by default. With only 10 consolidated tools and MCP clients supporting deferred tool loading, gating 3 useful tools behind opt-in provided no practical benefit. Users who explicitly set `MOTION_MCP_TOOLS` are unaffected. (#71, #73)
- **MCP server instructions for tool discovery**: Both entry points (stdio and Cloudflare Worker) now include a keyword-rich `instructions` string in the MCP handshake, improving tool discoverability for clients that support `defer_loading` or tool search.

### 🐛 Bug Fixes

- **Handler test mock shape mismatch**: Fixed 4 handler test files where mocks returned plain arrays instead of `ListResult<T>` objects (`{ items, truncation }`), matching the refactored service method signatures. (#74, #75)
- **`.env.example` default inconsistency**: Updated `.env.example` to reflect the new `complete` default instead of actively setting `essential`.

### 🔧 Technical Improvements

- **Version strings synced to 2.5.0**: Both `mcp-server.ts` and `worker.ts` now match `package.json`.
- **Shared constants**: Added `src/constants.ts` with `SERVER_INSTRUCTIONS` used by both entry points.

### 📖 Documentation

- Updated README tool configuration section: reframed from "tool limits" to "reducing tool noise", marked `complete` as default, removed `MOTION_MCP_TOOLS` from primary setup examples.
- Updated CLAUDE.md default reference from `essential` to `complete`.

## [2.4.0] - 2026-02-22

### 🚀 New Features

- **Cloudflare Workers remote MCP server**: Added a new entry point (`src/worker.ts`) that runs the MCP server as a Cloudflare Worker using Streamable HTTP/SSE transport. This enables access from mobile and web clients (Claude mobile, claude.ai, ChatGPT) without requiring a local stdio process. Uses `McpAgent` from the Cloudflare Agents SDK with Durable Objects for per-session state. Auth is handled via a secret token embedded in the URL path. (#60)
  - New `wrangler.toml` configuration and `tsconfig.worker.json` for Worker builds
  - `jsonSchemaToZod.ts` utility converts JSON Schema tool definitions to Zod schemas (required by `McpServer.tool()`) using Zod v4's `fromJSONSchema()`
  - Deploy via `npm run worker:deploy` or the one-click "Deploy to Cloudflare Workers" button in the README

- **Multi-status filtering for task listing**: The `motion_tasks` list operation now accepts `status` as an array of strings, enabling filtering by multiple statuses in a single request (e.g., `status: ["Todo", "In Progress"]`). Repeated `status=` query parameters are sent to the Motion API, which returns the union of matching tasks. (#68, #69)
  - New `includeAllStatuses` boolean parameter to retrieve tasks in all statuses (including completed/canceled)
  - Validation prevents combining `status` filter with `includeAllStatuses`
  - Per-element validation ensures status arrays contain only non-empty strings
  - Status values are deduplicated before sending to the API
  - Fully backward compatible — single string `status` values work as before

### 📖 Documentation

- Restructured README for clarity: consolidated overlapping tool sections into a single Tools Reference, reorganized API key setup and advanced configuration
- Added "Deploy to Cloudflare Workers" button to README
- Updated CLAUDE.md and DEVELOPER.md with Cloudflare Worker architecture details, development workflow, and deployment instructions

## [2.3.0] - 2026-02-19

### 🚀 New Features

- **Truncation notices for MCP clients**: When paginated API responses are incomplete, MCP clients now receive a human-readable `Note:` in the response explaining that results were limited and suggesting filters to narrow results. Previously, truncation warnings only appeared in stderr logs, leaving LLMs unaware when data was incomplete. (#54, #62)
  - New `TruncationInfo` and `ListResult<T>` types propagate truncation metadata from the pagination layer through services to formatters
  - Three truncation reasons tracked: `page_size_limit`, `max_items`, `max_pages`
  - Notices follow the existing `\n\nNote:` response pattern

### 🐛 Bug Fixes

- **Truncation aggregation in multi-workspace methods**: Fixed a bug where iterating multiple workspaces would overwrite earlier truncation info with later results. If workspace A was truncated but workspace B was not, the truncation notice could be lost. Now the first truncation is preserved across `getAllProjects`, `searchTasks`, `searchProjects`, and `getAllUncompletedTasks`.
- **Stale truncation notices from cache**: `projectCache` and `recurringTaskCache` no longer store truncation metadata. Previously, cached `ListResult<T>` values could serve stale "there may be more items" notices after the underlying data changed. Cache now stores only item arrays; truncation is only reported on fresh fetches.
- **SearchHandler combined truncation mismatch**: When both task and project searches returned truncated results, only the last search's truncation was preserved. Now the first truncation is kept, and when combined results exceed the limit after slicing, a proper `max_items` truncation is reported.
- **`getAllProjects` returnedCount underreported**: The `returnedCount` in aggregate truncation was captured mid-loop when the first truncation was encountered, but subsequent workspaces kept adding items. Added a final count update before returning, matching the pattern in `searchTasks`/`searchProjects`.
- **dotenv v17 stdout pollution**: Restored `quiet: true` in `dotenv.config()` to suppress the stdout banner that dotenv v17 writes by default. This banner was corrupting the MCP JSON-RPC stdio transport.

### 🔧 Technical Improvements

- **Formatter refactoring**: `formatTaskList`, `formatSearchResults`, and `formatRecurringTaskList` no longer mutate `CallToolResult` content arrays with type assertions. They now build text strings first and pass to `formatMcpSuccess`, matching the pattern used by `formatProjectList`.

### 📦 Dependencies

- **@modelcontextprotocol/sdk**: 1.25.3 → 1.26.0 (security fix for cross-client data leak)
- **axios**: 1.13.4 → 1.13.5 (security fix for DoS via `__proto__` key)
- **qs**: 6.14.1 → 6.14.2 (security fix for arrayLimit bypass)
- **ajv**: 8.17.1 → 8.18.0 (security fix for ReDoS)
- **dotenv**: 17.2.3 → 17.3.1
- **@types/node**: 24.10.10 → 24.10.13

### 🧪 Testing

- **Regression test**: Added `stdio-safety.spec.ts` to prevent the dotenv `quiet: true` flag from being removed again.

## [2.2.4] - 2026-02-18

### 🐛 Bug Fixes

- **MCP stdio transport corruption**: Restored `quiet: true` in `dotenv.config()` to suppress the stdout banner that dotenv v17 writes by default. This banner (`[dotenv@17.2.3] injecting env...`) was corrupting the MCP JSON-RPC stdio transport, causing `"not valid JSON"` parse errors in MCP clients like Claude Desktop. The flag was originally added in 2.2.2 but accidentally removed in 2.2.3.

### 🧪 Testing

- **Regression test**: Added `stdio-safety.spec.ts` with source-code and runtime assertions to prevent the `quiet: true` flag from being removed again.

## [2.2.3] - 2026-02-18

### 🐛 Bug Fixes

- **Assignee filtering for list_all_uncompleted**: The `list_all_uncompleted` operation now supports `assignee` and `assigneeId` parameters, including the `'me'` shortcut. Previously these were silently ignored, returning all users' tasks instead of the requested assignee's tasks. (#58, closes #59)
- **dotenv config**: Removed `quiet: true` option from `dotenv.config()` — this was a mistake; see 2.2.4 fix

### 🔧 Technical Improvements

- **Shared assignee resolution**: Extracted duplicated assignee resolution logic from `handleList` and `handleListAllUncompleted` into a reusable `resolveAssignee()` private method. Supports single-workspace and cross-workspace name lookups via an optional `workspaceId` parameter.

## [2.2.2] - 2026-02-03

### 📦 Dependencies

- **dotenv**: Upgraded from v16 to v17.2.3
- **@types/node**: Updated to 24.10.10

## [2.2.1] - 2026-02-03

### 🚀 Performance Improvements

#### Pagination Memory Optimization
- **Fixed Memory Risk**: Added early termination to pagination when item limits are reached
- **Adaptive Fetch Limits**: New `calculateAdaptiveFetchLimit()` utility prevents fetching unnecessary data
- **Defense-in-Depth**: Multiple safeguards prevent invalid limit values (zero or negative) from causing issues

### 🐛 Bug Fixes

#### Search Function Edge Cases
- **Fixed calculateFetchLimit**: Resolved edge cases where remaining items could be zero or negative
- **Limit Validation**: Added validation to reject negative or non-integer limit values in getTasks/getProjects

#### Zod v4 Compatibility
- **Schema Updates**: Added explicit key types to z.record() schemas for Zod v4 compatibility
- **Validation Property**: Updated error.errors to error.issues for Zod v4

### 🔧 Technical Improvements

#### Code Quality
- **DRY Refactoring**: Extracted shared `calculateAdaptiveFetchLimit()` utility, removing 3 duplicate implementations
- **Priority Validation**: Enhanced TaskHandler with proper runtime validation for priority values
- **Error Handling**: Improved error extraction utilities and API error construction
- **API Timeout**: Added configurable timeout for API requests

#### Documentation
- **JSDoc Coverage**: Added comprehensive documentation to ToolRegistry, TaskHandler, and pagination utilities
- **Overfetch Explanation**: Documented the 3x overfetch multiplier rationale for search operations

### 🧪 Testing

#### New Test Suites
- **CustomField Handler Tests**: 16 new tests covering custom field operations
- **Recurring Task Handler Tests**: 11 new tests for recurring task functionality
- **Schedule Handler Tests**: 10 new tests for schedule operations

### 📦 Dependencies

- **Zod**: Updated to v4 with breaking change compatibility fixes
- **Vitest**: Updated to v4 for improved test performance

## [2.2.0] - 2025-09-27

### 🐛 Bug Fixes

#### Recurring Task Frequency Object Handling
- **Fixed Issue #39**: Resolved invalid frequency objects for recurring tasks
- **Enhanced Error Handling**: Improved validation and error messages for frequency patterns
- **Better User Experience**: Added specific examples and documentation links for unsupported patterns

#### Comprehensive Frequency Validation
- **Multi-Day Pattern Support**: Enhanced validation for monthly and quarterly frequency patterns
- **Error Message Improvements**: Replaced silent data loss with descriptive error messages
- **Documentation Accuracy**: Updated tool definitions to accurately reflect implementation behavior

### 🔧 Technical Improvements

#### Code Quality & Consistency
- **Centralized Type Definitions**: Unified FrequencyObject interface across all files
- **Enhanced Validation**: Detailed validation results with actionable error descriptions
- **Type Safety**: Improved TypeScript typing consistency throughout frequency handling

#### GitHub Actions Integration
- **Claude Code Review Workflow**: Added automated code review workflow for pull requests
- **Claude PR Assistant Workflow**: Enhanced CI/CD pipeline with AI-assisted reviews

### 🛠️ Implementation Details

#### Frequency Transform Enhancements
- **Error Handling**: Comprehensive error handling for unsupported multi-day patterns
- **Validation Consistency**: Aligned transformer and validator function behavior
- **Pattern Support**: Clear documentation of supported vs unsupported frequency patterns

#### Testing & Quality Assurance
- **Test Coverage**: Updated test suite to reflect new validation behavior
- **Continuous Integration**: Added automated workflow validation
- **TypeScript Compliance**: All changes maintain strict TypeScript compilation

### 🔄 Breaking Changes
- None - All changes are backward compatible with enhanced error reporting

## [2.1.1] - 2025-09-21

### 🐛 Bug Fixes

#### Due Date Normalization
- **Fixed Due Date Display Issue**: Resolved bug where due dates appeared one day early in some timezones
- **Added `normalizeDueDateForApi` Utility**: New function that normalizes date-only strings to end-of-day UTC timestamps
- **Consistent Date Handling**: Applied normalization to both task creation and task updates
- **Preserved Timezone Data**: Existing timestamps with timezone offsets remain unchanged

#### Implementation Details
- Date-only inputs (e.g., `2024-05-10`) are now converted to `2024-05-10T23:59:59.000Z`
- Relative dates (`today`, `tomorrow`, `yesterday`) are properly normalized to end-of-day UTC
- Timestamps with explicit timezone offsets are preserved unchanged
- Enhanced tool documentation to clarify date normalization behavior

#### Testing & Validation
- Added comprehensive test coverage for date normalization scenarios
- Verified edge case handling (null, undefined, invalid dates)
- Updated task handler tests to verify normalization is applied

## [2.1.0] - 2024-09-16
## Version 2.1.0 - Enhanced Task Filtering & Validation

**Release Date:** September 16, 2025

### 🎯 Major Features

#### Advanced Task Filtering
- **New Filter Parameters**: Filter tasks by assignee, priority, due date, and labels
- **Smart Assignee Resolution**: Use names, emails, or the convenient `"me"` shortcut
- **Flexible Date Filtering**: Support for YYYY-MM-DD format and relative dates (`today`, `tomorrow`, `yesterday`)
- **Priority-Based Filtering**: Filter by priority levels (ASAP, HIGH, MEDIUM, LOW)
- **Label-Based Filtering**: Filter tasks by multiple label names

#### Enhanced User Experience
- **Intelligent Error Messages**: Clear, actionable feedback for invalid parameters
- **Improved Response Formatting**: Task lists now display active filter context
- **Assignee Display**: Shows resolved assignee names in filter results
- **Date Formatting**: Human-readable date display in task list headers

### 🔧 Technical Improvements

#### Robust Validation System
- **Parameter Validation**: Comprehensive validation for all filter parameters
- **Type Safety**: Strong TypeScript typing with `ValidPriority` enum
- **Schema Enhancement**: Complete tool definitions with enum validation
- **Error Handling**: Graceful handling of invalid filter combinations

#### Performance Optimizations
- **Cache Improvements**: Consistent TTL handling across all cache instances
- **API Efficiency**: Optimized parameter passing to Motion API
- **Memory Management**: Improved cache cleanup and lifecycle management

#### Code Quality
- **Modular Architecture**: Clean separation of validation, resolution, and API logic
- **Test Coverage**: Updated test suite for new API signatures
- **Documentation**: Enhanced inline documentation and parameter descriptions

### 🛠️ API Changes

#### New `motion_tasks` Parameters
```json
{
  "operation": "list",
  "assignee": "john@company.com",     // New: Name, email, or "me"
  "priority": "HIGH",                 // New: ASAP, HIGH, MEDIUM, LOW
  "dueDate": "today",                // New: YYYY-MM-DD or relative
  "labels": ["urgent", "frontend"]    // New: Array of label names
}
```

#### Enhanced Response Format
Task list responses now include filter context:
```
Tasks in workspace "Development" for assignee "John Doe" with priority "HIGH" due by 09/16/2025 (limit: 10)
```

### 🔄 Breaking Changes
- None - All changes are backward compatible

### 🐛 Bug Fixes
- Fixed cache TTL inconsistencies that could cause unexpectedly long cache lifetimes
- Resolved text sanitization issues that over-escaped user content
- Fixed duplicate property declarations in TypeScript definitions

### 📈 Performance Impact
- **Reduced API Calls**: More efficient filtering reduces unnecessary data transfer
- **Improved Caching**: Consistent cache behavior improves response times
- **Better Memory Usage**: Optimized cache cleanup prevents memory leaks

### 🔧 Developer Experience

#### New Validation Helpers
```typescript
// Available in src/utils/constants.ts
isValidPriority(priority: string): boolean
parseFilterDate(dateInput: string): string | null
```

#### Enhanced Error Codes
```typescript
ERROR_CODES.INVALID_PRIORITY
ERROR_CODES.INVALID_DATE_FORMAT
```

### 📚 Usage Examples

#### Filter by Assignee
```json
{
  "operation": "list",
  "assignee": "me",
  "workspaceName": "Development"
}
```

#### Filter by Multiple Criteria
```json
{
  "operation": "list",
  "priority": "HIGH",
  "dueDate": "2025-09-20",
  "labels": ["urgent", "bug"],
  "projectName": "Web App"
}
```

#### Relative Date Filtering
```json
{
  "operation": "list",
  "dueDate": "tomorrow",
  "status": "TODO"
}
```

### 🏗️ Architecture Enhancements
- **Handler-Based Validation**: Centralized parameter validation in TaskHandler
- **Type-Safe API**: Strong typing prevents runtime errors
- **Extensible Design**: Easy to add new filter parameters in the future

### 🚀 Getting Started
1. Update to version 2.1.0
2. Use new filter parameters in your `motion_tasks` calls
3. Enjoy enhanced task discovery and management capabilities

### 📋 Migration Guide
No migration required - all existing code continues to work unchanged. New filter parameters are optional and can be added incrementally.

### 🙏 Acknowledgments
This release focuses on user-requested task filtering capabilities while maintaining the robust, type-safe architecture that makes Motion MCP Server reliable for production use.

---

For detailed technical documentation, see the updated [API Documentation](docs/api.md).
For support, please visit our [GitHub Issues](https://github.com/devondragon/MotionMCP/issues).
