import { McpToolDefinition } from '../types/mcp';
import { ToolRegistry } from './ToolRegistry';
import { mcpLog, LOG_LEVELS } from '../utils';

export class ToolConfigurator {
  private config: string;
  private registry: ToolRegistry;

  constructor(config: string, registry: ToolRegistry) {
    this.config = config;
    this.registry = registry;
    this.validateConfig();
  }

  private validateConfig(): void {
    const validConfigs = ['minimal', 'essential', 'complete'];

    // Check if it's a valid preset or custom configuration
    if (!validConfigs.includes(this.config) && !this.config.startsWith('custom:')) {
      mcpLog(LOG_LEVELS.ERROR, `Invalid MOTION_MCP_TOOLS configuration: "${this.config}"`, {
        validOptions: [...validConfigs, 'custom:tool1,tool2,...'],
        defaulting: 'complete'
      });

      // Still default to complete, but log it prominently
      mcpLog(LOG_LEVELS.WARN, 'Defaulting to "complete" configuration');
      this.config = 'complete';
    }

    // For custom configurations, validate tool names exist
    if (this.config.startsWith('custom:')) {
      const customTools = this.parseCustomConfig(this.config);
      const allToolNames = this.registry.getAllNames();
      const invalidTools = customTools.filter(name => !allToolNames.includes(name));

      if (invalidTools.length > 0) {
        mcpLog(LOG_LEVELS.ERROR, 'Invalid tool names in custom configuration', {
          invalidTools,
          availableTools: allToolNames
        });
        throw new Error(`Invalid tool names in custom configuration: ${invalidTools.join(', ')}`);
      }

      if (customTools.length === 0) {
        throw new Error('Custom configuration must specify at least one tool');
      }
    }

    mcpLog(LOG_LEVELS.INFO, `Tool configuration validated: ${this.config}`);
  }

  getEnabledTools(): McpToolDefinition[] {
    return this.registry.getEnabled(this.config);
  }

  private parseCustomConfig(config: string): string[] {
    if (!config.startsWith('custom:')) {
      throw new Error('Invalid custom configuration format. Must start with "custom:"');
    }

    return config.substring(7).split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  getConfig(): string {
    return this.config;
  }

  getToolCount(): number {
    return this.getEnabledTools().length;
  }
}
