# Repository Guidelines

## Project Structure & Module Organization
- `src/` — TypeScript source
  - `handlers/` resource handlers (tasks, projects, users, etc.) implementing `handle()`
  - `tools/` tool registry, configurator, and definitions
  - `services/` Motion API client (`motionApi.ts`)
  - `utils/` logging, validation, workspace resolution, caching, constants
  - `schemas/` request/response schemas
  - `types/` shared TypeScript types
- `dist/` — compiled JS output
- `.env.example` — copy to `.env`; never commit secrets
- Entry point: `src/mcp-server.ts` (stdio MCP server)

## Build, Test, and Development Commands
- `npm run mcp:dev` — run server via ts-node (fast dev)
- `npm run build` — compile TypeScript to `dist/`
- `npm run mcp` — run compiled server (`dist/mcp-server.js`)
- `npm run watch` — incremental TypeScript compilation
- `npm run type-check` — strict type/unused checks (no emit)
- Optional (Cloudflare worker): `npm run worker:dev`, `npm run worker:deploy`

## Coding Style & Naming Conventions
- Language: TypeScript, `strict` enabled (see `tsconfig.json`)
- Indentation: 2 spaces; max 120 cols recommended
- Quotes: prefer single quotes; match surrounding file if inconsistent
- Naming: `PascalCase` classes/types; `camelCase` vars/functions; `UPPER_SNAKE_CASE` constants
- Imports: absolute packages first, then relative modules; group by domain
- Error handling: return MCP-friendly errors via `formatMcpError`; log with `mcpLog`

## Testing Guidelines
- Current: no test suite. At minimum run `npm run type-check` before PRs.
- Suggested (future): `vitest` with files in `src/**/__tests__` and coverage >80% for changed lines.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (e.g., `feat(tools): add consolidated tasks`, `fix(handlers): null-safe workspace`)
- PRs must include:
  - Clear description and rationale; reference issues (e.g., `Closes #123`)
  - Before/after behavior or example tool calls/args
  - Checklist: `type-check` passes, builds locally, no secrets committed
- Keep changes focused; update docs if behavior or env changes (`README.md`, `DEVELOPER.md`).

## Security & Configuration Tips
- Provide `MOTION_API_KEY` via env or `.env`; never log secrets
- Choose tools via `MOTION_MCP_TOOLS` (`minimal`, `essential` [default], `complete`, or `custom:...`)
- Server communicates over stdio; clients (e.g., Claude Desktop) launch it and pass env
