import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../../src/tools/ToolRegistry';
import { ToolConfigurator } from '../../src/tools/ToolConfigurator';
import { TOOL_NAMES } from '../../src/tools/ToolDefinitions';

// Logger is already mocked in tests/setup.ts

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('initialization', () => {
    it('registers all tool definitions on construction', () => {
      expect(registry.size()).toBe(10);
    });

    it('has all expected tools', () => {
      expect(registry.has(TOOL_NAMES.TASKS)).toBe(true);
      expect(registry.has(TOOL_NAMES.PROJECTS)).toBe(true);
      expect(registry.has(TOOL_NAMES.WORKSPACES)).toBe(true);
      expect(registry.has(TOOL_NAMES.USERS)).toBe(true);
      expect(registry.has(TOOL_NAMES.SEARCH)).toBe(true);
      expect(registry.has(TOOL_NAMES.COMMENTS)).toBe(true);
      expect(registry.has(TOOL_NAMES.CUSTOM_FIELDS)).toBe(true);
      expect(registry.has(TOOL_NAMES.RECURRING_TASKS)).toBe(true);
      expect(registry.has(TOOL_NAMES.SCHEDULES)).toBe(true);
      expect(registry.has(TOOL_NAMES.STATUSES)).toBe(true);
    });
  });

  describe('get', () => {
    it('returns tool definition for valid name', () => {
      const tool = registry.get(TOOL_NAMES.TASKS);
      expect(tool).toBeDefined();
      expect(tool?.name).toBe(TOOL_NAMES.TASKS);
    });

    it('returns undefined for invalid name', () => {
      expect(registry.get('invalid_tool')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('returns all registered tools', () => {
      const tools = registry.getAll();
      expect(tools.length).toBe(10);
    });
  });

  describe('getAllNames', () => {
    it('returns all tool names', () => {
      const names = registry.getAllNames();
      expect(names.length).toBe(10);
      expect(names).toContain(TOOL_NAMES.TASKS);
      expect(names).toContain(TOOL_NAMES.PROJECTS);
    });
  });

  describe('getEnabled', () => {
    it('returns 3 tools for minimal config', () => {
      const tools = registry.getEnabled('minimal');
      expect(tools.length).toBe(3);
      expect(tools.map(t => t.name)).toContain(TOOL_NAMES.TASKS);
      expect(tools.map(t => t.name)).toContain(TOOL_NAMES.PROJECTS);
      expect(tools.map(t => t.name)).toContain(TOOL_NAMES.WORKSPACES);
    });

    it('returns 7 tools for essential config', () => {
      const tools = registry.getEnabled('essential');
      expect(tools.length).toBe(7);
      expect(tools.map(t => t.name)).toContain(TOOL_NAMES.TASKS);
      expect(tools.map(t => t.name)).toContain(TOOL_NAMES.PROJECTS);
      expect(tools.map(t => t.name)).toContain(TOOL_NAMES.WORKSPACES);
      expect(tools.map(t => t.name)).toContain(TOOL_NAMES.USERS);
      expect(tools.map(t => t.name)).toContain(TOOL_NAMES.SEARCH);
      expect(tools.map(t => t.name)).toContain(TOOL_NAMES.COMMENTS);
      expect(tools.map(t => t.name)).toContain(TOOL_NAMES.SCHEDULES);
    });

    it('returns 10 tools for complete config', () => {
      const tools = registry.getEnabled('complete');
      expect(tools.length).toBe(10);
    });

    it('returns specified tools for custom config', () => {
      const tools = registry.getEnabled(`custom:${TOOL_NAMES.TASKS},${TOOL_NAMES.SEARCH}`);
      expect(tools.length).toBe(2);
      expect(tools.map(t => t.name)).toContain(TOOL_NAMES.TASKS);
      expect(tools.map(t => t.name)).toContain(TOOL_NAMES.SEARCH);
    });

    it('filters out invalid tools in custom config', () => {
      const tools = registry.getEnabled(`custom:${TOOL_NAMES.TASKS},invalid_tool`);
      expect(tools.length).toBe(1);
      expect(tools[0].name).toBe(TOOL_NAMES.TASKS);
    });

    it('handles whitespace in custom config', () => {
      const tools = registry.getEnabled(`custom: ${TOOL_NAMES.TASKS} , ${TOOL_NAMES.PROJECTS} `);
      expect(tools.length).toBe(2);
    });

    it('throws error for unknown config', () => {
      expect(() => registry.getEnabled('unknown')).toThrow('Unexpected tools configuration');
    });
  });

  describe('register and unregister', () => {
    it('can register new tools', () => {
      const customTool = {
        name: 'custom_tool',
        description: 'A custom tool',
        inputSchema: { type: 'object' as const, properties: {} }
      };
      registry.register(customTool);
      expect(registry.has('custom_tool')).toBe(true);
    });

    it('can unregister tools', () => {
      registry.unregister(TOOL_NAMES.TASKS);
      expect(registry.has(TOOL_NAMES.TASKS)).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all tools', () => {
      registry.clear();
      expect(registry.size()).toBe(0);
    });
  });
});

describe('ToolConfigurator', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    vi.clearAllMocks();
  });

  describe('preset configurations', () => {
    it('validates minimal config', () => {
      const configurator = new ToolConfigurator('minimal', registry);
      expect(configurator.getConfig()).toBe('minimal');
      expect(configurator.isValidPreset()).toBe(true);
    });

    it('validates essential config', () => {
      const configurator = new ToolConfigurator('essential', registry);
      expect(configurator.getConfig()).toBe('essential');
      expect(configurator.isValidPreset()).toBe(true);
    });

    it('validates complete config', () => {
      const configurator = new ToolConfigurator('complete', registry);
      expect(configurator.getConfig()).toBe('complete');
      expect(configurator.isValidPreset()).toBe(true);
    });
  });

  describe('custom configuration', () => {
    it('accepts valid custom config', () => {
      const configurator = new ToolConfigurator(
        `custom:${TOOL_NAMES.TASKS},${TOOL_NAMES.PROJECTS}`,
        registry
      );
      expect(configurator.isCustomConfig()).toBe(true);
      expect(configurator.getToolCount()).toBe(2);
    });

    it('throws error for invalid tool names in custom config', () => {
      expect(() => new ToolConfigurator('custom:invalid_tool', registry))
        .toThrow('Invalid tool names in custom configuration: invalid_tool');
    });

    it('throws error for empty custom config', () => {
      expect(() => new ToolConfigurator('custom:', registry))
        .toThrow('Custom configuration must specify at least one tool');
    });

    it('parses custom config correctly', () => {
      const configurator = new ToolConfigurator(
        `custom:${TOOL_NAMES.TASKS},${TOOL_NAMES.SEARCH}`,
        registry
      );
      const parsed = configurator.parseCustomConfig(configurator.getConfig());
      expect(parsed).toEqual([TOOL_NAMES.TASKS, TOOL_NAMES.SEARCH]);
    });

    it('trims whitespace in custom config', () => {
      const configurator = new ToolConfigurator(
        `custom: ${TOOL_NAMES.TASKS} , ${TOOL_NAMES.PROJECTS} `,
        registry
      );
      expect(configurator.getToolCount()).toBe(2);
    });

    it('throws error for parseCustomConfig on non-custom config', () => {
      const configurator = new ToolConfigurator('essential', registry);
      expect(() => configurator.parseCustomConfig('essential'))
        .toThrow('Invalid custom configuration format');
    });
  });

  describe('invalid configuration handling', () => {
    it('defaults to essential for invalid config', () => {
      const configurator = new ToolConfigurator('invalid', registry);
      expect(configurator.getConfig()).toBe('essential');
    });
  });

  describe('tool information', () => {
    it('returns correct tool count for minimal', () => {
      const configurator = new ToolConfigurator('minimal', registry);
      expect(configurator.getToolCount()).toBe(3);
    });

    it('returns correct tool count for essential', () => {
      const configurator = new ToolConfigurator('essential', registry);
      expect(configurator.getToolCount()).toBe(7);
    });

    it('returns correct tool count for complete', () => {
      const configurator = new ToolConfigurator('complete', registry);
      expect(configurator.getToolCount()).toBe(10);
    });

    it('returns tool names', () => {
      const configurator = new ToolConfigurator('minimal', registry);
      const names = configurator.getToolNames();
      expect(names.length).toBe(3);
      expect(names).toContain(TOOL_NAMES.TASKS);
    });
  });

  describe('getEnabledTools', () => {
    it('returns tools from registry based on config', () => {
      const configurator = new ToolConfigurator('minimal', registry);
      const tools = configurator.getEnabledTools();
      expect(tools.length).toBe(3);
    });
  });

  describe('setConfig', () => {
    it('allows changing config', () => {
      const configurator = new ToolConfigurator('minimal', registry);
      expect(configurator.getToolCount()).toBe(3);

      configurator.setConfig('complete');
      expect(configurator.getConfig()).toBe('complete');
      expect(configurator.getToolCount()).toBe(10);
    });
  });

  describe('static methods', () => {
    it('returns valid configurations list', () => {
      const configs = ToolConfigurator.getValidConfigurations();
      expect(configs).toEqual(['minimal', 'essential', 'complete']);
    });

    it('returns configuration descriptions', () => {
      expect(ToolConfigurator.getConfigurationDescription('minimal'))
        .toContain('3 tools');
      expect(ToolConfigurator.getConfigurationDescription('essential'))
        .toContain('7 tools');
      expect(ToolConfigurator.getConfigurationDescription('complete'))
        .toContain('10 tools');
    });

    it('returns description for custom config', () => {
      const desc = ToolConfigurator.getConfigurationDescription('custom:motion_tasks,motion_projects');
      expect(desc).toContain('Custom configuration');
      expect(desc).toContain('motion_tasks,motion_projects');
    });

    it('returns unknown for invalid config', () => {
      expect(ToolConfigurator.getConfigurationDescription('invalid'))
        .toBe('Unknown configuration');
    });
  });
});
