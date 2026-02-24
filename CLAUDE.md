# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Motion MCP Server

MCP server bridging Motion's task management API with LLMs via the Model Context Protocol. Supports both local (stdio) and remote (Cloudflare Workers) deployment.

## Common Commands

```bash
# Build & Run
npm run build              # Compile TypeScript to dist/
npm run mcp                # Start MCP server (compiled)
npm run mcp:dev            # Start MCP server (ts-node, no build needed)
npm run type-check         # Type checking without emitting files

# Testing (vitest)
npm test                   # Run all unit tests
npm test -- handlers.task  # Run a single test file by name fragment
npm test -- --reporter=verbose  # Run with verbose output
npm run test:integration   # Integration tests (requires MOTION_API_KEY in .env)

# Worker (Cloudflare)
npm run worker:dev             # Local Worker at http://localhost:8787
npm run worker:deploy          # Deploy to Cloudflare
npm run worker:type-check      # Type-check Worker code (separate tsconfig)

# Verify both entry points compile
npm run build && npm run worker:type-check

# Quick startup smoke test
timeout 3s npm run mcp
```

## Testing

Uses **vitest**. Unit tests in `tests/**/*.spec.ts`, integration tests in `tests/integration/**/*.integration.test.ts`.

- Unit tests: 10s timeout, mocked services, `tests/setup.ts` silences console.error
- Integration tests: 60s timeout, sequential execution (rate limits), requires `MOTION_API_KEY` env var
- Handler tests mock `MotionApiService` and `WorkspaceResolver`; service returns use `ListResult<T>` shape (`{ items, truncation }`)

## Architecture

### Entry Points

Both share all handlers, services, tools, and utilities — they differ only in transport and API key source.

- **Stdio Server** (`src/mcp-server.ts`): Uses `Server` from MCP SDK. API key from `MOTION_API_KEY` env var.
- **Cloudflare Worker** (`src/worker.ts`): Uses `McpAgent` from Cloudflare Agents SDK with Durable Objects. API key from Worker secret. Auth via secret token in URL path (`/mcp/SECRET`).

### Handler Architecture (`src/handlers/`)

Command pattern: each resource type has a handler extending `BaseHandler`. `HandlerFactory` routes tool calls to handlers by tool name.

Handlers access `this.motionService` (API client) and `this.workspaceResolver` (name-to-ID resolution). Operations are dispatched via `switch(operation)` in `handle()`.

### Tool Management (`src/tools/`)

- `ToolRegistry`: Manages definitions and tier mappings
- `ToolConfigurator`: Validates config string, returns enabled tool set
- `ToolDefinitions`: JSON Schema definitions for all tools

Configured via `MOTION_MCP_TOOLS` env var:
- `minimal` (3): motion_tasks, motion_projects, motion_workspaces
- `essential` (7): + motion_users, motion_search, motion_comments, motion_schedules
- `complete` (10, default): + motion_custom_fields, motion_recurring_tasks, motion_statuses
- `custom:tool1,tool2`: Exact tool selection

### Core Service (`src/services/motionApi.ts`)

Centralized Motion API client (`https://api.usemotion.com/v1`). Features:
- Workspace name-to-ID and project name resolution
- Caching with per-resource TTLs (defined in `src/utils/constants.ts` as `CACHE_TTL`)
- Retry with exponential backoff (GET requests only, config in `RETRY_CONFIG`)
- Pagination with configurable limits (`LIMITS.MAX_PAGES`, `LIMITS.MAX_PAGE_SIZE`)
- All logging to stderr in JSON format (MCP compliance)

### Utilities (`src/utils/`)

- **sanitize.ts**: `sanitizeTextContent`, `sanitizeName`, `sanitizeDescription`, `sanitizeCommentContent` — strip HTML/script tags, normalize whitespace. Length limits are caller's responsibility.
- **responseFormatters.ts**: Consistent MCP response formatting for all resource types (tasks, projects, workspaces, comments, etc.)
- **constants.ts**: `LIMITS`, `RETRY_CONFIG`, `CACHE_TTL`, `createMinimalPayload()` (strips undefined/empty strings, preserves `null` and `[]`), `VALID_PRIORITIES`, `parseFilterDate()`
- **workspaceResolver.ts**: Workspace name resolution with fuzzy matching
- **parameterUtils.ts**: Parameter parsing (auto-scheduling, duration, labels)
- **validator.ts**: Runtime input validation via AJV against tool JSON schemas
- **jsonSchemaToZod.ts**: Converts JSON Schema to Zod for Worker entry point (excluded from main build)

## Consolidated Tools

| Tool | Operations |
|------|-----------|
| motion_tasks | create, list, get, update, delete, move, unassign |
| motion_projects | create, list, get |
| motion_workspaces | list, get |
| motion_users | list, current |
| motion_search | content |
| motion_comments | list, create |
| motion_custom_fields | list, create, delete, add_to_project, remove_from_project, add_to_task, remove_from_task |
| motion_recurring_tasks | list, create, delete |
| motion_schedules | list |
| motion_statuses | list |

## Build System

- **Two tsconfigs**: `tsconfig.json` (CommonJS, excludes `worker.ts` and `jsonSchemaToZod.ts`) and `tsconfig.worker.json` (ES2022, bundler resolution, Workers types)
- Stdio server compiles to `dist/`; Wrangler bundles Worker separately
- Changes to shared code (handlers, services, tools, utils) affect both entry points — always verify both builds pass

## Adding a New Handler

1. Create handler class extending `BaseHandler` in `src/handlers/`
2. Implement `handle()` method with operation switch
3. Register in `HandlerFactory`
4. Add tool schema in `ToolDefinitions.ts` (auto-registered via `allToolDefinitions`)
5. Add to appropriate tier in `ToolRegistry.ts`
