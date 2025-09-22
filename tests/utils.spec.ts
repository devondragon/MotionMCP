import { describe, it, expect } from 'vitest';

import { createMinimalPayload } from '../src/utils/constants';
import { sanitizeTextContent } from '../src/utils/sanitize';
import { transformFrequencyToApiString, validateFrequencyObject, isValidFrequencyObject } from '../src/utils/frequencyTransform';

describe('utils', () => {
  it('createMinimalPayload removes null/empty values and preserves meaningful ones', () => {
    const input = {
      a: null,
      b: undefined as unknown as string,
      c: '',
      d: [],
      e: {},
      f: 0,
      g: false,
      h: 'text',
      i: [1],
      j: { k: 1 },
    } as Record<string, any>;

    const result = createMinimalPayload(input);

    expect(result).toEqual({
      f: 0,
      g: false,
      h: 'text',
      i: [1],
      j: { k: 1 },
    });
  });

  it('sanitizeTextContent strips scripts and HTML while preserving text', () => {
    const input = 'Hello <script>alert(1)</script><b>World</b> & more';
    const sanitized = sanitizeTextContent(input);
    expect(sanitized).toContain('Hello');
    expect(sanitized).toContain('World');
    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('<b>');
    // Ensure ampersand is preserved without HTML encoding
    expect(sanitized).toContain('& more');
  });

  describe('frequencyTransform', () => {
    describe('transformFrequencyToApiString', () => {
      // Basic frequency types (backward compatible)
      it('transforms basic frequency types to correct API patterns', () => {
        expect(transformFrequencyToApiString({ type: 'daily' })).toBe('daily_every_day');
        expect(transformFrequencyToApiString({ type: 'weekly' })).toBe('weekly_any_day');
        expect(transformFrequencyToApiString({ type: 'monthly' })).toBe('monthly_1');
        expect(transformFrequencyToApiString({ type: 'yearly' })).toBe('yearly');
      });

      // Daily patterns
      it('transforms daily patterns correctly', () => {
        expect(transformFrequencyToApiString({ type: 'daily', daysOfWeek: [1, 2, 3, 4, 5] })).toBe('daily_every_week_day');
        expect(transformFrequencyToApiString({ type: 'daily', daysOfWeek: [1, 2, 3] })).toBe('daily_specific_days_[MO, TU, WE]');
        expect(transformFrequencyToApiString({ type: 'daily', daysOfWeek: [0, 6] })).toBe('daily_specific_days_[SU, SA]');
      });

      // Weekly patterns
      it('transforms weekly patterns correctly', () => {
        expect(transformFrequencyToApiString({ type: 'weekly', daysOfWeek: [1, 2, 3, 4, 5] })).toBe('weekly_any_week_day');
        expect(transformFrequencyToApiString({ type: 'weekly', daysOfWeek: [1, 3, 5] })).toBe('weekly_specific_days_[MO, WE, FR]');
        expect(transformFrequencyToApiString({ type: 'weekly', daysOfWeek: [0] })).toBe('weekly_specific_days_[SU]');
      });

      // Biweekly patterns
      it('transforms biweekly patterns correctly', () => {
        expect(transformFrequencyToApiString({ type: 'biweekly' })).toBe('biweekly_first_week_any_day');
        expect(transformFrequencyToApiString({ type: 'biweekly', daysOfWeek: [1, 2, 3, 4, 5] })).toBe('biweekly_first_week_any_week_day');
        expect(transformFrequencyToApiString({ type: 'biweekly', daysOfWeek: [1, 3] })).toBe('biweekly_first_week_specific_days_[MO, WE]');

        // Test weekOfMonth support for biweekly
        expect(transformFrequencyToApiString({ type: 'biweekly', weekOfMonth: 'second' })).toBe('biweekly_second_week_any_day');
        expect(transformFrequencyToApiString({ type: 'biweekly', weekOfMonth: 'second', daysOfWeek: [1, 3] })).toBe('biweekly_second_week_specific_days_[MO, WE]');
        expect(transformFrequencyToApiString({ type: 'biweekly', weekOfMonth: 'first' })).toBe('biweekly_first_week_any_day');
      });

      // Monthly patterns
      it('transforms monthly patterns correctly', () => {
        expect(transformFrequencyToApiString({ type: 'monthly', dayOfMonth: 15 })).toBe('monthly_15');
        expect(transformFrequencyToApiString({ type: 'monthly', dayOfMonth: 31 })).toBe('monthly_31');
        expect(transformFrequencyToApiString({ type: 'monthly', daysOfWeek: [1], weekOfMonth: 'first' })).toBe('monthly_first_MO');
        expect(transformFrequencyToApiString({ type: 'monthly', daysOfWeek: [5], weekOfMonth: 'last' })).toBe('monthly_last_FR');
        expect(transformFrequencyToApiString({ type: 'monthly', daysOfWeek: [1, 2, 3, 4, 5], weekOfMonth: 'second' })).toBe('monthly_any_week_day_second_week');
        expect(transformFrequencyToApiString({ type: 'monthly', weekOfMonth: 'last' })).toBe('monthly_any_day_last_week');
        expect(transformFrequencyToApiString({ type: 'monthly', daysOfWeek: [1, 2, 3, 4, 5] })).toBe('monthly_any_week_day_of_month');

        // Test weekOfMonth without daysOfWeek (the bug that was fixed)
        expect(transformFrequencyToApiString({ type: 'monthly', weekOfMonth: 'first' })).toBe('monthly_any_day_first_week');
        expect(transformFrequencyToApiString({ type: 'monthly', weekOfMonth: 'second' })).toBe('monthly_any_day_second_week');
        expect(transformFrequencyToApiString({ type: 'monthly', weekOfMonth: 'third' })).toBe('monthly_any_day_third_week');
        expect(transformFrequencyToApiString({ type: 'monthly', weekOfMonth: 'fourth' })).toBe('monthly_any_day_fourth_week');
        expect(transformFrequencyToApiString({ type: 'monthly', weekOfMonth: 'last' })).toBe('monthly_any_day_last_week');
      });

      // Quarterly patterns
      it('transforms quarterly patterns correctly', () => {
        expect(transformFrequencyToApiString({ type: 'quarterly' })).toBe('quarterly_first_day');
        expect(transformFrequencyToApiString({ type: 'quarterly', daysOfWeek: [1] })).toBe('quarterly_first_MO');
        expect(transformFrequencyToApiString({ type: 'quarterly', daysOfWeek: [5], weekOfMonth: 'last' })).toBe('quarterly_last_FR');
        expect(transformFrequencyToApiString({ type: 'quarterly', weekOfMonth: 'first' })).toBe('quarterly_any_day_first_week');
        expect(transformFrequencyToApiString({ type: 'quarterly', daysOfWeek: [1, 2, 3, 4, 5], weekOfMonth: 'second' })).toBe('quarterly_any_week_day_second_week');
        expect(transformFrequencyToApiString({ type: 'quarterly', monthOfQuarter: 2 })).toBe('quarterly_any_day_second_month');
        // Test weekdays only (no weekOfMonth) - previously unreachable
        expect(transformFrequencyToApiString({ type: 'quarterly', daysOfWeek: [1, 2, 3, 4, 5] })).toBe('quarterly_first_week_day');
      });

      // Custom patterns
      it('transforms custom patterns correctly', () => {
        expect(transformFrequencyToApiString({ type: 'custom', customPattern: 'monthly_any_week_day_first_week' })).toBe('monthly_any_week_day_first_week');
        expect(transformFrequencyToApiString({ type: 'custom', customPattern: 'quarterly_last_day' })).toBe('quarterly_last_day');
      });

      // Legacy interval support (backward compatibility)
      it('handles legacy interval mapping for backward compatibility', () => {
        expect(transformFrequencyToApiString({ type: 'weekly', interval: 2 })).toBe('biweekly_first_week_any_day');
        expect(transformFrequencyToApiString({ type: 'weekly', interval: 2, daysOfWeek: [1] })).toBe('biweekly_first_week_specific_days_[MO]');
        expect(transformFrequencyToApiString({ type: 'weekly', interval: 2, daysOfWeek: [1, 2, 3, 4, 5] })).toBe('biweekly_first_week_any_week_day');
      });

      // Edge cases
      it('handles edge cases correctly', () => {
        // Invalid day numbers should throw an error
        expect(() => transformFrequencyToApiString({ type: 'daily', daysOfWeek: [1, 2, 8, 3, -1] })).toThrow('Invalid day(s) in daysOfWeek: 8, -1');

        // endDate is ignored in transformation (handled separately)
        expect(transformFrequencyToApiString({ type: 'daily', daysOfWeek: [1, 2, 3], endDate: '2024-12-31' })).toBe('daily_specific_days_[MO, TU, WE]');
      });

      // Error cases
      it('throws errors for invalid configurations', () => {
        expect(() => transformFrequencyToApiString({ type: 'custom' } as any)).toThrow('customPattern is required when type is "custom"');
        expect(() => transformFrequencyToApiString({ type: 'custom', customPattern: '' })).toThrow('customPattern is required when type is "custom"');
      });
    });

    describe('validateFrequencyObject', () => {
      // Basic frequency types
      it('validates all supported frequency types', () => {
        expect(isValidFrequencyObject({ type: 'daily' })).toBe(true);
        expect(isValidFrequencyObject({ type: 'weekly' })).toBe(true);
        expect(isValidFrequencyObject({ type: 'biweekly' })).toBe(true);
        expect(isValidFrequencyObject({ type: 'monthly' })).toBe(true);
        expect(isValidFrequencyObject({ type: 'quarterly' })).toBe(true);
        expect(isValidFrequencyObject({ type: 'yearly' })).toBe(true);
        expect(isValidFrequencyObject({ type: 'custom', customPattern: 'monthly_last_day' })).toBe(true);
      });

      it('rejects invalid frequency types', () => {
        expect(isValidFrequencyObject({ type: 'invalid' as any })).toBe(false);
        expect(isValidFrequencyObject({ type: '' as any })).toBe(false);
        expect(isValidFrequencyObject({} as any)).toBe(false);
        expect(isValidFrequencyObject({ type: null } as any)).toBe(false);
        expect(isValidFrequencyObject({ type: undefined } as any)).toBe(false);
      });

      // Custom pattern validation
      it('validates custom patterns', () => {
        expect(isValidFrequencyObject({ type: 'custom', customPattern: 'monthly_any_week_day_first_week' })).toBe(true);
        expect(isValidFrequencyObject({ type: 'custom', customPattern: 'quarterly_last_day' })).toBe(true);
        expect(isValidFrequencyObject({ type: 'custom' } as any)).toBe(false);
        expect(isValidFrequencyObject({ type: 'custom', customPattern: '' })).toBe(false);
        expect(isValidFrequencyObject({ type: 'custom', customPattern: '   ' })).toBe(false);
      });

      // Field validations
      it('validates daysOfWeek array', () => {
        expect(isValidFrequencyObject({ type: 'daily', daysOfWeek: [0, 1, 6] })).toBe(true);
        expect(isValidFrequencyObject({ type: 'daily', daysOfWeek: [1, 2, 3, 4, 5] })).toBe(true);
        expect(isValidFrequencyObject({ type: 'daily', daysOfWeek: [7] })).toBe(false);
        expect(isValidFrequencyObject({ type: 'daily', daysOfWeek: [-1] })).toBe(false);
        expect(isValidFrequencyObject({ type: 'daily', daysOfWeek: ['monday'] as any })).toBe(false);
        expect(isValidFrequencyObject({ type: 'daily', daysOfWeek: 'invalid' as any })).toBe(false);
      });

      it('validates dayOfMonth', () => {
        expect(isValidFrequencyObject({ type: 'monthly', dayOfMonth: 1 })).toBe(true);
        expect(isValidFrequencyObject({ type: 'monthly', dayOfMonth: 31 })).toBe(true);
        expect(isValidFrequencyObject({ type: 'monthly', dayOfMonth: 0 })).toBe(false);
        expect(isValidFrequencyObject({ type: 'monthly', dayOfMonth: 32 })).toBe(false);
        expect(isValidFrequencyObject({ type: 'monthly', dayOfMonth: 'first' as any })).toBe(false);
      });

      it('validates weekOfMonth', () => {
        expect(isValidFrequencyObject({ type: 'monthly', weekOfMonth: 'first' })).toBe(true);
        expect(isValidFrequencyObject({ type: 'monthly', weekOfMonth: 'last' })).toBe(true);
        expect(isValidFrequencyObject({ type: 'monthly', weekOfMonth: 'invalid' as any })).toBe(false);
        expect(isValidFrequencyObject({ type: 'monthly', weekOfMonth: 1 as any })).toBe(false);
      });

      it('validates monthOfQuarter', () => {
        expect(isValidFrequencyObject({ type: 'quarterly', monthOfQuarter: 1 })).toBe(true);
        expect(isValidFrequencyObject({ type: 'quarterly', monthOfQuarter: 2 })).toBe(true);
        expect(isValidFrequencyObject({ type: 'quarterly', monthOfQuarter: 3 })).toBe(true);
        expect(isValidFrequencyObject({ type: 'quarterly', monthOfQuarter: 0 })).toBe(false);
        expect(isValidFrequencyObject({ type: 'quarterly', monthOfQuarter: 4 })).toBe(false);
        expect(isValidFrequencyObject({ type: 'quarterly', monthOfQuarter: 'first' as any })).toBe(false);
      });

      it('validates interval (legacy support)', () => {
        expect(isValidFrequencyObject({ type: 'weekly', interval: 1 })).toBe(true);
        expect(isValidFrequencyObject({ type: 'weekly', interval: 2 })).toBe(true);
        expect(isValidFrequencyObject({ type: 'weekly', interval: 0 })).toBe(false);
        expect(isValidFrequencyObject({ type: 'weekly', interval: -1 })).toBe(false);
        expect(isValidFrequencyObject({ type: 'weekly', interval: 'two' as any })).toBe(false);
      });

      // Type-specific field restrictions
      it('validates type-specific field restrictions', () => {
        // Daily/weekly don't use monthOfQuarter or weekOfMonth
        expect(isValidFrequencyObject({ type: 'daily', monthOfQuarter: 1 })).toBe(false);
        expect(isValidFrequencyObject({ type: 'daily', weekOfMonth: 'first' })).toBe(false);
        expect(isValidFrequencyObject({ type: 'weekly', monthOfQuarter: 1 })).toBe(false);
        expect(isValidFrequencyObject({ type: 'weekly', weekOfMonth: 'first' })).toBe(false);

        // Biweekly doesn't use dayOfMonth or monthOfQuarter
        expect(isValidFrequencyObject({ type: 'biweekly', dayOfMonth: 15 })).toBe(false);
        expect(isValidFrequencyObject({ type: 'biweekly', monthOfQuarter: 1 })).toBe(false);

        // Biweekly only supports 'first' and 'second' weekOfMonth
        expect(isValidFrequencyObject({ type: 'biweekly', weekOfMonth: 'first' })).toBe(true);
        expect(isValidFrequencyObject({ type: 'biweekly', weekOfMonth: 'second' })).toBe(true);
        expect(isValidFrequencyObject({ type: 'biweekly', weekOfMonth: 'third' })).toBe(false);
        expect(isValidFrequencyObject({ type: 'biweekly', weekOfMonth: 'fourth' })).toBe(false);
        expect(isValidFrequencyObject({ type: 'biweekly', weekOfMonth: 'last' })).toBe(false);

        // Monthly doesn't use monthOfQuarter
        expect(isValidFrequencyObject({ type: 'monthly', monthOfQuarter: 1 })).toBe(false);

        // Quarterly doesn't support dayOfMonth (not implemented in transform logic)
        expect(isValidFrequencyObject({ type: 'quarterly', dayOfMonth: 15 })).toBe(false);
        expect(isValidFrequencyObject({ type: 'quarterly', dayOfMonth: 15, weekOfMonth: 'first' })).toBe(false);
        expect(isValidFrequencyObject({ type: 'quarterly', dayOfMonth: 15, monthOfQuarter: 1 })).toBe(false);
      });

      // Complex valid combinations
      it('validates complex valid combinations', () => {
        expect(isValidFrequencyObject({
          type: 'monthly',
          daysOfWeek: [1],
          weekOfMonth: 'first',
          endDate: '2024-12-31'
        })).toBe(true);

        expect(isValidFrequencyObject({
          type: 'quarterly',
          daysOfWeek: [5],
          weekOfMonth: 'last'
        })).toBe(true);

        expect(isValidFrequencyObject({
          type: 'biweekly',
          daysOfWeek: [1, 2, 3, 4, 5],
          endDate: '2024-12-31'
        })).toBe(true);

        expect(isValidFrequencyObject({
          type: 'weekly',
          interval: 2,
          daysOfWeek: [1, 3, 5]
        })).toBe(true);
      });
    });
  });
});
