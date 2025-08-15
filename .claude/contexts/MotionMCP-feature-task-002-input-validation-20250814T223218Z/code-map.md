# Code Map

## Core Files for Task-002

### To Be Created
- `src/utils/validators.js` - Input validation functions
  - validatePriority() - Check task priority values
  - validateStatus() - Validate task/project status
  - validateDate() - ISO 8601 date validation
  - validateDuration() - Task duration validation
  - validateHexColor() - Color format validation
  - validateRequiredFields() - Check required fields

### To Be Modified
- `src/mcp-server.js` - Apply validators to handlers
  - handleCreateTask() - Add input validation
  - handleUpdateTask() - Validate update fields
  - handleCreateProject() - Validate project data
  - handleUpdateProject() - Validate project updates

## Existing Core Files

### Services
- `src/services/motionApi.ts` - Motion API client
  - requestWithRetry() - Retry logic with exponential backoff
  - getProjects(), createProject(), updateProject(), deleteProject()
  - getTasks(), createTask(), updateTask(), deleteTask()
  - getWorkspaces(), getUsers()
  - All methods now include retry logic

### Utilities
- `src/utils/constants.ts` - Configuration and constants
  - ERROR_CODES - Error code definitions
  - RETRY_CONFIG - Retry configuration (3 attempts, 250ms initial)
  - LOG_LEVELS - Logging level constants
  - DEFAULTS - Default values for various operations

- `src/utils/logger.ts` - MCP-compliant logging
  - mcpLog() - Structured JSON logging to stderr

- `src/utils/responseFormatters.ts` - Response formatting
  - formatMcpSuccess() - Success response format
  - formatMcpError() - Error response format

### Types
- `src/types/motion.ts` - Motion API type definitions
  - MotionTask, MotionProject, MotionWorkspace, MotionUser
  - API request/response interfaces

### Configuration
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `.env` - Environment variables (MOTION_API_KEY)

## API Endpoints Covered
- Projects: create, list, get, update, delete
- Tasks: create, list, get, update, delete
- Workspaces: list
- Users: list

## Tool Organization
- Consolidated tools: motion_projects, motion_tasks
- Configuration via MOTION_MCP_TOOLS environment variable
- Tool sets: minimal (3), essential (6), all (20+)