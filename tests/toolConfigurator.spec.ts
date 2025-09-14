import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToolConfigurator } from '../src/tools/ToolConfigurator';
import { ToolRegistry } from '../src/tools/ToolRegistry';
import { TOOL_NAMES } from '../src/tools/ToolDefinitions';

describe('ToolConfigurator', () => {
  let registry: ToolRegistry;
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    registry = new ToolRegistry();
    spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('minimal preset exposes core tools', () => {
    const cfg = new ToolConfigurator('minimal', registry);
    const names = cfg.getToolNames();
    expect(names).toContain(TOOL_NAMES.TASKS);
    expect(names).toContain(TOOL_NAMES.PROJECTS);
    expect(names).toContain(TOOL_NAMES.WORKSPACES);
    expect(names.length).toBe(3);
  });

  it('essential preset exposes expected 7 tools', () => {
    const cfg = new ToolConfigurator('essential', registry);
    const names = cfg.getToolNames();
    expect(names).toEqual(expect.arrayContaining([
      TOOL_NAMES.TASKS,
      TOOL_NAMES.PROJECTS,
      TOOL_NAMES.WORKSPACES,
      TOOL_NAMES.USERS,
      TOOL_NAMES.SEARCH,
      TOOL_NAMES.COMMENTS,
      TOOL_NAMES.SCHEDULES,
    ]));
    expect(names.length).toBe(7);
  });

  it('complete preset exposes expected 10 tools', () => {
    const cfg = new ToolConfigurator('complete', registry);
    const names = cfg.getToolNames();
    expect(names).toEqual(expect.arrayContaining([
      TOOL_NAMES.TASKS,
      TOOL_NAMES.PROJECTS,
      TOOL_NAMES.WORKSPACES,
      TOOL_NAMES.USERS,
      TOOL_NAMES.SEARCH,
      TOOL_NAMES.COMMENTS,
      TOOL_NAMES.CUSTOM_FIELDS,
      TOOL_NAMES.RECURRING_TASKS,
      TOOL_NAMES.SCHEDULES,
      TOOL_NAMES.STATUSES,
    ]));
    expect(names.length).toBe(10);
  });

  it('invalid preset defaults to essential', () => {
    const cfg = new ToolConfigurator('bogus' as any, registry);
    expect(cfg.getConfig()).toBe('essential');
  });

  it('custom preset validates tool names', () => {
    const good = new ToolConfigurator('custom:motion_tasks,motion_projects', registry);
    expect(good.getToolNames()).toEqual(expect.arrayContaining([
      TOOL_NAMES.TASKS,
      TOOL_NAMES.PROJECTS,
    ]));

    expect(() => new ToolConfigurator('custom:nonexistent_tool', registry)).toThrow();
  });
});

