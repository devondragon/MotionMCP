# Motion MCP Server - Coding Conventions & Implementation Guidelines

## Git Branch Management

When starting development work on ANY defined task:
1. ALWAYS create a new branch first
2. Run these commands:
   git checkout main
   git pull origin main
   git checkout -b feature/task-[ID]-[description]
   git push -u origin feature/task-[ID]-[description]
3. Confirm branch creation before writing any code
4. Make commits on this branch only
5. When task is complete, remind user to create PR


## Code Style

### Language & Module System
- Pure JavaScript (no TypeScript)
- CommonJS modules (not ES6 modules)
- Node.js 16+ features supported

### Async Operations
- Use async/await for all asynchronous operations
- Avoid callbacks and raw promises where possible
- Always handle errors with try/catch blocks

### File Organization
- One class/service per file
- Export single class or object from each file
- Group related utilities in utils folder

## MCP Protocol Compliance

### Logging Requirements
All logging must go to stderr as structured JSON:

```javascript
const mcpLog = (level, message, extra = {}) => {
  const logEntry = {
    level,
    msg: message,
    time: new Date().toISOString(),
    ...extra
  };
  console.error(JSON.stringify(logEntry));
};
```

Log levels: 'debug', 'info', 'warn', 'error'

### Tool Response Format
All tool responses must follow MCP format:

```javascript
// Success response
{
  content: [
    { type: "text", text: "Response message" }
  ],
  isError: false
}

// Error response
{
  content: [
    { type: "text", text: "Error: message" }
  ],
  isError: true
}
```

### Tool Definition Requirements
1. Unique, descriptive name
2. Clear description for LLM understanding
3. Properly typed input schema
4. Required fields must be marked

## Error Handling Patterns

### Standard Error Response
```javascript
try {
  // Operation
} catch (error) {
  return formatMcpError(error);
}
```

### API Error Handling
```javascript
catch (error) {
  mcpLog('error', 'Operation failed', {
    method: 'methodName',
    error: error.message,
    apiStatus: error.response?.status,
    apiMessage: error.response?.data?.message
  });
  throw new Error(`Failed to perform operation: ${error.response?.data?.message || error.message}`);
}
```

### Validation Errors
- Validate inputs before API calls
- Provide clear, actionable error messages
- Never expose sensitive information

## Common Implementation Patterns

### Workspace Resolution Pattern
```javascript
// Most operations need workspace context
const workspace = await this.workspaceResolver.resolveWorkspace({
  workspaceId: args.workspaceId,
  workspaceName: args.workspaceName
});
// Use workspace.id for API calls
```

### Success Response Pattern
```javascript
return formatMcpSuccess(`Successfully created task "${task.name}"`);
```

### Parameter Parsing Pattern
```javascript
const taskParams = parseTaskArgs(args);
// Handles both IDs and names, validates required fields
```

### Caching Pattern (when implemented)
```javascript
return this.cache.withCache(cacheKey, async () => {
  // Expensive operation
});
```

## Motion API Integration Guidelines

### Request Building
```javascript
const params = new URLSearchParams();
if (workspaceId) params.append('workspaceId', workspaceId);
// Build query string only if params exist
const url = params.toString() ? `/endpoint?${params.toString()}` : '/endpoint';
```

### Response Handling
```javascript
// Motion API responses vary in structure
const items = response.data?.items || response.data || [];
// Always log response structure for debugging
mcpLog('info', 'API response received', {
  responseStructure: response.data?.items ? 'wrapped' : 'direct'
});
```

### Authentication
- Never log the API key
- Store in MOTION_API_KEY environment variable
- Add to headers: `'X-API-Key': this.apiKey`

## Testing Guidelines

### Manual Testing Checklist
1. Test each tool independently via MCP client
2. Verify error cases return proper MCP format
3. Check workspace resolution works correctly
4. Validate all required parameters
5. Test with missing optional parameters
6. Verify response format matches expectations

### Debugging Tips
- Use stderr JSON logs for debugging
- Test with Claude desktop app or MCP inspector
- Use curl/Postman to verify Motion API behavior
- Check for rate limit responses (429)

## Performance Considerations

### API Call Optimization
- Batch operations where possible
- Cache rarely-changing data (workspaces, users)
- Implement retry with exponential backoff
- Respect rate limits

### Tool Design
- Consolidate related operations to reduce tool count
- Keep tool descriptions concise but clear
- Minimize parameter complexity

## Security Requirements

1. **Never expose API keys** in logs or responses
2. **Validate all inputs** before API calls
3. **Sanitize error messages** shown to users
4. **Don't store sensitive data** in memory longer than needed
5. **Use HTTPS only** for API calls

## Naming Conventions

### Variables & Functions
- camelCase for variables and functions
- PascalCase for classes
- UPPER_SNAKE_CASE for constants

### Tool Names
- Prefix with `motion_` for clarity
- Use underscores for multi-word names
- Keep names under 30 characters

### File Names
- lowercase with hyphens for multi-word
- .js extension for all JavaScript files
- Descriptive names that match exports

## Documentation Standards

### Code Comments
- Minimal inline comments (code should be self-documenting)
- JSDoc for public methods if complex
- TODO comments for known issues

### Tool Descriptions
- First sentence: what it does
- Include key parameters in description
- Mention workspace requirements
- Note any limitations

## Task Lifecycle

1. Select task from `context/tasks/current/`
2. Create feature branch (see Git Branch Management above)
3. Update working-state.md with active task
4. Implement following task file specs
5. Run testing checklist
6. Move task file to `context/tasks/completed/`
7. Update tasks-index.md
8. Create PR for review

## Version Control

### Commit Messages
- Use conventional commits if possible
- Reference issue numbers
- Keep messages concise but descriptive

### Branch Strategy
- main branch for stable code
- feature branches for new tools
- hotfix branches for urgent fixes
