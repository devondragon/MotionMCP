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
      expect(registry.getAll().length).toBe(10);
    });

    it('has all expected tools', () => {
      const names = registry.getAllNames();
      expect(names).toContain(TOOL_NAMES.TASKS);
      expect(names).toContain(TOOL_NAMES.PROJECTS);
      expect(names).toContain(TOOL_NAMES.WORKSPACES);
      expect(names).toContain(TOOL_NAMES.USERS);
      expect(names).toContain(TOOL_NAMES.SEARCH);
      expect(names).toContain(TOOL_NAMES.COMMENTS);
      expect(names).toContain(TOOL_NAMES.CUSTOM_FIELDS);
      expect(names).toContain(TOOL_NAMES.RECURRING_TASKS);
      expect(names).toContain(TOOL_NAMES.SCHEDULES);
      expect(names).toContain(TOOL_NAMES.STATUSES);
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
    });

    it('validates essential config', () => {
      const configurator = new ToolConfigurator('essential', registry);
      expect(configurator.getConfig()).toBe('essential');
    });

    it('validates complete config', () => {
      const configurator = new ToolConfigurator('complete', registry);
      expect(configurator.getConfig()).toBe('complete');
    });
  });

  describe('custom configuration', () => {
    it('accepts valid custom config', () => {
      const configurator = new ToolConfigurator(
        `custom:${TOOL_NAMES.TASKS},${TOOL_NAMES.PROJECTS}`,
        registry
      );
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

    it('trims whitespace in custom config', () => {
      const configurator = new ToolConfigurator(
        `custom: ${TOOL_NAMES.TASKS} , ${TOOL_NAMES.PROJECTS} `,
        registry
      );
      expect(configurator.getToolCount()).toBe(2);
    });

    it('handles path traversal attempts in custom config', () => {
      // Path traversal should be treated as invalid tool name
      expect(() => new ToolConfigurator('custom:../../etc/passwd', registry))
        .toThrow('Invalid tool names in custom configuration');
    });

    it('handles malicious tool names in custom config', () => {
      expect(() => new ToolConfigurator('custom:__proto__,constructor', registry))
        .toThrow('Invalid tool names in custom configuration');
    });
  });

  describe('invalid configuration handling', () => {
    it('defaults to complete for invalid config', () => {
      const configurator = new ToolConfigurator('invalid', registry);
      expect(configurator.getConfig()).toBe('complete');
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
  });

  describe('getEnabledTools', () => {
    it('returns tools from registry based on config', () => {
      const configurator = new ToolConfigurator('minimal', registry);
      const tools = configurator.getEnabledTools();
      expect(tools.length).toBe(3);
    });
  });
});
