# Task 5.1: Update Documentation

**Priority:** Documentation and Testing (Priority 5)
**Status:** Current

**Files to update:**
- `CLAUDE.md` - Document new tools and consolidation
- `README.md` - Update feature list and usage examples
- `.env.example` - Add new configuration options

## Documentation updates needed

### 1. In CLAUDE.md, add:
```markdown
## Tool Configuration

The server supports different tool exposure levels via `MOTION_MCP_TOOLS`:
- `minimal`: Only essential tools (tasks, projects, context)
- `essential`: Core tools including search and workspaces (default)
- `all`: All available tools
- `custom:tool1,tool2`: Specific tools only

## Consolidated Tools

Many operations are now consolidated:
- `motion_tasks`: All task operations (create, list, get, update, delete, move, unassign)
- `motion_projects`: All project operations
- `motion_comments`: Comment operations
- `motion_custom_fields`: Custom field management
- `motion_recurring_tasks`: Recurring task management
```

### 2. In README.md, add examples for new features