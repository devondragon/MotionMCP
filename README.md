# Motion MCP Server

A Model Context Protocol (MCP) server that provides LLMs with direct access to the Motion API for task and project management. This server implements the MCP protocol to enable seamless integration between AI assistants and Motion's productivity platform.

## Features

- **MCP Protocol Implementation**: Full Model Context Protocol support for LLM integration
- **Motion API Integration**: Complete CRUD operations for projects, tasks, workspaces, and users
- **18 Built-in Tools**: Comprehensive set of tools for Motion management with AI-powered intelligence
- **Context Awareness**: Real-time workspace context, recent activity, and intelligent suggestions
- **Smart Workspace Management**: Automatic workspace detection and selection
- **Intelligent Search**: Semantic search across tasks and projects with relevance scoring
- **Workload Analytics**: Comprehensive workload analysis with overdue tasks and deadline tracking
- **Workflow Intelligence**: Smart scheduling, bulk operations, and next action suggestions
- **Project Templates**: Pre-built project templates with intelligent task creation
- **Enhanced Task Creation**: Supports all Motion API parameters with intelligent defaults
- **MCP-Compliant Logging**: Structured JSON logging to stderr for debugging
- **JSON Schema Validation**: Proper input validation and type safety
- **Robust Error Handling**: Detailed error messages and fallback mechanisms
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
   ```

## Usage

The Motion MCP Server runs as a Model Context Protocol server for direct LLM integration:

```bash
# Run the MCP server
npm run mcp

# Or run directly
node src/mcp-server.js
```

## MCP Tools

The MCP server provides 18 intelligent tools for Motion integration with enhanced AI capabilities:

### Context & Intelligence
- `get_motion_context` - Get comprehensive workspace context, recent activity, and smart suggestions
- `search_motion_content` - Intelligent search across tasks and projects with semantic relevance
- `analyze_motion_workload` - Analyze workload distribution, overdue tasks, and productivity insights
- `suggest_next_actions` - AI-powered suggestions for next actions based on current state

### Project Management
- `create_motion_project` - Create a new project with workspace auto-detection
- `create_project_template` - Create projects from intelligent templates (software dev, marketing, etc.)
- `list_motion_projects` - List projects with workspace filtering support
- `get_motion_project` - Get project details by ID
- `update_motion_project` - Update project properties
- `delete_motion_project` - Delete a project

### Task Management
- `create_motion_task` - Create a new task with intelligent workspace/project resolution
- `list_motion_tasks` - List tasks with workspace and project filtering
- `get_motion_task` - Get task details by ID
- `update_motion_task` - Update task properties
- `delete_motion_task` - Delete a task
- `bulk_update_tasks` - Update multiple tasks simultaneously
- `smart_schedule_tasks` - AI-powered intelligent task scheduling

### Workspace & User Info
- `list_motion_workspaces` - List all workspaces with enhanced details
- `list_motion_users` - List all users

## Enhanced Tool Features

### Smart Workspace Management
- **Auto-detection**: Automatically uses default workspace when none specified
- **Name resolution**: Find workspaces by name instead of requiring IDs
- **Intelligent defaults**: Prefers "Personal" workspaces as default
- **Fallback handling**: Graceful handling when workspace resolution fails

### Advanced Task Creation
The `create_motion_task` tool now supports all Motion API parameters:

**Basic Parameters:**
- `name` (required) - Task title
- `description` - Markdown-supported task description
- `workspaceId` / `workspaceName` - Workspace specification (auto-detects if omitted)
- `projectId` / `projectName` - Project assignment (optional)

**Advanced Parameters:**
- `status` - Task status (uses workspace default if omitted)
- `priority` - ASAP, HIGH, MEDIUM, or LOW
- `dueDate` - ISO 8601 date (required for scheduled tasks)
- `duration` - Minutes (number), "NONE", or "REMINDER"
- `assigneeId` - User ID for task assignment
- `labels` - Array of label names
- `autoScheduled` - Auto-scheduling configuration (object or null)

### Intelligent Project Resolution
- **Name lookup**: Find projects by partial or exact name match
- **Workspace scoping**: Project searches are scoped to specific workspaces
- **Fuzzy matching**: Supports partial name matching for easier use
- **Error feedback**: Clear messages when projects aren't found

## AI-Powered Intelligence Features

### Context Awareness
The `get_motion_context` tool provides LLMs with comprehensive situational awareness:

**Real-time Context:**
- Current default workspace and available workspaces
- User information and permissions
- Recent activity across tasks and projects
- Current workload distribution and status

**Intelligent Suggestions:**
- Overdue tasks requiring immediate attention
- High-priority items to focus on next
- Upcoming deadlines and time-sensitive work
- Project status insights and recommendations

**Example Usage:**
```
LLM: Let me get your current Motion context to understand your situation.
Tool: get_motion_context
Result: You're in "Development" workspace with 15 active tasks. You have 3 overdue tasks and 5 high-priority items. Recent activity shows focus on "API Integration" project.
Suggestions:
- Address 3 overdue tasks (Task A, B, C)
- Continue work on high-priority "Security Review"
- Upcoming deadline: "Release Planning" due tomorrow
```

### Intelligent Search
The `search_motion_content` tool provides semantic search capabilities:

**Advanced Search Features:**
- Content-aware search across task descriptions and project details
- Relevance scoring based on exact matches, partial matches, and priority
- Scoped search (tasks only, projects only, or both)
- Priority boosting for urgent items

**Example Usage:**
```
LLM: Let me search for anything related to "API security"
Tool: search_motion_content
Args: {"query": "API security", "searchScope": "both"}
Result: Found 4 relevant items:
- [task] API Security Review (ID: task_789) - Relevance: 95
- [project] Security Audit (ID: proj_456) - Relevance: 70
- [task] Update API documentation (ID: task_012) - Relevance: 45
```

### Workload Analytics
The `analyze_motion_workload` tool provides comprehensive productivity insights:

**Analytics Capabilities:**
- Task distribution by status, priority, and project
- Overdue task identification and counting
- Upcoming deadline tracking and alerts
- Project health and progress monitoring
- Time-based analysis (today, this week, this month)

**Example Usage:**
```
LLM: Let me analyze your current workload.
Tool: analyze_motion_workload
Args: {"timeframe": "this_week", "includeProjects": true}
Result: Workload Analysis (this_week):
- Total Tasks: 23
- Overdue Tasks: 3
- Upcoming Deadlines: 7
- Task Distribution:
  - In Progress: 8 tasks
  - Todo: 12 tasks
  - Completed: 3 tasks
- Project Insights:
  - 4 active projects
  - 2 projects behind schedule
```

### Smart Scheduling
The `smart_schedule_tasks` tool provides AI-powered task optimization:

**Intelligent Scheduling Features:**
- Priority-based task ordering (ASAP → HIGH → MEDIUM → LOW)
- Deadline-aware scheduling with urgency detection
- Workload balancing and buffer time inclusion
- Conflict detection and resolution suggestions
- Automatic unscheduled task discovery

**Example Usage:**
```
LLM: Let me intelligently schedule your unscheduled tasks.
Tool: smart_schedule_tasks
Args: {"schedulingPreferences": {"prioritizeDeadlines": true}}
Result: Scheduled 8 tasks optimally:
- Task ID: task_456 -> 9:00 AM (ASAP priority)
- Task ID: task_789 -> 10:30 AM (Due today)
- Task ID: task_012 -> 2:00 PM (HIGH priority)
```

### Workflow Intelligence
The `suggest_next_actions` tool provides proactive assistance:

**Smart Suggestions Based On:**
- Current task priorities and deadlines
- Project status and momentum
- Historical patterns and preferences
- Workload balance and capacity
- Context-aware recommendations (daily planning, project review, etc.)

**Example Usage:**
```
LLM: What should I focus on next?
Tool: suggest_next_actions
Args: {"context": "daily planning", "maxSuggestions": 3}
Result: Suggested Next Actions:
✅ Complete "Security Review" (task_789) - ASAP priority, due today
⏰ Start "Database Migration" (task_456) - Due in 2 days
🔄 Review stalled project: "Mobile App" - No recent activity
```

## Quick Start for LLM Context

**For optimal LLM assistance, start with these tools:**

1. **`get_motion_context`** - Get comprehensive workspace overview and current state
2. **`analyze_motion_workload`** - Understand current workload and priorities
3. **`suggest_next_actions`** - Get AI-powered recommendations for what to focus on next

**Example Intelligent Workflow:**
```
User: "Help me plan my day"

LLM: I'll help you plan your day efficiently. Let me first understand your current situation.

1. Getting your Motion context...
Tool: get_motion_context
Result: You're in "Work" workspace with 12 active tasks, 2 overdue items, and 4 high-priority tasks.

2. Analyzing your current workload...
Tool: analyze_motion_workload
Args: {"timeframe": "today"}
Result: Today you have 6 tasks, 2 are overdue, 3 due by end of day.

3. Generating smart suggestions...
Tool: suggest_next_actions
Args: {"context": "daily planning"}
Result: Recommended focus:
- ✅ Complete overdue "Security Review" (ASAP priority)
- ⏰ Finish "Database Migration" (due today)
- 🚀 Start "Feature Testing" (high priority, good momentum)

Based on this analysis, I recommend starting with the overdue Security Review task since it's marked ASAP priority, then moving to the Database Migration that's due today. This will clear your urgent items and give you momentum for the day.

Would you like me to help schedule these tasks or create any new tasks for your day?
```

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

**Create a simple task:**
```
LLM: I'll create a new task for you.
Tool: create_motion_task
Args: {"name": "Review quarterly reports"}
Result: Successfully created task "Review quarterly reports" with ID: task_123 in workspace ws_456
```

**Create an advanced task with project assignment:**
```
LLM: I'll create a detailed task in your development project.
Tool: create_motion_task
Args: {
  "name": "Complete API integration",
  "description": "Integrate with Motion API and test all endpoints",
  "workspaceName": "Development",
  "projectName": "Feature Release",
  "priority": "HIGH",
  "dueDate": "2025-05-30T17:00:00.000Z",
  "duration": 120,
  "labels": ["api", "integration", "urgent"]
}
Result: Successfully created task "Complete API integration" with ID: task_789 in project proj_456 in workspace ws_123
```

**List projects with workspace filtering:**
```
LLM: Let me check your development projects.
Tool: list_motion_projects
Args: {"workspaceName": "Development"}
Result: Found 3 projects in Development workspace:
- Feature Release (ID: proj_456) - Status: In Progress
- Bug Fixes (ID: proj_789) - Status: Todo
- Documentation (ID: proj_012) - Status: Backlog
```

**List tasks with intelligent filtering:**
```
LLM: Let me check your current tasks.
Tool: list_motion_tasks
Args: {"workspaceName": "Personal", "projectName": "Website Redesign"}
Result: Found 5 tasks in Website Redesign project:
- Fix responsive layout (ID: task_456) - Status: In Progress
- Update color scheme (ID: task_789) - Status: Todo
- Optimize images (ID: task_012) - Status: Done
- Test on mobile (ID: task_345) - Status: Todo
- Deploy to staging (ID: task_678) - Status: Backlog
```

## Configuration

### Environment Variables

| Variable         | Description                    | Default |
| ---------------- | ------------------------------ | ------- |
| `MOTION_API_KEY` | Your Motion API key (required) | -       |

## Motion API Documentation

For detailed information about Motion's API, visit: https://docs.usemotion.com/

## Error Handling & Logging

The server includes comprehensive error handling and MCP-compliant logging:

### MCP-Compliant Logging
- **Structured JSON logs** to stderr for MCP compliance
- **Detailed context** including method names, IDs, and API responses
- **Error tracking** with API status codes and messages
- **Performance monitoring** with request/response timing

### Enhanced Error Handling
- **Smart workspace resolution** with fallback to defaults
- **Project lookup validation** with helpful error messages
- **API response structure handling** for wrapped/unwrapped responses
- **Input validation** with detailed parameter requirements
- **Graceful degradation** when optional features fail

### Error Response Examples
```json
// Missing workspace error
{"error": "workspaceId is required and no default workspace could be found"}

// Project not found error
{"error": "Project 'Marketing Campaign' not found in workspace"}

// Invalid parameter error
{"error": "Task priority must be one of: ASAP, HIGH, MEDIUM, LOW"}
```

## Security

- API keys are never logged or exposed
- All sensitive information is kept out of logs
- Input validation on all endpoints
- MCP-compliant structured logging to stderr
- Workspace-scoped operations for data isolation

## Architecture

The Motion MCP Server is designed as a focused MCP implementation:

```
src/
├── mcp-server.js     # MCP protocol server implementation
├── services/
│   └── motionApi.js  # Enhanced Motion API service layer
└── utils/            # Utility functions
```

### Key Components

**MotionApiService (`motionApi.js`):**
- **Smart workspace detection** with default workspace resolution
- **Project lookup by name** with fuzzy matching capabilities
- **Enhanced error handling** with detailed context and fallbacks
- **MCP-compliant logging** with structured JSON output
- **API response handling** for Motion's wrapped response formats

**MCP Server (`mcp-server.js`):**
- **Intelligent parameter resolution** for workspace and project names
- **Enhanced tool definitions** with comprehensive parameter documentation
- **Robust error handling** with user-friendly error messages
- **Workspace-aware operations** for all project and task management

## Recent Improvements

### Version 2.0 Enhancements
- ✅ **MCP-Compliant Logging**: Replaced Winston with structured JSON logging to stderr
- ✅ **Smart Workspace Management**: Auto-detection and intelligent defaults for workspaces
- ✅ **Enhanced Task Creation**: Support for all Motion API parameters with intelligent resolution
- ✅ **Project Name Resolution**: Find projects by name with fuzzy matching
- ✅ **Robust Error Handling**: Detailed error messages with context and fallback mechanisms
- ✅ **API Response Handling**: Fixed handling of Motion's wrapped response formats (`{projects: [...]}`, `{workspaces: [...]}`)
- ✅ **Workspace-Aware Operations**: All tools now support workspace filtering and auto-detection
- ✅ **Improved Documentation**: Comprehensive parameter descriptions and usage examples

### Version 2.1 Intelligence Enhancements
- ✅ **Context Awareness**: Real-time workspace context with activity tracking and intelligent suggestions
- ✅ **Intelligent Search**: Semantic search across tasks and projects with relevance scoring
- ✅ **Workload Analytics**: Comprehensive workload analysis with overdue tasks and deadline tracking
- ✅ **Smart Scheduling**: AI-powered task scheduling with priority and deadline optimization
- ✅ **Workflow Intelligence**: Proactive next action suggestions based on current state
- ✅ **Project Templates**: Pre-built intelligent templates for common project types
- ✅ **Bulk Operations**: Efficient batch updates for multiple tasks simultaneously
- ✅ **Enhanced Tool Count**: Expanded from 12 to 18 tools with AI-powered capabilities

### Breaking Changes
- **Logging Format**: Changed from Winston file logging to MCP-compliant JSON stderr logging
- **Task Creation**: `workspaceId` is now auto-resolved if not provided (was previously required)
- **Response Handling**: Fixed array method errors by properly handling wrapped API responses

## Debugging & Troubleshooting

### MCP Logging
The server outputs structured JSON logs to stderr for debugging:
```json
{"level":"info","msg":"Successfully fetched projects","method":"getProjects","count":3,"workspaceId":"ws_123","time":"2025-05-26T22:30:45.123Z"}
{"level":"error","msg":"Failed to create task","method":"createTask","error":"workspaceId is required","time":"2025-05-26T22:30:46.456Z"}
```

### Common Issues

**Task Creation Fails:**
- Ensure your Motion API key has task creation permissions
- Check that the workspace exists and is accessible
- Verify project names are spelled correctly (uses fuzzy matching)

**Workspace Not Found:**
- List workspaces first with `list_motion_workspaces`
- Use exact workspace names or IDs
- Check API key permissions for workspace access

**Project Resolution Issues:**
- Projects are searched within the specified workspace only
- Use partial names for fuzzy matching: "Marketing" will find "Marketing Campaign"
- Ensure the project exists in the target workspace

### Debugging Tips
1. **Check stderr output** for detailed MCP logs
2. **Use `list_motion_workspaces`** to see available workspaces
3. **Test with simple task creation** before using advanced parameters
4. **Verify API key permissions** in Motion settings

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
