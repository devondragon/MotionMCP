# Motion MCP Server

A Model Context Protocol (MCP) server that provides LLMs with direct access to the Motion API for task and project management. This server implements the MCP protocol to enable seamless integration between AI assistants and Motion's productivity platform.

## Features

- **MCP Protocol Implementation**: Full Model Context Protocol support for LLM integration
- **Motion API Integration**: Complete CRUD operations for projects, tasks, workspaces, and users
- **12 Built-in Tools**: Comprehensive set of tools for Motion management
- **JSON Schema Validation**: Proper input validation and type safety
- **Multiple Deployment Options**: MCP server, REST API, and Cloudflare Worker
- **Error Handling**: Robust error handling with detailed feedback
- **API Key Authentication**: Secure Motion API integration

## Prerequisites

- Node.js 18 or higher
- Motion API key (get from https://app.usemotion.com/settings/api)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your Motion API key:
   ```
   MOTION_API_KEY=your_motion_api_key_here
   PORT=3000
   NODE_ENV=development
   ```

## Usage

### MCP Server (Primary)
The MCP server connects directly to LLMs via stdio transport:

```bash
# Run the MCP server
npm run mcp

# Or run directly
node src/mcp-server.js
```

### REST API Server (Alternative)
Traditional REST API for web applications:

```bash
# Run the REST server
npm start
```

### Docker
```bash
# Build the image
docker build -t motion-mcp-server .

# Run the REST container
docker run -p 3000:3000 --env-file .env motion-mcp-server

# Run the MCP container
docker run --env-file .env motion-mcp-server npm run mcp
```

## MCP Tools

The MCP server provides 12 tools for Motion integration:

### Project Management
- `create_motion_project` - Create a new project
- `list_motion_projects` - List all projects  
- `get_motion_project` - Get project details by ID
- `update_motion_project` - Update project properties
- `delete_motion_project` - Delete a project

### Task Management
- `create_motion_task` - Create a new task
- `list_motion_tasks` - List tasks with optional filters
- `get_motion_task` - Get task details by ID
- `update_motion_task` - Update task properties
- `delete_motion_task` - Delete a task

### Workspace & User Info
- `list_motion_workspaces` - List all workspaces
- `list_motion_users` - List all users

## REST API Endpoints (Alternative)

### Health Check
- `GET /health` - Returns server status

### Projects
- `GET /api/motion/projects` - List all projects
- `POST /api/motion/projects` - Create a new project
- `GET /api/motion/projects/:id` - Get project by ID
- `PATCH /api/motion/projects/:id` - Update project
- `DELETE /api/motion/projects/:id` - Delete project

### Tasks
- `GET /api/motion/tasks` - List all tasks (supports query params: projectId, status, assigneeId)
- `POST /api/motion/tasks` - Create a new task
- `GET /api/motion/tasks/:id` - Get task by ID
- `PATCH /api/motion/tasks/:id` - Update task
- `DELETE /api/motion/tasks/:id` - Delete task

### Workspaces & Users
- `GET /api/motion/workspaces` - List all workspaces
- `GET /api/motion/users` - List all users

## MCP Integration Examples

### Using with Claude Desktop
Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "motion": {
      "command": "node",
      "args": ["/path/to/MotionMCP/src/mcp-server.js"],
      "env": {
        "MOTION_API_KEY": "your_motion_api_key_here"
      }
    }
  }
}
```

### LLM Tool Usage Examples

**Create a project:**
```
LLM: I'll create a new project for you.
Tool: create_motion_project
Args: {"name": "Website Redesign", "description": "Redesign company website", "color": "#FF5733"}
Result: Successfully created project "Website Redesign" with ID: proj_123
```

**List tasks:**
```
LLM: Let me check your current tasks.
Tool: list_motion_tasks  
Args: {"status": "TODO"}
Result: Found 5 tasks:
- Fix login bug (ID: task_456) - Status: TODO
- Update documentation (ID: task_789) - Status: TODO
```

## REST API Examples (Alternative)

### Create Project
```bash
curl -X POST http://localhost:3000/api/motion/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My New Project",
    "description": "Project description",
    "color": "#FF5733"
  }'
```

### Create Task
```bash
curl -X POST http://localhost:3000/api/motion/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Complete API integration",
    "description": "Integrate with Motion API",
    "status": "TODO",
    "priority": "HIGH",
    "projectId": "project-id-here"
  }'
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MOTION_API_KEY` | Your Motion API key (required) | - |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment (development/production) | development |

## Motion API Documentation

For detailed information about Motion's API, visit: https://docs.usemotion.com/

## Error Handling

The server includes comprehensive error handling:
- API validation errors return 400 status
- Missing resources return 404 status
- Authentication errors return 401/403 status
- Server errors return 500 status
- All errors are logged with Winston

## Security

- API keys are never logged
- All sensitive information is kept out of logs
- CORS is configured for cross-origin requests
- Input validation on all endpoints

## Architecture

The project provides multiple integration methods:

```
src/
├── mcp-server.js     # MCP protocol server (primary)
├── index.js          # REST API server (alternative)
├── worker.js         # Cloudflare Worker (alternative)
├── routes/
│   └── motion.js     # REST API routes
├── services/
│   └── motionApi.js  # Motion API service layer
└── utils/            # Utility functions
```

### MCP vs REST vs Worker

- **MCP Server**: Direct LLM integration via stdio transport
- **REST API**: Traditional web API for browser/app integration  
- **Cloudflare Worker**: Serverless edge deployment

## How MCP Communication Works

1. **LLM Discovery**: LLM calls `tools/list` to discover available tools
2. **Tool Schema**: Server returns JSON schemas for each tool
3. **Tool Execution**: LLM calls `tools/call` with tool name and arguments
4. **Response**: Server executes Motion API call and returns structured result

**Example Protocol Flow:**
```json
// LLM requests available tools
{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}

// Server responds with tool definitions
{"jsonrpc": "2.0", "id": 1, "result": {"tools": [...]}}

// LLM calls a tool
{"jsonrpc": "2.0", "id": 2, "method": "tools/call", 
 "params": {"name": "create_motion_task", "arguments": {...}}}

// Server executes and responds
{"jsonrpc": "2.0", "id": 2, "result": {"content": [...]}}
```

## License

ISC