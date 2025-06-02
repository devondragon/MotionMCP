# Motion MCP Server Testing Guide

This guide provides detailed steps to test both stdio and HTTP Stream Transport deployment modes.

## Prerequisites

1. **Motion API Key**: Get from [Motion Settings > API](https://app.usemotion.com/settings/api)
2. **Node.js 18+**: For local testing
3. **Cloudflare Account**: For Worker testing (free tier available)
4. **Tools**: curl, jq (optional for JSON formatting)

```bash
# Install required tools
npm install -g wrangler
npm install jq  # Optional for pretty JSON output
```

## 🖥️ Testing Local Mode (stdio)

### Step 1: Setup Local Environment

```bash
# Clone and setup
git clone <repository>
cd MotionMCP
npm install

# Configure environment
cp .env.example .env
# Edit .env and set MOTION_API_KEY=your-actual-api-key
```

### Step 2: Basic MCP Server Test

```bash
# Test server starts without errors
npm run mcp
# Should show: "Motion MCP Server running on stdio"
# Press Ctrl+C to stop
```

### Step 3: Manual MCP Protocol Test

```bash
# Test tools list
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | npm run mcp

# Expected output: JSON with list of 18 tools
```

### Step 4: Test Specific Tool

```bash
# Test workspace listing
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_motion_workspaces","arguments":{}},"id":2}' | npm run mcp

# Expected output: JSON with your Motion workspaces
```

### Step 5: Test with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "motion-test": {
      "command": "node",
      "args": ["/absolute/path/to/MotionMCP/src/mcp-server.js"],
      "env": {
        "MOTION_API_KEY": "your-motion-api-key"
      }
    }
  }
}
```

Restart Claude Desktop and verify Motion tools appear in the tool list.

## ☁️ Testing Remote Mode (Cloudflare Workers)

### Step 1: Deploy to Cloudflare

```bash
# Login to Cloudflare (opens browser)
wrangler auth login

# Set API key as secret
npm run worker:secret
# When prompted, enter your Motion API key

# Deploy to staging
npm run worker:dev
# Note the URL provided (e.g., https://motion-mcp-server.your-name.workers.dev)
```

### Step 2: Test Health Endpoint

```bash
# Replace with your actual worker URL
export WORKER_URL="https://motion-mcp-server.your-name.workers.dev"

# Test health check
curl -X GET $WORKER_URL/health | jq

# Expected output:
# {
#   "status": "ok",
#   "timestamp": "2024-01-01T12:00:00.000Z",
#   "hasApiKey": true
# }
```

### Step 3: Test MCP Initialize

```bash
# Test MCP protocol initialization
curl -X POST $WORKER_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05"},"id":1}' | jq

# Expected output: Server info and capabilities
```

### Step 4: Test Tools List

```bash
# Get list of available tools
curl -X POST $WORKER_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":2}' | jq

# Expected output: Array of 18 MCP tools
```

### Step 5: Test Tool Execution

```bash
# Test workspace listing
curl -X POST $WORKER_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"list_motion_workspaces",
      "arguments":{}
    },
    "id":3
  }' | jq

# Expected output: Your Motion workspaces
```

### Step 6: Test Error Handling

```bash
# Test invalid tool name
curl -X POST $WORKER_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"invalid_tool",
      "arguments":{}
    },
    "id":4
  }' | jq

# Expected output: Error response
```

### Step 7: Deploy to Production

```bash
# Deploy to production environment
npm run worker:deploy

# Test production URL
export PROD_URL="https://motion-mcp-server.your-name.workers.dev"
curl -X GET $PROD_URL/health | jq
```

### Step 8: Test with Claude Desktop (HTTP)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "motion-remote": {
      "transport": {
        "type": "http",
        "url": "https://motion-mcp-server.your-name.workers.dev/mcp"
      }
    }
  }
}
```

Restart Claude Desktop and verify Motion tools work via HTTP transport.

## 🔧 Advanced Testing

### Load Testing

```bash
# Test multiple concurrent requests
for i in {1..10}; do
  curl -X POST $WORKER_URL/mcp \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"tools/list","id":'$i'}' &
done
wait
```

### Task Creation Test

```bash
# Test creating a task
curl -X POST $WORKER_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"create_motion_task",
      "arguments":{
        "name":"Test Task from MCP",
        "description":"Created via MCP HTTP transport testing"
      }
    },
    "id":5
  }' | jq
```

### Context Intelligence Test

```bash
# Test motion context
curl -X POST $WORKER_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"get_motion_context",
      "arguments":{}
    },
    "id":6
  }' | jq
```

## 🐛 Troubleshooting

### Local Mode Issues

```bash
# Check if API key is valid
MOTION_API_KEY=your-key node -e "
const MotionApiService = require('./src/services/motionApi.js');
const service = new MotionApiService();
service.getWorkspaces().then(console.log).catch(console.error);
"
```

### Remote Mode Issues

```bash
# Check worker logs
npm run worker:tail

# Check deployment status
wrangler deployments list

# Test without secrets (should fail gracefully)
curl -X POST https://motion-mcp-server.your-name.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### Debug API Responses

```bash
# Verbose curl for debugging
curl -v -X POST $WORKER_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

## ✅ Success Criteria

### Local Mode (stdio)
- [ ] Server starts without errors
- [ ] MCP protocol responses are valid JSON-RPC
- [ ] Tools list returns 18 tools
- [ ] Workspace/task operations work
- [ ] Integrates with Claude Desktop

### Remote Mode (HTTP)
- [ ] Health check returns 200 with valid JSON
- [ ] MCP endpoints respond correctly
- [ ] All 18 tools are available
- [ ] Task creation/listing works
- [ ] Error handling is proper
- [ ] Integrates with Claude Desktop via HTTP transport

### Both Modes
- [ ] Same tool functionality
- [ ] Consistent error messages
- [ ] Motion API integration works
- [ ] Authentication is secure

## 📊 Performance Benchmarks

```bash
# Simple response time test
time curl -s $WORKER_URL/health > /dev/null

# MCP protocol performance
time curl -s -X POST $WORKER_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' > /dev/null
```

Expected response times:
- Health check: < 200ms
- Tools list: < 500ms
- Task operations: < 1000ms

## 🔐 Security Testing

```bash
# Test without API key (should fail)
curl -X POST $WORKER_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":1}'

# Test CORS headers
curl -X OPTIONS $WORKER_URL/mcp -v
```

This comprehensive testing guide ensures both deployment modes work correctly and maintain feature parity.