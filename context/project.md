# Motion MCP Server - Project Context

## Overview
MCP server bridging Motion's task management API with LLMs. Enables AI assistants to interact with Motion via standardized protocol.

## Architecture

### Core Components
- **MCP Server** (`src/mcp-server.js`): Stdio transport for LLM clients
- **Motion API** (`src/services/motionApi.js`): Centralized Motion API client
  - Base: `https://api.usemotion.com/v1`
  - Auth: X-API-Key header
  - MCP-compliant JSON logging to stderr
- **Utils** (`src/utils/`): WorkspaceResolver, error handling, formatters, constants

### Motion Concepts
- **Workspaces**: Top-level containers
- **Projects**: Task groups
- **Tasks**: Work items (status, priority, due date)
- **Users**: Assignable team members

## Configuration
```bash
npm install
cp .env.example .env  # Add MOTION_API_KEY
npm run mcp           # Start server
```

### Environment
- `MOTION_API_KEY`: Required
- `MOTION_MCP_TOOLS`: Tool exposure control (minimal/essential/all/custom:...)

## File Structure
```
src/
├── mcp-server.js         # MCP protocol & tools
├── services/motionApi.js # Motion API client
└── utils/               # Shared utilities
context/
├── tasks/current/       # Active tasks
├── tasks/completed/     # Archive
├── project.md          # This file
├── conventions.md      # Standards
├── working-state.md    # Current work
└── tasks-index.md      # Task status
```

## Implementation Status
**Implemented**: Projects/Tasks/Workspaces/Users CRUD
**Not implemented**: Comments, Custom Fields, Recurring Tasks, Schedules, Statuses

## Key Considerations
1. **Workspace context** required for most operations (defaults when omitted)
2. **Project names** must resolve within workspace
3. **Tool limits**: ~100 max across all MCP servers
4. **Response variability**: Some wrapped (`{items:[...]}`), some direct
5. **No test framework**: Manual testing only
6. **Rate limits**: Handle 429 responses gracefully