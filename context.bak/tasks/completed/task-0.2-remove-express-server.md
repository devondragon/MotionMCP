# Task 0.2: Remove Express HTTP Server

**Priority:** Foundation (Priority 0)
**Status:** Current

**Rationale:** The Express server (`src/index.js`) is redundant since Motion already provides a REST API. The MCP server's value is bridging Motion with LLMs.

## Implementation
1. Delete `src/index.js` (or `src/index.ts` if already migrated)
2. Remove `npm start` script from `package.json`
3. Remove Express dependencies if not used elsewhere
4. Update any remaining documentation references