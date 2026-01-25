import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeDueDateForApi,
  parseTaskArgs,
  validateRequiredParams,
  sanitizeStringParams,
  parseWorkspaceArgs,
  parseSearchArgs,
  parseProjectArgs,
  setDefaults,
  validateParameterTypes,
  parseAndValidateWorkspace
} from '../../src/utils/parameterUtils';

describe('normalizeDueDateForApi', () => {
  beforeEach(() => {
    // Mock Date to ensure consistent test results
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('null/undefined/empty handling', () => {
    it('returns undefined for null', () => {
      expect(normalizeDueDateForApi(null)).toBeUndefined();
    });

    it('returns undefined for undefined', () => {
      expect(normalizeDueDateForApi(undefined)).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(normalizeDueDateForApi('')).toBeUndefined();
    });

    it('returns undefined for whitespace-only string', () => {
      expect(normalizeDueDateForApi('   ')).toBeUndefined();
    });
  });

  describe('relative dates', () => {
    it('converts "today" to end-of-day UTC', () => {
      expect(normalizeDueDateForApi('today')).toBe('2024-03-15T23:59:59.000Z');
    });

    it('converts "today" case-insensitively', () => {
      expect(normalizeDueDateForApi('TODAY')).toBe('2024-03-15T23:59:59.000Z');
      expect(normalizeDueDateForApi('Today')).toBe('2024-03-15T23:59:59.000Z');
    });

    it('converts "tomorrow" to end-of-day UTC', () => {
      expect(normalizeDueDateForApi('tomorrow')).toBe('2024-03-16T23:59:59.000Z');
    });

    it('converts "yesterday" to end-of-day UTC', () => {
      expect(normalizeDueDateForApi('yesterday')).toBe('2024-03-14T23:59:59.000Z');
    });

    it('handles relative dates with whitespace', () => {
      expect(normalizeDueDateForApi('  today  ')).toBe('2024-03-15T23:59:59.000Z');
    });
  });

  describe('YYYY-MM-DD format', () => {
    it('converts YYYY-MM-DD to end-of-day UTC', () => {
      expect(normalizeDueDateForApi('2024-06-15')).toBe('2024-06-15T23:59:59.000Z');
    });

    it('handles first day of month', () => {
      expect(normalizeDueDateForApi('2024-01-01')).toBe('2024-01-01T23:59:59.000Z');
    });

    it('handles last day of month', () => {
      expect(normalizeDueDateForApi('2024-12-31')).toBe('2024-12-31T23:59:59.000Z');
    });
  });

  describe('ISO with timezone', () => {
    it('preserves ISO string with Z suffix', () => {
      expect(normalizeDueDateForApi('2024-06-15T10:30:00Z')).toBe('2024-06-15T10:30:00Z');
    });

    it('preserves ISO string with positive offset', () => {
      expect(normalizeDueDateForApi('2024-06-15T10:30:00+05:00')).toBe('2024-06-15T10:30:00+05:00');
    });

    it('preserves ISO string with negative offset', () => {
      expect(normalizeDueDateForApi('2024-06-15T10:30:00-08:00')).toBe('2024-06-15T10:30:00-08:00');
    });

    it('handles lowercase z', () => {
      expect(normalizeDueDateForApi('2024-06-15T10:30:00z')).toBe('2024-06-15T10:30:00z');
    });
  });

  describe('ISO without timezone (datetime without offset)', () => {
    it('converts datetime without timezone to end-of-day UTC', () => {
      expect(normalizeDueDateForApi('2024-06-15T10:30:00')).toBe('2024-06-15T23:59:59.000Z');
    });

    it('handles datetime with seconds', () => {
      expect(normalizeDueDateForApi('2024-06-15T10:30:45')).toBe('2024-06-15T23:59:59.000Z');
    });

    it('handles datetime with milliseconds', () => {
      expect(normalizeDueDateForApi('2024-06-15T10:30:45.123')).toBe('2024-06-15T23:59:59.000Z');
    });

    it('handles datetime without seconds', () => {
      expect(normalizeDueDateForApi('2024-06-15T10:30')).toBe('2024-06-15T23:59:59.000Z');
    });
  });

  describe('unparseable/passthrough', () => {
    it('passes through unrecognized formats', () => {
      expect(normalizeDueDateForApi('next week')).toBe('next week');
    });

    it('passes through invalid date format', () => {
      expect(normalizeDueDateForApi('2024/06/15')).toBe('2024/06/15');
    });
  });
});

describe('parseTaskArgs', () => {
  describe('autoScheduled parameter parsing', () => {
    it('returns undefined when autoScheduled is undefined', () => {
      const result = parseTaskArgs({});
      expect(result.autoScheduled).toBeUndefined();
    });

    it('returns null when autoScheduled is null', () => {
      const result = parseTaskArgs({ autoScheduled: null });
      expect(result.autoScheduled).toBeNull();
    });

    it('returns null when autoScheduled is false', () => {
      const result = parseTaskArgs({ autoScheduled: false });
      expect(result.autoScheduled).toBeNull();
    });

    it('returns null when autoScheduled is string "false"', () => {
      const result = parseTaskArgs({ autoScheduled: 'false' });
      expect(result.autoScheduled).toBeNull();
    });

    it('returns empty object when autoScheduled is true', () => {
      const result = parseTaskArgs({ autoScheduled: true });
      expect(result.autoScheduled).toEqual({});
    });

    it('returns empty object when autoScheduled is string "true"', () => {
      const result = parseTaskArgs({ autoScheduled: 'true' });
      expect(result.autoScheduled).toEqual({});
    });

    it('returns schedule object when autoScheduled is a schedule name string', () => {
      const result = parseTaskArgs({ autoScheduled: 'Work Hours' });
      expect(result.autoScheduled).toEqual({ schedule: 'Work Hours' });
    });

    it('returns schedule object for trimmed schedule name', () => {
      const result = parseTaskArgs({ autoScheduled: '  My Schedule  ' });
      expect(result.autoScheduled).toEqual({ schedule: 'My Schedule' });
    });

    it('preserves autoScheduled object as-is', () => {
      const result = parseTaskArgs({
        autoScheduled: { schedule: 'Work Hours', deadlineType: 'SOFT' }
      });
      expect(result.autoScheduled).toEqual({ schedule: 'Work Hours', deadlineType: 'SOFT' });
    });

    it('returns undefined for unrecognized values', () => {
      const result = parseTaskArgs({ autoScheduled: 123 });
      expect(result.autoScheduled).toBeUndefined();
    });

    it('returns undefined for numeric 0', () => {
      const result = parseTaskArgs({ autoScheduled: 0 });
      expect(result.autoScheduled).toBeUndefined();
    });

    it('returns undefined for numeric 1', () => {
      const result = parseTaskArgs({ autoScheduled: 1 });
      expect(result.autoScheduled).toBeUndefined();
    });

    it('returns undefined for negative numbers', () => {
      const result = parseTaskArgs({ autoScheduled: -1 });
      expect(result.autoScheduled).toBeUndefined();
    });
  });

  describe('other parameters', () => {
    it('parses name with sanitization', () => {
      const result = parseTaskArgs({ name: '  My Task  ' });
      expect(result.name).toBe('My Task');
    });

    it('parses priority', () => {
      const result = parseTaskArgs({ priority: 'HIGH' });
      expect(result.priority).toBe('HIGH');
    });

    it('parses labels array', () => {
      const result = parseTaskArgs({ labels: ['label1', 'label2'] });
      expect(result.labels).toEqual(['label1', 'label2']);
    });

    it('returns undefined for non-array labels', () => {
      const result = parseTaskArgs({ labels: 'not-an-array' });
      expect(result.labels).toBeUndefined();
    });

    it('parses duration', () => {
      const result = parseTaskArgs({ duration: 30 });
      expect(result.duration).toBe(30);
    });
  });
});

describe('validateRequiredParams', () => {
  it('does not throw when all required params present', () => {
    expect(() => validateRequiredParams({ name: 'test', id: '123' }, ['name', 'id']))
      .not.toThrow();
  });

  it('throws ValidationError when required param is missing', () => {
    expect(() => validateRequiredParams({ name: 'test' }, ['name', 'id']))
      .toThrow('Missing required parameters: id');
  });

  it('throws ValidationError when required param is null', () => {
    expect(() => validateRequiredParams({ name: null }, ['name']))
      .toThrow('Missing required parameters: name');
  });

  it('throws ValidationError when required param is empty string', () => {
    expect(() => validateRequiredParams({ name: '' }, ['name']))
      .toThrow('Missing required parameters: name');
  });

  it('lists all missing params in error message', () => {
    expect(() => validateRequiredParams({}, ['name', 'id', 'type']))
      .toThrow('Missing required parameters: name, id, type');
  });

  it('does not throw for empty required list', () => {
    expect(() => validateRequiredParams({}, [])).not.toThrow();
  });

  it('does not throw for undefined args with empty required', () => {
    expect(() => validateRequiredParams(undefined as any, [])).not.toThrow();
  });
});

describe('sanitizeStringParams', () => {
  it('trims whitespace from string parameters', () => {
    const result = sanitizeStringParams({ name: '  hello  ', id: '123' }, ['name']);
    expect(result.name).toBe('hello');
    expect(result.id).toBe('123');
  });

  it('removes empty strings (makes them undefined)', () => {
    const result = sanitizeStringParams({ name: '', id: '123' }, ['name']);
    expect(result.name).toBeUndefined();
    expect(result.id).toBe('123');
  });

  it('removes whitespace-only strings (makes them undefined)', () => {
    const result = sanitizeStringParams({ name: '   ', id: '123' }, ['name']);
    expect(result.name).toBeUndefined();
  });

  it('does not modify non-string parameters', () => {
    const result = sanitizeStringParams({ count: 5, flag: true }, ['count', 'flag'] as any);
    expect(result.count).toBe(5);
    expect(result.flag).toBe(true);
  });

  it('only sanitizes listed parameters', () => {
    const result = sanitizeStringParams({ name: '  a  ', desc: '  b  ' }, ['name']);
    expect(result.name).toBe('a');
    expect(result.desc).toBe('  b  ');
  });

  it('handles empty args', () => {
    const result = sanitizeStringParams({}, ['name']);
    expect(result).toEqual({});
  });
});

describe('parseWorkspaceArgs', () => {
  it('returns undefined for missing workspaceId', () => {
    const result = parseWorkspaceArgs({});
    expect(result.workspaceId).toBeUndefined();
  });

  it('returns workspaceId when provided', () => {
    const result = parseWorkspaceArgs({ workspaceId: 'ws-123' });
    expect(result.workspaceId).toBe('ws-123');
  });

  it('sanitizes workspaceName', () => {
    const result = parseWorkspaceArgs({ workspaceName: '  My Workspace  ' });
    expect(result.workspaceName).toBe('My Workspace');
  });
});

describe('parseSearchArgs', () => {
  it('sets default search scope to "both"', () => {
    const result = parseSearchArgs({});
    expect(result.searchScope).toBe('both');
  });

  it('sets default limit to 40', () => {
    const result = parseSearchArgs({});
    expect(result.limit).toBe(40);
  });

  it('parses custom values', () => {
    const result = parseSearchArgs({ searchScope: 'tasks', limit: 20, query: 'test' });
    expect(result.searchScope).toBe('tasks');
    expect(result.limit).toBe(20);
    expect(result.query).toBe('test');
  });
});

describe('parseProjectArgs', () => {
  it('sanitizes name', () => {
    const result = parseProjectArgs({ name: '  Project  ' });
    expect(result.name).toBe('Project');
  });

  it('parses color', () => {
    const result = parseProjectArgs({ color: '#ff0000' });
    expect(result.color).toBe('#ff0000');
  });
});

describe('setDefaults', () => {
  it('merges defaults with args', () => {
    const result = setDefaults({ name: 'test' }, { priority: 'MEDIUM' });
    expect(result).toEqual({ name: 'test', priority: 'MEDIUM' });
  });

  it('args override defaults', () => {
    const result = setDefaults({ priority: 'HIGH' }, { priority: 'MEDIUM' });
    expect(result.priority).toBe('HIGH');
  });

  it('handles empty args', () => {
    const result = setDefaults({}, { name: 'default' });
    expect(result.name).toBe('default');
  });
});

describe('validateParameterTypes', () => {
  it('does not throw when types match', () => {
    expect(() => validateParameterTypes(
      { name: 'test', count: 5 },
      { name: 'string', count: 'number' }
    )).not.toThrow();
  });

  it('throws when type does not match', () => {
    expect(() => validateParameterTypes(
      { name: 123 },
      { name: 'string' }
    )).toThrow('Type validation failed: name should be string, got number');
  });

  it('ignores null/undefined values', () => {
    expect(() => validateParameterTypes(
      { name: null, count: undefined },
      { name: 'string', count: 'number' }
    )).not.toThrow();
  });

  it('reports multiple type errors', () => {
    expect(() => validateParameterTypes(
      { name: 123, count: 'five' },
      { name: 'string', count: 'number' }
    )).toThrow(/name should be string.*count should be number/);
  });
});

describe('parseAndValidateWorkspace', () => {
  it('does not throw when workspace not required', () => {
    expect(() => parseAndValidateWorkspace({}, { requireWorkspace: false })).not.toThrow();
  });

  it('throws when workspace required but not provided', () => {
    expect(() => parseAndValidateWorkspace({}, { requireWorkspace: true }))
      .toThrow('Either workspaceId or workspaceName is required');
  });

  it('does not throw when workspaceId provided and required', () => {
    expect(() => parseAndValidateWorkspace(
      { workspaceId: 'ws-123' },
      { requireWorkspace: true }
    )).not.toThrow();
  });

  it('does not throw when workspaceName provided and required', () => {
    expect(() => parseAndValidateWorkspace(
      { workspaceName: 'My Workspace' },
      { requireWorkspace: true }
    )).not.toThrow();
  });
});
