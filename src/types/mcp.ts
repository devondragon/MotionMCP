export interface McpToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface McpLogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  msg: string;
  time: string;
  [key: string]: any;
}

export interface McpRequest {
  method: string;
  params?: any;
}

export interface McpToolHandler {
  (args: any): Promise<McpToolResponse>;
}

export interface McpToolRegistry {
  [toolName: string]: {
    definition: McpToolDefinition;
    handler: McpToolHandler;
  };
}