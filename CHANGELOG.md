# Changelog

All notable changes to this project will be documented in this file.

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
