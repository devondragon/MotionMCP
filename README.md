# Motion MCP Server

A Node.js server that provides RESTful API endpoints for integrating with the Motion API. This server acts as a proxy/wrapper around Motion's API with proper authentication, error handling, and logging.

## Features

- Complete CRUD operations for Motion projects and tasks
- API key authentication with Motion
- Comprehensive error handling and logging
- Input validation for all endpoints
- Docker containerization support
- Health check endpoint
- CORS enabled for cross-origin requests

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

### Development
```bash
npm start
```

### Docker
```bash
# Build the image
docker build -t motion-mcp-server .

# Run the container
docker run -p 3000:3000 --env-file .env motion-mcp-server
```

## API Endpoints

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

## Request/Response Examples

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

### Get Tasks with Filters
```bash
curl "http://localhost:3000/api/motion/tasks?projectId=123&status=TODO"
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

## Development

The project structure:
```
src/
├── index.js          # Main server file
├── routes/
│   └── motion.js     # API routes
├── services/
│   └── motionApi.js  # Motion API service
└── utils/            # Utility functions
```

## License

ISC