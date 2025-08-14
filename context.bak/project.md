# Motion MCP Server - Project Context

## Overview

Motion MCP Server is a Model Context Protocol (MCP) server that bridges Motion's task management API with Large Language Models (LLMs). It enables AI assistants like Claude to interact with Motion for task and project management through a standardized protocol.

## Project Architecture

### Server Implementation
- **MCP Protocol Server** (`src/mcp-server.js`): Exposes tools to LLM clients via stdio transport
- **Cloudflare Worker** (`src/worker.js`): Optional edge deployment for MCP protocol

### Core Components

#### 1. Motion API Service (`src/services/motionApi.js`)
- Centralized client for all Motion API interactions
- Base URL: `https://api.usemotion.com/v1`
- Authentication via X-API-Key header
- Handles all external API calls with error handling
- MCP-compliant JSON logging to stderr

#### 2. Utilities Layer (`src/utils/`)
- **WorkspaceResolver**: Resolves workspace names to IDs, manages defaults
- **Error Handling**: MCP-compliant error formatting
- **Response Formatters**: Consistent response formatting across all tools
- **Parameter Utils**: Parsing and validation helpers
- **Constants**: Shared configuration and defaults

#### 3. MCP Tool Definitions
Tools are exposed via the MCP protocol for LLM consumption. Each tool includes:
- Unique name
- Description for LLM understanding
- Input schema with typed parameters
- Handler method that calls the Motion API service

## Motion API Integration

### Authentication
- API Key required (stored in `MOTION_API_KEY` environment variable)
- Supports multiple configuration sources (env, CLI args, config file)

### Key Concepts
- **Workspaces**: Top-level containers for projects and tasks
- **Projects**: Organize related tasks
- **Tasks**: Individual work items with properties like status, priority, due date
- **Users**: Team members who can be assigned tasks

### API Response Patterns
- Some endpoints wrap data (e.g., `{ projects: [...] }`)
- Some return data directly
- Error responses include status codes and messages

## MCP Protocol Integration

### Tool Limitations
- MCP clients (like Claude) limit active tools to ~100 across all servers
- Tools should be consolidated where logical to stay under limits
- Tool names and descriptions must be clear for LLM understanding

### Protocol Requirements
- See `context/conventions.md` for MCP compliance details
- All tools exposed via stdio transport
- JSON structured logging to stderr

## Development Environment

### Setup
```bash
npm install
cp .env.example .env
# Add MOTION_API_KEY to .env
```

### Running
```bash
npm run mcp        # MCP protocol server (primary)
npm run worker:dev # Cloudflare Worker locally (optional)
```

### File Structure
```
/
├── src/
│   ├── mcp-server.js       # MCP protocol server & tool definitions
│   ├── worker.js            # Cloudflare Worker (optional)
│   ├── services/
│   │   └── motionApi.js     # Motion API client
│   └── utils/
│       ├── index.js         # Utility exports
│       ├── workspaceResolver.js
│       ├── errorHandler.js
│       ├── responseFormatters.js
│       ├── parameterUtils.js
│       └── constants.js
├── context/
│   ├── tasks/
│   │   ├── current/         # Active implementation tasks
│   │   └── completed/       # Finished tasks archive
│   ├── project.md          # Project overview and architecture
│   ├── conventions.md      # Coding conventions and patterns
│   ├── working-state.md    # Current work tracking
│   ├── tasks-index.md      # Task navigation and status
│   ├── tasks-archive.md    # Original task list (archived)
│   ├── recommendations.md  # Improvement suggestions
│   └── backlog.md          # Future work items
├── CLAUDE.md               # Claude-specific instructions
├── README.md               # Public documentation
├── package.json
└── .env.example
```

## Testing Status

- Currently no test framework in place
- Test script returns error when run
- All testing must be done manually via MCP client or API tools

## Motion API Endpoints

Current implementation covers:
- Projects: create, list, get, update, delete
- Tasks: create, list, get, update, delete
- Workspaces: list
- Users: list

Available but not yet implemented:
- Comments: list, create
- Custom Fields: CRUD operations
- Recurring Tasks: list, create, delete
- Task Operations: move, unassign
- Schedules: get
- Statuses: list
- Current User: get details

## Configuration

### Environment Variables
- `MOTION_API_KEY`: Required - Motion API authentication key
- `MOTION_MCP_TOOLS`: Optional - Control which tools are exposed ('minimal', 'essential', 'all', 'custom:...')

### Tool Configuration Strategy
Due to MCP client limitations (~100 tools max), tools should be:
1. Consolidated where logical (e.g., all task operations in one tool)
2. Prioritized by importance (essential vs nice-to-have)
3. Configurable via environment variables

## Key Implementation Considerations

1. **Workspace Context**: Many operations require or benefit from workspace ID. The default workspace is used when not specified.

2. **Project Name Resolution**: When users provide project names instead of IDs, these must be resolved within the correct workspace context.

3. **Tool Discovery**: Tool names and descriptions must be clear enough for LLMs to understand their purpose and usage.

4. **Rate Limiting**: Motion API may have rate limits. Implementation should handle 429 responses gracefully.

5. **Authentication**: API key stored in environment variable. Never log or expose it.

6. **Response Variability**: Motion API responses vary in structure - some wrapped, some direct. Always check response structure.

7. **No Test Framework**: Manual testing only via MCP clients or API tools.