# Developer Guide — Motion MCP Server

This guide is for contributors and anyone running Motion MCP locally from source.

## Prerequisites

- Node.js 22 or newer for development (Node 24 recommended; the repo pins 24 via `mise.toml`).
  The published server runs on Node 20+, but the dev toolchain does not: `wrangler`,
  `miniflare`, and `@cloudflare/vitest-pool-workers` all declare `engines.node >= 22`,
  and `npm test` now boots workerd for the Worker test project.
- npm (comes with Node)
- A Motion API key: https://app.usemotion.com/settings/api

## Get the code and install

```bash
# clone or open your local copy
# (replace the URL with your fork if contributing)
 git clone https://github.com/devondragon/MotionMCP.git
 cd MotionMCP

# install dependencies
 npm install

# copy environment template and edit values
 cp .env.example .env
 # open .env and set MOTION_API_KEY
```

Important environment variables:
- MOTION_API_KEY: required for all requests
- MOTION_MCP_TOOLS: optional; controls which tool set is exposed (see below)

## Run locally

You can run in TypeScript dev mode (fast iteration) or build and run the compiled JS.

- Dev mode (ts-node):
```bash
npm run mcp:dev
```

- Build, then run compiled:
```bash
npm run build
npm run mcp
```

Both commands start the MCP server on stdio (no HTTP port). Clients like Claude Desktop will launch it and communicate over stdio.

## Tool configuration (optional)

Set MOTION_MCP_TOOLS in your environment (for example in .env) to control the exposed tools:

- minimal — 3 tools: motion_tasks, motion_projects, motion_workspaces
- essential — 7 tools: adds motion_users, motion_search, motion_comments, motion_schedules
- complete (default) — all 10 tools: adds motion_custom_fields, motion_recurring_tasks, motion_statuses
- custom:tool1,tool2 — specify exactly which tools to enable

Examples:
```bash
# Only core consolidated tools
MOTION_MCP_TOOLS=minimal npm run mcp:dev

# Reduced set
MOTION_MCP_TOOLS=essential npm run mcp

# Custom selection
MOTION_MCP_TOOLS=custom:motion_tasks,motion_projects,motion_search npm run mcp:dev
```

## Claude Desktop configuration

To use your local build with Claude Desktop, add an entry to your Claude Desktop config. **Recommended approach is direct node execution** for maximum reliability.

- macOS config file path: ~/Library/Application Support/Claude/claude_desktop_config.json

**Recommended (direct node execution):**
```json
{
  "mcpServers": {
    "motion": {
      "command": "node",
      "args": ["/absolute/path/to/your/MotionMCP/dist/mcp-server.js"],
      "env": {
        "MOTION_API_KEY": "your_api_key",
        "MOTION_MCP_TOOLS": "essential"
      }
    }
  }
}
```

Alternative (npm - may have working directory issues):
```json
{
  "mcpServers": {
    "motion": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/absolute/path/to/your/MotionMCP",
      "env": {
        "MOTION_API_KEY": "your_api_key",
        "MOTION_MCP_TOOLS": "essential"
      }
    }
  }
}
```

**Setup steps:**
1. Build the project: `npm run build`
2. Make the server executable: `chmod +x dist/mcp-server.js`
3. Use absolute paths in your Claude Desktop config
4. Restart Claude Desktop after config changes

Notes:
- The server communicates over stdio. There is no HTTP port to configure.
- Direct node execution is more reliable than npm in Claude Desktop's environment.
- Remember to rebuild (`npm run build`) after making code changes.

## Cloudflare Worker (remote MCP server)

The project also includes a Cloudflare Worker entry point (`src/worker.ts`) that exposes the same MCP tools over HTTP. This enables access from Claude mobile/web and ChatGPT — any client that supports remote MCP servers via Streamable HTTP.

### Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- Wrangler CLI (included as a dev dependency)

### Local development

```bash
npm run worker:dev
# Starts at http://localhost:8787
# Uses MOTION_API_KEY from your .env file
# Test: curl http://localhost:8787/health
```

The local dev server reads `MOTION_MCP_SECRET` from `.env` (or skips validation if not set). Set it to a test value like `test-secret` for local testing.

### Deploy to Cloudflare

```bash
# Set secrets (prompted for values)
npx wrangler secret put MOTION_API_KEY
npx wrangler secret put MOTION_MCP_SECRET  # generate with: openssl rand -hex 16

# Deploy
npm run worker:deploy
```

Your MCP URL will be: `https://motion-mcp-server.YOUR_SUBDOMAIN.workers.dev/mcp/YOUR_SECRET`

The secret is the final path segment; clients use that address as-is. The Worker serves Streamable HTTP on that single endpoint, so do not append `/sse` or any other sub-path. A request to any sub-path returns 404 in both auth modes.

Header-capable clients can use `https://motion-mcp-server.YOUR_SUBDOMAIN.workers.dev/mcp` with `Authorization: Bearer YOUR_SECRET` instead, which keeps the secret out of URLs and access logs.

### Connecting clients

- **Claude (web/mobile):** Add the URL in [claude.ai](https://claude.ai) > Settings > Connectors. Syncs to mobile automatically.
- **Claude Code:** `claude mcp add --transport http motion https://.../mcp --header "Authorization: Bearer YOUR_SECRET"`.
- **Claude Desktop:** add the URL as a remote server of type `http`.
- **ChatGPT (web/mobile):** Add the URL in Settings > Connectors.

Only Streamable HTTP is served. The 2024-era HTTP+SSE transport (`GET` stream plus a `POST /message` endpoint) is no longer available; a client entry with transport type `sse` must be changed to `http`.

### Worker type checking

The Worker uses a separate TypeScript config (`tsconfig.worker.json`) with ES modules and Workers types:

```bash
npm run worker:type-check
```

This is separate from the main `npm run type-check` / `npm run build` which compiles the stdio server.

### Architecture notes

- The Worker reuses all existing handlers, services, tools, and utilities — it only differs in transport
- The transport is `createMcpHandler` from the Cloudflare Agents SDK (`agents/mcp/server`), the stateless MCP SDK v2 handler. It serves one route, `/mcp`, and constructs a fresh `McpServer` (from `@modelcontextprotocol/server`) per request. No Durable Object is bound; `wrangler.toml` carries a `deleted_classes` migration that retired the earlier `McpAgent` class.
- Stateless means no MCP session: a 2025-era Streamable HTTP client gets no `Mcp-Session-Id`, every `POST` is served on its own, and `GET`/`DELETE` on `/mcp` return 405. Server-initiated requests (sampling, elicitation) are unavailable; this server makes none.
- `MotionApiService`, the handler factory, and the converted tool schemas are built once per isolate and shared across requests, so the service's workspace/project name caches stay warm even though each request gets its own `McpServer`. The handlers keep no per-session state; each tool call goes straight to Motion's REST API.
- `MotionApiService` receives the API key from Worker env bindings instead of `process.env`
- Tool JSON Schemas are converted to Zod schemas once per isolate (via `src/utils/jsonSchemaToZod.ts`) because `McpServer.registerTool()` takes a Standard Schema; Zod v4 implements it
- Access is controlled by a secret, sent as `Authorization: Bearer` or as the final URL path segment. The Worker authenticates before the handler ever sees the request, and hands it a URL carrying only `/mcp` (no secret segment, no caller query params). Because that gate is the trust boundary, the handler's browser `Origin` allow-list is set to `*`; the SDK's default would reject browser-origin clients on custom domains.
- The stdio entry point (`src/mcp-server.ts`) still uses MCP SDK v1 (`@modelcontextprotocol/sdk`), pinned to the version `agents` requires as a peer. Both SDK packages are therefore direct dependencies.

## Troubleshooting

- Missing or invalid API key: verify MOTION_API_KEY is set (in your shell or .env).
- Typescript errors: run `npm run type-check` and fix issues before building. For Worker issues, also run `npm run worker:type-check`.
- No tools listed in client: check MOTION_MCP_TOOLS and that the client launched the expected script (mcp vs mcp:dev).
- Worker 404 on all requests: verify `MOTION_MCP_SECRET` is set and matches the secret in your URL path.
- Worker local dev issues: make sure `MOTION_API_KEY` is in your `.env` file.

---

Happy hacking! If you run into issues, open an issue or PR on GitHub.
