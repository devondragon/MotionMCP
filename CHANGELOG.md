# Changelog

All notable changes to this project will be documented in this file.

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
