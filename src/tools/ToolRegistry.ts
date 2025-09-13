import { McpToolDefinition } from '../types/mcp';
import { allToolDefinitions, TOOL_NAMES } from './ToolDefinitions';

export class ToolRegistry {
  private tools: Map<string, McpToolDefinition>;

  constructor() {
    this.tools = new Map();
    this.registerAllTools();
  }

  private registerAllTools(): void {
    allToolDefinitions.forEach(tool => {
      this.register(tool);
    });
  }

  register(tool: McpToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): McpToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): McpToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getAllNames(): string[] {
    return Array.from(this.tools.keys());
  }

  getEnabled(config: string): McpToolDefinition[] {
    const toolsMap = new Map(this.getAll().map(tool => [tool.name, tool]));

    switch(config) {
      case 'minimal':
        // Only core consolidated tools
        return [
          toolsMap.get(TOOL_NAMES.TASKS),
          toolsMap.get(TOOL_NAMES.PROJECTS),
          toolsMap.get(TOOL_NAMES.WORKSPACES)
        ].filter((tool): tool is McpToolDefinition => tool !== undefined);

      case 'essential':
        // Consolidated tools plus commonly needed tools
        return [
          toolsMap.get(TOOL_NAMES.TASKS),
          toolsMap.get(TOOL_NAMES.PROJECTS),
          toolsMap.get(TOOL_NAMES.WORKSPACES),
          toolsMap.get(TOOL_NAMES.USERS),
          toolsMap.get(TOOL_NAMES.SEARCH),
          toolsMap.get(TOOL_NAMES.COMMENTS),
          toolsMap.get(TOOL_NAMES.SCHEDULES)
        ].filter((tool): tool is McpToolDefinition => tool !== undefined);

      case 'complete':
        // All consolidated tools
        return [
          toolsMap.get(TOOL_NAMES.TASKS),
          toolsMap.get(TOOL_NAMES.PROJECTS),
          toolsMap.get(TOOL_NAMES.WORKSPACES),
          toolsMap.get(TOOL_NAMES.USERS),
          toolsMap.get(TOOL_NAMES.SEARCH),
          toolsMap.get(TOOL_NAMES.COMMENTS),
          toolsMap.get(TOOL_NAMES.CUSTOM_FIELDS),
          toolsMap.get(TOOL_NAMES.RECURRING_TASKS),
          toolsMap.get(TOOL_NAMES.SCHEDULES),
          toolsMap.get(TOOL_NAMES.STATUSES)
        ].filter((tool): tool is McpToolDefinition => tool !== undefined);

      default:
        // Handle custom configuration
        if (config.startsWith('custom:')) {
          const customTools = config.substring(7).split(',').map(s => s.trim());
          return customTools
            .map(name => toolsMap.get(name))
            .filter((tool): tool is McpToolDefinition => tool !== undefined);
        }

        // This should never happen since we validate in configurator
        // But if it does, throw an error instead of silently defaulting
        throw new Error(`Unexpected tools configuration: ${config}`);
    }
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  size(): number {
    return this.tools.size;
  }

  clear(): void {
    this.tools.clear();
  }
}