# Motion MCP Server

A Model Context Protocol (MCP) server that provides LLMs with direct access to the Motion API for task and project management. This server implements the MCP protocol to enable seamless integration between AI assistants and Motion's productivity platform.

## Quick Start with `npx`

You can run the Motion MCP Server without installing it globally:

```bash
npx motionmcp --api-key=your_motion_api_key
```

Or using an environment variable:

```bash
MOTION_API_KEY=your_motion_api_key npx motionmcp
```

You can also provide a config file at `~/.motionmcp.json`:

```json
{
  "apiKey": "your_motion_api_key",
  "port": 4000
}
```

Then simply run:

```bash
npx motionmcp
```

> The `npx` command will always fetch and run the latest published version.

## Preview

<a href="sample.png"><img src="sample.png" alt="Motion MCP Server Preview" width="400" /></a>

*Click the image above to view full size*

## Features

* Full MCP Protocol support for seamless LLM integration
* Deep Motion API integration for projects, tasks, workspaces, and users
* 18 intelligent, ready-to-use tools
* Real-time context awareness and smart suggestions
* Project templates, smart scheduling, workload analytics, and more
* API key authentication with multiple configuration options
* MCP-compliant structured JSON logging
* **TypeScript** implementation with full type safety
* Robust error handling and input validation

## Prerequisites

* Node.js 18 or higher
* Motion API key from [https://app.usemotion.com/settings/api](https://app.usemotion.com/settings/api)

## Installation (Development)

```bash
git clone https://github.com/your-org/motionmcp-server.git
cd motionmcp-server
npm install
cp .env.example .env
# edit .env and add your MOTION_API_KEY
```

## Running the Server (Development)

```bash
npm run mcp
# or
node src/mcp-server.js
```

## Providing Your Motion API Key

The Motion MCP Server supports the following ways to provide your API key:

### 1. Environment Variable

```bash
MOTION_API_KEY=your-key npx motionmcp
```

### 2. Command Line Argument

```bash
npx motionmcp --api-key=your-key --port=4000
```

### 3. Config File

```bash
echo '{"apiKey": "your-key", "port": 4000}' > ~/.motionmcp.json
npx motionmcp
```

### 4. Interactive Prompt

```bash
npx motionmcp
# Prompts: "Please enter your Motion API key:"
```

> Order of precedence: ENV → CLI Arg → Config File → Prompt

## Tool Overview

### Context & Intelligence

* `get_motion_context` – Current workspace, activity, and next action suggestions
* `search_motion_content` – Semantic search across tasks and projects
* `analyze_motion_workload` – Workload analysis and overdue tracking
* `suggest_next_actions` – Smart planning suggestions based on your current state

### Project Management

* `create_motion_project`
* `create_project_template`
* `list_motion_projects`
* `get_motion_project`
* `update_motion_project`
* `delete_motion_project`

### Task Management

* `create_motion_task`
* `list_motion_tasks`
* `get_motion_task`
* `update_motion_task`
* `delete_motion_task`
* `bulk_update_tasks`
* `smart_schedule_tasks`

### Workspace & User Info

* `list_motion_workspaces`
* `list_motion_users`

## Enhanced Features

### Smart Defaults & Resolution

* Workspace and project auto-detection and fuzzy matching
* Intelligent defaults: selects "Personal" workspace if none provided
* Robust fallback and error messaging

### Task Creation

Supports all Motion API parameters:

* Basic: `name`, `description`, `workspaceId|workspaceName`, `projectId|projectName`
* Advanced: `priority`, `dueDate`, `duration`, `labels`, `assigneeId`, `autoScheduled`

### Semantic Search

* Cross-search by query with intelligent scope and priority boosting

### Scheduling & Workload

* Prioritized scheduling with conflict detection and task balancing
* Detailed workload breakdowns by status, priority, and project

## Example Tool Use

```json
Tool: create_motion_task
Args: {
  "name": "Complete API integration",
  "workspaceName": "Development",
  "projectName": "Release Cycle Q2",
  "dueDate": "2025-06-15T09:00:00Z",
  "priority": "HIGH",
  "labels": ["api", "release"]
}
```

## LLM Integration

Add this config to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "motion": {
      "command": "npx",
      "args": ["motionmcp"],
      "env": {
        "MOTION_API_KEY": "your_api_key"
      }
    }
  }
}
```

## Debugging

* Logs output to `stderr` in JSON format
* Check for missing keys, workspace/project names, and permissions
* Use `list_motion_workspaces` and `list_motion_projects` to validate IDs

## Logging Example

```json
{
  "level": "info",
  "msg": "Task created successfully",
  "method": "create_motion_task",
  "taskId": "task_789",
  "workspace": "Development"
}
```

## License

ISC License

---

For more information, see the full [Motion API docs](https://docs.usemotion.com/) or [Model Context Protocol docs](https://modelcontextprotocol.io/docs/).
