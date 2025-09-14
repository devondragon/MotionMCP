# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Motion MCP Server

This is a Model Context Protocol (MCP) server that bridges Motion's task management API with LLMs, enabling AI-assisted task management through the MCP protocol.

## Tool Configuration

The server supports different tool exposure levels via `MOTION_MCP_TOOLS` environment variable:

- `minimal`: Core consolidated tools only - 3 tools
  - motion_tasks, motion_projects, motion_workspaces
- `essential` (default): Core tools plus common features - 7 tools  
  - All minimal tools plus motion_users, motion_search, motion_comments, motion_schedules
- `complete`: All consolidated tools - 10 tools
  - All essential tools plus motion_custom_fields, motion_recurring_tasks, motion_statuses  
- (removed: 'all' mode - no longer supported)
- `custom:tool1,tool2`: Specify exact tools needed (e.g., `custom:motion_tasks,motion_projects,motion_search`)

### Consolidated Tools

All operations are consolidated into resource-based tools to reduce tool count:

- **motion_tasks**: All task operations (create, list, get, update, delete, move, unassign)
- **motion_projects**: All project operations (create, list, get)
- **motion_workspaces**: Workspace management (list, get, set_default)
- **motion_users**: User operations (list, current)
- **motion_search**: Search and context utilities (content, context, smart)
- **motion_comments**: Comment operations (list, create for tasks and projects)
- **motion_custom_fields**: Custom field management (list, create, delete, add/remove from projects/tasks)
- **motion_recurring_tasks**: Recurring task management (list, create, delete)
- **motion_schedules**: Schedule operations (list)
- **motion_statuses**: Status operations (list)

## Common Commands

```bash
# Development
npm install              # Install dependencies
npm run build           # Compile TypeScript to dist/
npm run mcp             # Start MCP protocol server (compiled)
npm run mcp:dev         # Start MCP protocol server (development with ts-node)
npm run watch           # TypeScript watch mode
npm run type-check      # Type checking without emitting files

# Testing/Validation
timeout 3s npm run mcp  # Quick server startup test
timeout 2s env MOTION_MCP_TOOLS=minimal npm run mcp  # Test different configurations

# Environment setup
cp .env.example .env    # Create environment file
# Add MOTION_API_KEY to .env
# Optional: Set MOTION_MCP_TOOLS=minimal/essential/complete/custom:...
```

## Architecture Overview

The codebase follows a **modular handler-based architecture** with clear separation of concerns, recently refactored from a monolithic design:

### 1. **Main Server** (`src/mcp-server.ts`) - 133 lines
   - MCP protocol orchestration and transport handling
   - Request routing via HandlerFactory
   - Tool configuration management via ToolConfigurator
   - Minimal business logic - delegates to specialized handlers

### 2. **Handler Architecture** (`src/handlers/`)
   - **Command Pattern**: Each resource type has a dedicated handler class
   - **BaseHandler**: Abstract base class providing common error handling and service access
   - **HandlerFactory**: Creates appropriate handler instances dynamically based on tool name
   - **Individual Handlers**: TaskHandler, ProjectHandler, WorkspaceHandler, etc.
   - Each handler encapsulates all operations for its resource (create, list, get, update, delete)

### 3. **Tool Management System** (`src/tools/`)
   - **ToolRegistry**: Manages tool definitions and configuration mappings
   - **ToolConfigurator**: Handles tool configuration validation and filtering
   - **ToolDefinitions**: Schema definitions for all MCP tools
   - Supports multiple configurations: minimal (3), essential (7), complete (10), custom

### 4. **Core Service Layer** (`src/services/motionApi.ts`)
   - Centralized Motion API client with comprehensive error handling
   - Automatic workspace resolution (name to ID)
   - Project name resolution within workspaces
   - Caching, retry logic, and pagination support
   - MCP-compliant JSON logging to stderr

### 5. **Utilities Layer** (`src/utils/`)
   - **WorkspaceResolver**: Centralized workspace resolution logic
   - **Error Handling**: Custom error classes and MCP-compliant formatters
   - **Response Formatters**: Consistent response formatting for all handlers
   - **Parameter Utils**: Parameter parsing and validation helpers
   - **InputValidator**: Runtime validation using tool schemas

### Key Architectural Benefits:
- **Modularity**: Each handler is independent and focused on single responsibility
- **Testability**: Handlers can be unit tested in isolation
- **Extensibility**: New tools added by creating handler and registering in factory
- **Maintainability**: Changes to one resource don't affect others
- **Type Safety**: Strong TypeScript typing throughout with runtime validation

## Handler Development Patterns

### Creating a New Handler
1. **Extend BaseHandler**: Inherit common functionality and service access
2. **Implement handle() method**: Main entry point that switches on operation type
3. **Create private operation methods**: `handleCreate()`, `handleList()`, etc.
4. **Register in HandlerFactory**: Add to the handler registration map
5. **Add to ToolDefinitions**: Define the tool schema and operations

### Handler Structure Example
```typescript
export class MyResourceHandler extends BaseHandler {
  async handle(args: MyResourceArgs): Promise<McpToolResponse> {
    try {
      const { operation, ...params } = args;
      switch(operation) {
        case 'create': return await this.handleCreate(params);
        case 'list': return await this.handleList(params);
        default: return this.handleUnknownOperation(operation);
      }
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async handleCreate(params: CreateParams): Promise<McpToolResponse> {
    // Implementation using this.motionService, this.workspaceResolver
  }
}
```

### Adding New Tool Configurations
1. **Update TOOL_NAMES**: Add constant in `ToolDefinitions.ts`
2. **Create tool schema**: Export individual tool definition
3. **Register in ToolRegistry**: Automatically registered via `allToolDefinitions`
4. **Update configurations**: Add to minimal/essential/complete sets in `ToolRegistry.ts`

## Key Implementation Details

- **API Key Configuration**: Environment variable `MOTION_API_KEY` required
- **Error Handling**: All errors logged as structured JSON to stderr for MCP compliance
- **Workspace Handling**: Automatically resolves workspace names to IDs, falls back to default
- **No Testing Framework**: Currently no tests exist - test script returns error
- **Build Process**: TypeScript compiles to `dist/` directory
- **Module System**: CommonJS modules for Node.js compatibility

## Motion API Integration

The Motion API service (`src/services/motionApi.ts`) handles all external API calls:
- **Base URL**: `https://api.usemotion.com/v1`
- **Authentication**: X-API-Key header
- **Error Handling**: Comprehensive retry logic and structured logging
- **Workspace Resolution**: Automatic workspace name-to-ID mapping
- **Caching**: Simple caching for workspace and user data
- **Pagination**: Handles paginated responses with configurable limits

## Development Workflow

### Making Changes to Handlers
1. Modify individual handler files in `src/handlers/`
2. Run `npm run build` to check TypeScript compilation
3. Test with `timeout 3s npm run mcp` to verify server startup
4. Test different configurations: `env MOTION_MCP_TOOLS=minimal npm run mcp`

### Refactoring Considerations
- **Handler Independence**: Each handler should only depend on BaseHandler and services
- **Error Propagation**: Use `this.handleError()` for consistent error formatting
- **Type Safety**: Maintain strong typing with proper parameter interfaces
- **Tool Schema Consistency**: Keep tool definitions in sync with handler implementations

## Important Notes

- All logging goes to stderr in JSON format for MCP compliance
- Workspace parameter handling is critical for multi-workspace environments
- API responses should be validated before use in production
- TypeScript compilation is required before running the server
- Handler registration in HandlerFactory is required for tool routing
