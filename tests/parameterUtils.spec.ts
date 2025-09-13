import { describe, it, expect } from 'vitest';
import { parseWorkspaceArgs, parseTaskArgs, validateRequiredParams, validateParameterTypes } from '../src/utils/parameterUtils';

describe('parameterUtils', () => {
  it('parseWorkspaceArgs trims workspaceName', () => {
    const res = parseWorkspaceArgs({ workspaceName: '  Dev  ' });
    expect(res.workspaceName).toBe('Dev');
    expect(res.workspaceId).toBeUndefined();
  });

  it('parseTaskArgs maps fields and trims strings', () => {
    const res = parseTaskArgs({ name: '  Task  ', description: '  desc  ', projectId: 'p1', priority: 'HIGH' });
    expect(res.name).toBe('Task');
    expect(res.description).toBe('desc');
    expect(res.projectId).toBe('p1');
    expect(res.priority).toBe('HIGH');
  });

  it('validateRequiredParams throws for missing', () => {
    expect(() => validateRequiredParams({ a: 1 }, ['a', 'b'])).toThrow(/Missing required parameters/);
  });

  it('validateParameterTypes throws for wrong types', () => {
    expect(() => validateParameterTypes({ lim: '10' }, { lim: 'number' })).toThrow(/Type validation failed/);
  });
});

