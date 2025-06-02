#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const winston = require('winston');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

const motionRoutes = require('./routes/motion');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Parse command line arguments
function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  const apiKeyArg = args.find(arg => arg.startsWith('--api-key='));
  if (apiKeyArg) {
    process.env.MOTION_API_KEY = apiKeyArg.split('=')[1];
  }

  const portArg = args.find(arg => arg.startsWith('--port='));
  if (portArg) {
    process.env.PORT = portArg.split('=')[1];
  }
}

// Check for config file in user's home directory
function loadConfigFile() {
  const configPath = path.join(os.homedir(), '.motionmcp.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.apiKey && !process.env.MOTION_API_KEY) {
        process.env.MOTION_API_KEY = config.apiKey;
      }
      if (config.port && !process.env.PORT) {
        process.env.PORT = config.port;
      }
    } catch (err) {
      logger.warn('Failed to parse config file:', err.message);
    }
  }
}

// Interactive prompt for API key
async function promptForApiKey() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Please enter your Motion API key: ', (answer) => {
      rl.close();
      const apiKey = answer.trim();
      if (apiKey) {
        process.env.MOTION_API_KEY = apiKey;
      }
      resolve(apiKey);
    });
  });
}

// Get API key from various sources
async function getApiKey() {
  // Check if already set in environment
  if (process.env.MOTION_API_KEY) {
    return process.env.MOTION_API_KEY;
  }

  // Parse command line arguments
  parseCommandLineArgs();
  if (process.env.MOTION_API_KEY) {
    return process.env.MOTION_API_KEY;
  }

  // Load from config file
  loadConfigFile();
  if (process.env.MOTION_API_KEY) {
    return process.env.MOTION_API_KEY;
  }

  // Prompt user interactively
  logger.info('No API key found in environment variables, command line args, or config file.');
  const apiKey = await promptForApiKey();
  return apiKey;
}

// Initialize and start the server
async function startServer() {
  try {
    const apiKey = await getApiKey();

    if (!apiKey) {
      logger.error('API key is required to run Motion MCP Server');
      logger.info('You can provide it via:');
      logger.info('  Environment variable: MOTION_API_KEY=your-key npx motionmcp');
      logger.info('  Command line arg: npx motionmcp --api-key=your-key');
      logger.info('  Config file: echo \'{"apiKey": "your-key"}\' > ~/.motionmcp.json');
      process.exit(1);
    }

    logger.info('Motion API key configured successfully');

    const app = express();
    const PORT = process.env.PORT || 3000;

    app.use(cors());
    app.use(express.json());

    // Add API key to request context
    app.use((req, res, next) => {
      req.motionApiKey = process.env.MOTION_API_KEY;
      next();
    });

    app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, { ip: req.ip });
      next();
    });

    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        hasApiKey: !!process.env.MOTION_API_KEY
      });
    });

    app.use('/api/motion', motionRoutes);

    app.use((err, req, res, next) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });

    app.listen(PORT, () => {
      logger.info(`Motion MCP Server running on port ${PORT}`);
      logger.info(`Health check available at http://localhost:${PORT}/health`);
    });

    return app;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Start the server if this file is run directly
if (require.main === module) {
  startServer().catch(console.error);
}

module.exports = { startServer };
