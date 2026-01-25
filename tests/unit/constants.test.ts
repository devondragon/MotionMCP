import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseFilterDate,
  isValidPriority,
  createMinimalPayload,
  convertUndefinedToNull,
  convertNullToUndefined,
  VALID_PRIORITIES
} from '../../src/utils/constants';

describe('parseFilterDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('relative dates', () => {
    it('returns current date for "today"', () => {
      expect(parseFilterDate('today')).toBe('2024-03-15');
    });

    it('handles "today" case-insensitively', () => {
      expect(parseFilterDate('TODAY')).toBe('2024-03-15');
      expect(parseFilterDate('Today')).toBe('2024-03-15');
    });

    it('returns tomorrow date for "tomorrow"', () => {
      expect(parseFilterDate('tomorrow')).toBe('2024-03-16');
    });

    it('handles "tomorrow" case-insensitively', () => {
      expect(parseFilterDate('TOMORROW')).toBe('2024-03-16');
    });

    it('returns yesterday date for "yesterday"', () => {
      expect(parseFilterDate('yesterday')).toBe('2024-03-14');
    });

    it('handles "yesterday" case-insensitively', () => {
      expect(parseFilterDate('YESTERDAY')).toBe('2024-03-14');
    });

    it('handles whitespace around relative dates', () => {
      expect(parseFilterDate('  today  ')).toBe('2024-03-15');
    });
  });

  describe('YYYY-MM-DD format', () => {
    it('returns valid date as-is', () => {
      expect(parseFilterDate('2024-06-15')).toBe('2024-06-15');
    });

    it('validates that date is parseable', () => {
      expect(parseFilterDate('2024-01-01')).toBe('2024-01-01');
      expect(parseFilterDate('2024-12-31')).toBe('2024-12-31');
    });

    it('returns null for invalid date format', () => {
      expect(parseFilterDate('2024/06/15')).toBeNull();
      expect(parseFilterDate('15-06-2024')).toBeNull();
      expect(parseFilterDate('June 15, 2024')).toBeNull();
    });

    it('returns null for incomplete date', () => {
      expect(parseFilterDate('2024-06')).toBeNull();
      expect(parseFilterDate('2024')).toBeNull();
    });

    it('handles date overflow behavior', () => {
      // JavaScript Date allows some overflow - Feb 30 rolls to Mar 1
      // parseFilterDate accepts YYYY-MM-DD format if it parses to valid Date
      // NOTE: This means Feb 30 is accepted (becomes Mar 1 internally)
      expect(parseFilterDate('2024-02-30')).toBe('2024-02-30');

      // Month 13 creates Invalid Date
      expect(parseFilterDate('2024-13-01')).toBeNull();

      // Day 32 creates Invalid Date (beyond month rollover)
      expect(parseFilterDate('2024-01-32')).toBeNull();
    });

    it('handles leap year dates', () => {
      // 2024 is a leap year - Feb 29 is valid
      expect(parseFilterDate('2024-02-29')).toBe('2024-02-29');

      // 2023 is not a leap year - Feb 29 rolls to Mar 1
      // But parseFilterDate only validates format, not date validity
      expect(parseFilterDate('2023-02-29')).toBe('2023-02-29');
    });
  });

  describe('invalid inputs', () => {
    it('returns null for empty string', () => {
      expect(parseFilterDate('')).toBeNull();
    });

    it('returns null for random text', () => {
      expect(parseFilterDate('next week')).toBeNull();
      expect(parseFilterDate('invalid')).toBeNull();
    });
  });
});

describe('isValidPriority', () => {
  it('returns true for valid priorities', () => {
    expect(isValidPriority('ASAP')).toBe(true);
    expect(isValidPriority('HIGH')).toBe(true);
    expect(isValidPriority('MEDIUM')).toBe(true);
    expect(isValidPriority('LOW')).toBe(true);
  });

  it('returns false for invalid priorities', () => {
    expect(isValidPriority('asap')).toBe(false); // Case-sensitive
    expect(isValidPriority('high')).toBe(false);
    expect(isValidPriority('URGENT')).toBe(false);
    expect(isValidPriority('')).toBe(false);
    expect(isValidPriority('invalid')).toBe(false);
  });

  it('validates all VALID_PRIORITIES', () => {
    for (const priority of VALID_PRIORITIES) {
      expect(isValidPriority(priority)).toBe(true);
    }
  });
});

describe('createMinimalPayload', () => {
  it('removes null values', () => {
    const result = createMinimalPayload({ name: 'test', value: null });
    expect(result).toEqual({ name: 'test' });
    expect('value' in result).toBe(false);
  });

  it('removes undefined values', () => {
    const result = createMinimalPayload({ name: 'test', value: undefined });
    expect(result).toEqual({ name: 'test' });
    expect('value' in result).toBe(false);
  });

  it('removes empty strings', () => {
    const result = createMinimalPayload({ name: 'test', description: '' });
    expect(result).toEqual({ name: 'test' });
    expect('description' in result).toBe(false);
  });

  it('removes empty arrays', () => {
    const result = createMinimalPayload({ name: 'test', labels: [] });
    expect(result).toEqual({ name: 'test' });
    expect('labels' in result).toBe(false);
  });

  it('removes empty objects', () => {
    const result = createMinimalPayload({ name: 'test', metadata: {} });
    expect(result).toEqual({ name: 'test' });
    expect('metadata' in result).toBe(false);
  });

  it('preserves non-empty arrays', () => {
    const result = createMinimalPayload({ name: 'test', labels: ['a', 'b'] });
    expect(result).toEqual({ name: 'test', labels: ['a', 'b'] });
  });

  it('preserves non-empty objects', () => {
    const result = createMinimalPayload({ name: 'test', metadata: { key: 'value' } });
    expect(result).toEqual({ name: 'test', metadata: { key: 'value' } });
  });

  it('preserves zero and false values', () => {
    const result = createMinimalPayload({ count: 0, flag: false, name: 'test' });
    expect(result).toEqual({ count: 0, flag: false, name: 'test' });
  });

  it('preserves strings with content', () => {
    const result = createMinimalPayload({ name: 'test', description: 'desc' });
    expect(result).toEqual({ name: 'test', description: 'desc' });
  });

  it('handles multiple empty values', () => {
    const result = createMinimalPayload({
      name: 'test',
      a: null,
      b: undefined,
      c: '',
      d: [],
      e: {}
    });
    expect(result).toEqual({ name: 'test' });
  });
});

describe('convertUndefinedToNull', () => {
  it('converts undefined values to null', () => {
    const result = convertUndefinedToNull({ a: undefined, b: 'test' });
    expect(result.a).toBeNull();
    expect(result.b).toBe('test');
  });

  it('preserves null values', () => {
    const result = convertUndefinedToNull({ a: null });
    expect(result.a).toBeNull();
  });

  it('preserves other values', () => {
    const result = convertUndefinedToNull({ a: 0, b: false, c: '' });
    expect(result).toEqual({ a: 0, b: false, c: '' });
  });

  it('does not modify original object', () => {
    const original = { a: undefined };
    convertUndefinedToNull(original);
    expect(original.a).toBeUndefined();
  });
});

describe('convertNullToUndefined', () => {
  it('removes null values (makes them undefined)', () => {
    const result = convertNullToUndefined({ a: null, b: 'test' });
    expect(result.a).toBeUndefined();
    expect('a' in result).toBe(false);
    expect(result.b).toBe('test');
  });

  it('preserves undefined as undefined', () => {
    const result = convertNullToUndefined({ a: undefined });
    expect(result.a).toBeUndefined();
  });

  it('preserves other values', () => {
    const result = convertNullToUndefined({ a: 0, b: false, c: '' });
    expect(result).toEqual({ a: 0, b: false, c: '' });
  });

  it('does not modify original object', () => {
    const original = { a: null };
    convertNullToUndefined(original);
    expect(original.a).toBeNull();
  });
});
