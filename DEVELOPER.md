# Developer Guide — Motion MCP Server

This guide is for contributors and anyone running Motion MCP locally from source.

## Prerequisites

- Node.js 18 or newer (Node 20 recommended)
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

- minimal — core consolidated tools only: motion_tasks, motion_projects, motion_workspaces
- essential (default) — consolidated tools plus commonly-used endpoints and helpers
- complete — all consolidated tools
- custom:tool1,tool2 — specify exactly which tools to enable

Examples:
```bash
# Only core consolidated tools
MOTION_MCP_TOOLS=minimal npm run mcp:dev

# Default set (explicit)
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

The project also includes a Cloudflare Worker entry point (`src/worker.ts`) that exposes the same MCP tools over HTTP. This enables access from Claude mobile/web and ChatGPT — any client that supports remote MCP servers via Streamable HTTP or SSE.

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

### Connecting clients

- **Claude (web/mobile):** Add the URL in [claude.ai](https://claude.ai) > Settings > Connectors. Syncs to mobile automatically.
- **ChatGPT (web/mobile):** Add the URL in Settings > Connectors.

### Worker type checking

The Worker uses a separate TypeScript config (`tsconfig.worker.json`) with ES modules and Workers types:

```bash
npm run worker:type-check
```

This is separate from the main `npm run type-check` / `npm run build` which compiles the stdio server.

### Architecture notes

- The Worker reuses all existing handlers, services, tools, and utilities — it only differs in transport
- `McpAgent` from the Cloudflare Agents SDK handles Streamable HTTP and SSE via Durable Objects
- `MotionApiService` receives the API key from Worker env bindings instead of `process.env`
- Tool JSON Schemas are converted to Zod schemas at init time (via `src/utils/jsonSchemaToZod.ts`) because `McpServer.tool()` requires Zod
- Access is controlled by a secret token in the URL path — treat the full URL like a password

## Troubleshooting

- Missing or invalid API key: verify MOTION_API_KEY is set (in your shell or .env).
- Typescript errors: run `npm run type-check` and fix issues before building. For Worker issues, also run `npm run worker:type-check`.
- No tools listed in client: check MOTION_MCP_TOOLS and that the client launched the expected script (mcp vs mcp:dev).
- Worker 404 on all requests: verify `MOTION_MCP_SECRET` is set and matches the secret in your URL path.
- Worker local dev issues: make sure `MOTION_API_KEY` is in your `.env` file.

---

Happy hacking! If you run into issues, open an issue or PR on GitHub.
