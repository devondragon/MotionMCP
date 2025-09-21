import { describe, it, expect } from 'vitest';
import {
  parseWorkspaceArgs,
  parseTaskArgs,
  validateRequiredParams,
  validateParameterTypes,
  normalizeDueDateForApi
} from '../src/utils/parameterUtils';

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

  it('normalizeDueDateForApi converts date-only strings to end-of-day UTC', () => {
    expect(normalizeDueDateForApi('2024-05-10')).toBe('2024-05-10T23:59:59.000Z');
  });

  it('normalizeDueDateForApi keeps timestamps with timezone offsets intact', () => {
    expect(normalizeDueDateForApi('2024-05-10T12:30:00-04:00')).toBe('2024-05-10T12:30:00-04:00');
  });

  it('normalizeDueDateForApi expands relative dates', () => {
    const result = normalizeDueDateForApi('today');
    expect(result).toMatch(/T23:59:59\.000Z$/);
  });
});
