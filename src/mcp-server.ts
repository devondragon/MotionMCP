#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MotionApiService } from './services/motionApi';
import { WorkspaceResolver, formatMcpError, mcpLog, LOG_LEVELS } from './utils';
import { InputValidator } from './utils/validator';
import { HandlerContext } from './handlers/base/HandlerInterface';
import { HandlerFactory } from './handlers/HandlerFactory';
import { ToolRegistry, ToolConfigurator } from './tools';
import * as dotenv from 'dotenv';

dotenv.config({ quiet: true });

class MotionMCPServer {
  private server: Server;
  private toolRegistry: ToolRegistry | null;
  private toolConfigurator: ToolConfigurator | null;
  private handlerFactory: HandlerFactory | null;
  private context: HandlerContext | null;

  constructor() {
    this.server = new Server(
      {
        name: "motion-mcp-server",
        version: "2.0.0",
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      }
    );

    this.handlerFactory = null;
    this.context = null;
    this.toolRegistry = null;
    this.toolConfigurator = null;
    this.initializeTools();
    this.setupHandlers();
  }

  private initializeTools(): void {
    this.toolRegistry = new ToolRegistry();
    this.toolConfigurator = new ToolConfigurator(
      process.env.MOTION_MCP_TOOLS || 'essential',
      this.toolRegistry
    );
  }

  async initialize(): Promise<void> {
    try {
      // Create context with initialized services
      const motionService = new MotionApiService();
      const workspaceResolver = new WorkspaceResolver(motionService);
      const validator = new InputValidator();

      this.context = {
        motionService,
        workspaceResolver,
        validator
      };

      // Initialize validators with enabled tools
      validator.initializeValidators(this.toolConfigurator?.getEnabledTools() || []);

      // Create handler factory
      this.handlerFactory = new HandlerFactory(this.context);

      mcpLog(LOG_LEVELS.INFO, "Motion MCP Server initialized successfully", {
        toolsConfig: this.toolConfigurator?.getConfig(),
        enabledToolsCount: this.toolConfigurator?.getToolCount()
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      mcpLog(LOG_LEVELS.ERROR, "Failed to initialize Motion API service", { error: errorMessage });
      process.exit(1);
    }
  }

  setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.toolConfigurator?.getEnabledTools() || []
      };
    });

    // Handle unsupported MCP methods gracefully
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return { prompts: [] };
    });

    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return { resources: [] };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.handlerFactory || !this.context) {
        return formatMcpError(new Error("Server not initialized"));
      }

      try {
        const { name, arguments: args } = request.params;

        // Runtime validation
        const validation = this.context.validator.validateInput(name, args);
        if (!validation.valid) {
          return formatMcpError(
            new Error(`Invalid arguments for ${name}: ${validation.errors}`)
          );
        }

        // Create handler and delegate
        const handler = this.handlerFactory.createHandler(name);
        return await handler.handle(args);
      } catch (error: unknown) {
        return formatMcpError(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async run(): Promise<void> {
    await this.initialize();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    mcpLog(LOG_LEVELS.INFO, "Motion MCP Server running on stdio");
  }
}

// Main execution
if (require.main === module) {
  const server = new MotionMCPServer();
  server.run().catch((error) => {
    console.error("Failed to run server:", error);
    process.exit(1);
  });
}

export default MotionMCPServer;
