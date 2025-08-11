import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type McpToolResponse = CallToolResult;

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface McpLogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  msg: string;
  time: string;
  [key: string]: unknown;
}

export interface McpRequest {
  method: string;
  params?: Record<string, unknown>;
}

export interface McpToolHandler {
  (args: unknown): Promise<McpToolResponse>;
}

export interface McpToolRegistry {
  [toolName: string]: {
    definition: McpToolDefinition;
    handler: McpToolHandler;
  };
}