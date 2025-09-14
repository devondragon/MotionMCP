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

## Troubleshooting

- Missing or invalid API key: verify MOTION_API_KEY is set (in your shell or .env).
- Typescript errors: run `npm run type-check` and fix issues before building.
- No tools listed in client: check MOTION_MCP_TOOLS and that the client launched the expected script (mcp vs mcp:dev).

---

Happy hacking! If you run into issues, open an issue or PR on GitHub.
