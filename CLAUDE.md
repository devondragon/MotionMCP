# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Startup Sequence
1. ALWAYS read:
   - `context/project.md` (project overview)
   - `context/conventions.md` (how we work)
   - `context/working-state.md` (current state)

2. Check working-state.md for "Current Active Task"
   - If found: Load that specific task from `context/tasks/current/`
   - If not found: Ask "Which task are you working on today?"

3. Do NOT read:
   - Other tasks (unless specifically needed for context)
   - Files in `context/tasks/completed/`
   - `context/backlog.md` (unless adding items to it)

## Conventions
All coding, git workflow, and team standards are in `context/conventions.md`.
Follow these strictly, especially:
- Git branching strategy (ALWAYS create feature branches)
- Code style rules
- Testing requirements

## Task Management
- When starting a task: Update "Current Active Task" in working-state.md
- When completing a task: Move file to `context/tasks/completed/` and mark the task as completed in context/tasks-index.md
- When switching tasks: Update working-state.md pointer

## Token Optimization
- Only load what's needed for current work
- Don't read completed tasks or backlog unless required
- If you need context from another task, ask first


## Motion MCP Server

This is a Model Context Protocol (MCP) server that bridges Motion's task management API with LLMs, enabling AI-assisted task management through the MCP protocol.

## Tool Configuration

The server now supports consolidated tools to reduce tool count. Configure via `MOTION_MCP_TOOLS` environment variable:

- `minimal`: Only consolidated tools (motion_tasks, motion_projects, workspaces) - 3 tools
- `essential` (default): Consolidated tools + search, context, users - 6 tools  
- `all`: All tools including legacy individual tools - 20 tools
- `custom:tool1,tool2`: Specify exact tools needed

### Consolidated Tools

- **motion_projects**: Single tool for all project operations (create, list, get, update, delete)
- **motion_tasks**: Single tool for all task operations (create, list, get, update, delete, move, unassign)

## Common Commands

```bash
# Development
npm install              # Install dependencies
npm run mcp             # Start MCP protocol server (primary)
npm run worker:dev      # Run Cloudflare Worker locally (optional)
npm run worker:deploy   # Deploy to Cloudflare (optional)

# Environment setup
cp .env.example .env    # Create environment file
# Add MOTION_API_KEY to .env
# Optional: Set MOTION_MCP_TOOLS=minimal/essential/all/custom:...
```

## Architecture Overview

The codebase follows a modular service-based architecture:

1. **Server Implementation**:
   - `src/mcp-server.ts`: MCP protocol server for LLM integration (primary)
   - `src/worker.ts`: Cloudflare Worker for edge deployment (optional)

2. **Core Service Layer** (`src/services/motionApi.ts`):
   - Centralized Motion API client with comprehensive error handling
   - Automatic workspace resolution (name to ID)
   - Project name resolution within workspaces
   - All 18 Motion operations with enhanced intelligence features
   - MCP-compliant JSON logging to stderr

3. **Utilities Layer** (`src/utils/`):
   - **WorkspaceResolver**: Centralized workspace resolution logic
   - **Error Handling**: Custom error classes and MCP-compliant formatters
   - **Response Formatters**: Consistent response formatting for all handlers
   - **Parameter Utils**: Parameter parsing and validation helpers
   - **Constants**: Shared error codes, defaults, and configuration

4. **MCP Protocol Implementation**:
   - 18 tools exposed for project/task management
   - Intelligent features: context retrieval, search, workload analysis
   - Smart scheduling and next action suggestions
   - Project template creation

## Key Implementation Details

- **API Key Configuration**: Supports multiple sources (env vars, CLI args, config file, interactive prompt)
- **Error Handling**: All errors are logged as structured JSON to stderr for MCP compliance
- **Workspace Handling**: Automatically resolves workspace names to IDs, falls back to default
- **No Testing Framework**: Currently no tests exist - test script returns error

## Motion API Integration

The Motion API service (`motionApi.ts`) handles all external API calls:
- Base URL: `https://api.usemotion.com/v1`
- Authentication: X-API-Key header
- Comprehensive error handling with retry logic
- Workspace-aware operations

## MCP Tool Categories

1. **Basic Operations**: List/create/update/delete projects and tasks
2. **Workspace Management**: List workspaces and users
3. **Intelligent Features**: Context retrieval, content search, workload analysis
4. **Productivity Tools**: Next action suggestions, smart scheduling, bulk updates

## Important Notes

- Always check for workspace parameter in Motion operations
- Use stderr for all logging (MCP compliance)
- API responses should be validated before use
- TypeScript with CommonJS modules, compiles to dist/
- Environment variables take precedence over other config methods
