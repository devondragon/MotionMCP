# Motion MCP Server - Conventions

## Git Workflow
**ALWAYS create feature branch for tasks:**
```bash
git checkout main && git pull origin main
git checkout -b feature/task-[ID]-[description]
git push -u origin feature/task-[ID]-[description]
```

## Code Style
- Pure TypeScript (Node.js 16+)
- async/await (no callbacks)
- One class/service per file
- camelCase variables, PascalCase classes, UPPER_SNAKE constants

## MCP Protocol

### Logging (stderr JSON only)
```javascript
const mcpLog = (level, message, extra = {}) => {
  console.error(JSON.stringify({
    level, msg: message, time: new Date().toISOString(), ...extra
  }));
};
```

### Response Format
```javascript
// Success
{ content: [{ type: "text", text: "message" }], isError: false }
// Error
{ content: [{ type: "text", text: "Error: message" }], isError: true }
```

## Common Patterns

### Workspace Resolution
```javascript
const workspace = await this.workspaceResolver.resolveWorkspace({
  workspaceId: args.workspaceId,
  workspaceName: args.workspaceName
});
```

### Error Handling
```javascript
try {
  // operation
} catch (error) {
  mcpLog('error', 'Failed', { error: error.message });
  return formatMcpError(error);
}
```

### API Requests
```javascript
// Build params
const params = new URLSearchParams();
if (workspaceId) params.append('workspaceId', workspaceId);

// Handle varied responses
const items = response.data?.items || response.data || [];
```

## Security
1. Never log API keys
2. Validate inputs
3. Sanitize error messages
4. HTTPS only

## Testing
Manual only - no framework. Test via MCP client:
1. Each tool independently
2. Error cases return MCP format
3. Workspace resolution
4. Required/optional parameters

## Tool Design
- Prefix: `motion_`
- Clear descriptions for LLMs
- Consolidate related operations (tool limit ~100)

## Task Lifecycle
1. Select from `context/tasks/current/`
2. Create feature branch
3. Update working-state.md
4. Implement per specs
5. Test manually
6. Move to `completed/`
7. Update tasks-index.md
8. Create PR