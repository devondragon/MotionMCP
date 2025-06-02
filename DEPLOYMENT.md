# Motion MCP Server Deployment Guide

This guide covers deploying the Motion MCP Server in both local (stdio) and remote (Cloudflare Worker) modes.

## Prerequisites

1. **Motion API Key**: Get your API key from Motion settings
2. **Node.js**: Version 18+ for local development
3. **Cloudflare Account**: For Worker deployment (free tier available)
4. **Wrangler CLI**: Install globally with `npm install -g wrangler`

## Local Deployment (stdio)

### Setup

1. Clone and install dependencies:
```bash
git clone <repository>
cd MotionMCP
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env and set your MOTION_API_KEY
```

3. Test the MCP server:
```bash
npm run mcp
```

### Usage with Claude Desktop

Add to your Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "motion": {
      "command": "npx",
      "args": ["motionmcp"],
      "env": {
        "MOTION_API_KEY": "your-motion-api-key"
      }
    }
  }
}
```

Or using the global package:

```json
{
  "mcpServers": {
    "motion": {
      "command": "node",
      "args": ["/path/to/MotionMCP/src/mcp-server.js"],
      "env": {
        "MOTION_API_KEY": "your-motion-api-key"
      }
    }
  }
}
```

## Remote Deployment (Cloudflare Workers)

### Setup

1. Login to Cloudflare:
```bash
wrangler auth login
```

2. Set your Motion API key as a secret:
```bash
npm run worker:secret
# Or manually: wrangler secret put MOTION_API_KEY
```

3. Deploy to staging:
```bash
npm run worker:dev
```

4. Deploy to production:
```bash
npm run worker:deploy
```

### Usage with HTTP Stream Transport

Configure your MCP client to use HTTP Stream Transport:

```json
{
  "mcpServers": {
    "motion": {
      "transport": {
        "type": "http",
        "url": "https://your-worker.your-subdomain.workers.dev/mcp"
      }
    }
  }
}
```

### Available Endpoints

- **MCP Protocol**: `POST /mcp` - Main MCP HTTP Stream Transport endpoint
- **Health Check**: `GET /health` - Server status and API key validation
- **Legacy REST API**: `/api/motion/*` - Backwards compatible REST endpoints

### Monitoring

```bash
# View logs
npm run worker:tail

# Check deployment status
wrangler deployments list
```

## Environment Variables

### Local Development
Set in `.env` file or environment:

- `MOTION_API_KEY` (required): Your Motion API key
- `PORT` (optional): Local server port (default: 3000)
- `NODE_ENV` (optional): Environment mode

### Cloudflare Workers
Set using Wrangler secrets:

- `MOTION_API_KEY` (required): Set via `wrangler secret put MOTION_API_KEY`

## Troubleshooting

### Local Issues

1. **"API key not found"**: Ensure `.env` file exists with valid `MOTION_API_KEY`
2. **"Module not found"**: Run `npm install` to install dependencies
3. **Permission denied**: Check file permissions and Node.js installation

### Worker Issues

1. **"Motion API key not configured"**: Set secret with `npm run worker:secret`
2. **"Deployment failed"**: Check `wrangler.toml` configuration and login status
3. **"Unknown tool"**: Ensure worker code is properly deployed

### Testing

Test both deployments:

```bash
# Local MCP server
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node src/mcp-server.js

# Remote worker (after deployment)
curl -X POST https://your-worker.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

## Security Notes

- Never commit API keys to version control
- Use environment variables and secrets for sensitive data
- Regularly rotate your Motion API key
- Monitor worker logs for unusual activity

## Custom Domains

To use a custom domain with Cloudflare Workers:

1. Update `wrangler.toml`:
```toml
routes = [
  { pattern = "mcp.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

2. Deploy with custom domain:
```bash
npm run worker:deploy
```