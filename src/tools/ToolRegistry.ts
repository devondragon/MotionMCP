import { McpToolDefinition } from '../types/mcp';
import { allToolDefinitions, TOOL_NAMES } from './ToolDefinitions';

/**
 * Registry for managing MCP tool definitions and configuration-based filtering.
 *
 * Provides centralized storage and retrieval of tool definitions, supporting
 * multiple tool exposure levels (minimal, essential, complete) and custom
 * tool selection. Tools are automatically registered from ToolDefinitions on construction.
 *
 * @example
 * const registry = new ToolRegistry();
 * const essentialTools = registry.getEnabled('essential');
 * const customTools = registry.getEnabled('custom:motion_tasks,motion_projects');
 */
export class ToolRegistry {
  /** Internal map storing tool definitions keyed by tool name */
  private tools: Map<string, McpToolDefinition>;

  /** Creates a new registry and auto-registers all available tool definitions */
  constructor() {
    this.tools = new Map();
    this.registerAllTools();
  }

  /** Registers all tools from the allToolDefinitions array */
  private registerAllTools(): void {
    allToolDefinitions.forEach(tool => {
      this.register(tool);
    });
  }

  /**
   * Registers a tool definition in the registry.
   * @param tool - The tool definition to register
   */
  register(tool: McpToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Removes a tool from the registry by name.
   * @param name - The name of the tool to remove
   */
  unregister(name: string): void {
    this.tools.delete(name);
  }

  /**
   * Retrieves a tool definition by name.
   * @param name - The tool name to look up
   * @returns The tool definition if found, undefined otherwise
   */
  get(name: string): McpToolDefinition | undefined {
    return this.tools.get(name);
  }

  /** Returns all registered tool definitions */
  getAll(): McpToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /** Returns the names of all registered tools */
  getAllNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Returns tools enabled for a given configuration.
   *
   * Supported configurations:
   * - 'minimal': Core tools only (tasks, projects, workspaces) - 3 tools
   * - 'essential': Core plus common features (users, search, comments, schedules) - 7 tools
   * - 'complete': All available tools - 10 tools
   * - 'custom:tool1,tool2,...': Specific tools by name
   *
   * @param config - Configuration string specifying which tools to enable
   * @returns Array of enabled tool definitions
   * @throws Error if config is not a recognized value
   */
  getEnabled(config: string): McpToolDefinition[] {
    const toolsMap = new Map(this.getAll().map(tool => [tool.name, tool]));

    switch(config) {
      case 'minimal':
        return [
          toolsMap.get(TOOL_NAMES.TASKS),
          toolsMap.get(TOOL_NAMES.PROJECTS),
          toolsMap.get(TOOL_NAMES.WORKSPACES)
        ].filter((tool): tool is McpToolDefinition => tool !== undefined);

      case 'essential':
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
        // Handle custom:tool1,tool2,... format
        if (config.startsWith('custom:')) {
          const customTools = config.substring(7).split(',').map(s => s.trim());
          return customTools
            .map(name => toolsMap.get(name))
            .filter((tool): tool is McpToolDefinition => tool !== undefined);
        }

        // Validated upstream by ToolConfigurator, but throw if unexpected value reaches here
        throw new Error(`Unexpected tools configuration: ${config}`);
    }
  }

  /**
   * Checks if a tool is registered.
   * @param name - The tool name to check
   * @returns True if the tool exists in the registry
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** Returns the number of registered tools */
  size(): number {
    return this.tools.size;
  }

  /** Removes all tools from the registry */
  clear(): void {
    this.tools.clear();
  }
}