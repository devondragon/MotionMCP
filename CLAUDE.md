# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Motion MCP Server

This is a Model Context Protocol (MCP) server that bridges Motion's task management API with LLMs. It provides both an Express HTTP server and an MCP protocol server for AI-assisted task management.

## Common Commands

```bash
# Development
npm install              # Install dependencies
npm start               # Start Express HTTP server (port 3000)
npm run mcp             # Start MCP protocol server
npm run worker:dev      # Run Cloudflare Worker locally
npm run worker:deploy   # Deploy to Cloudflare

# Environment setup
cp .env.example .env    # Create environment file
# Add MOTION_API_KEY to .env
```

## Architecture Overview

The codebase follows a modular service-based architecture:

1. **Dual Server Model**:
   - `src/index.js`: Express HTTP server for REST API access
   - `src/mcp-server.js`: MCP protocol server for LLM integration
   - `src/worker.js`: Cloudflare Worker for edge deployment

2. **Core Service Layer** (`src/services/motionApi.js`):
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

The Motion API service (`motionApi.js`) handles all external API calls:
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
- No TypeScript - pure JavaScript with CommonJS modules
- Environment variables take precedence over other config methods