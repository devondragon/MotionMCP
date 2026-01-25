import { describe, it, expect } from 'vitest';
import {
  transformFrequencyToApiString,
  validateFrequencyObject,
  isValidFrequencyObject
} from '../../src/utils/frequencyTransform';
import { FrequencyObject } from '../../src/types/motion';

describe('transformFrequencyToApiString', () => {
  describe('custom patterns', () => {
    it('passes through custom pattern directly', () => {
      expect(transformFrequencyToApiString({ type: 'custom', customPattern: 'monthly_15' }))
        .toBe('monthly_15');
    });

    it('throws error when custom type missing customPattern', () => {
      expect(() => transformFrequencyToApiString({ type: 'custom' }))
        .toThrow('customPattern is required when type is "custom"');
    });
  });

  describe('daily patterns', () => {
    it('returns daily_every_day when no days specified', () => {
      expect(transformFrequencyToApiString({ type: 'daily' })).toBe('daily_every_day');
    });

    it('returns daily_every_day for empty daysOfWeek array', () => {
      expect(transformFrequencyToApiString({ type: 'daily', daysOfWeek: [] })).toBe('daily_every_day');
    });

    it('returns daily_every_week_day for weekdays [1,2,3,4,5]', () => {
      expect(transformFrequencyToApiString({ type: 'daily', daysOfWeek: [1, 2, 3, 4, 5] }))
        .toBe('daily_every_week_day');
    });

    it('returns specific days format for subset of days', () => {
      expect(transformFrequencyToApiString({ type: 'daily', daysOfWeek: [1, 3, 5] }))
        .toBe('daily_specific_days_[MO, WE, FR]');
    });

    it('handles single day', () => {
      expect(transformFrequencyToApiString({ type: 'daily', daysOfWeek: [0] }))
        .toBe('daily_specific_days_[SU]');
    });

    it('handles weekend days', () => {
      expect(transformFrequencyToApiString({ type: 'daily', daysOfWeek: [0, 6] }))
        .toBe('daily_specific_days_[SU, SA]');
    });
  });

  describe('weekly patterns', () => {
    it('returns weekly_any_day when no days specified', () => {
      expect(transformFrequencyToApiString({ type: 'weekly' })).toBe('weekly_any_day');
    });

    it('returns weekly_any_day for empty daysOfWeek', () => {
      expect(transformFrequencyToApiString({ type: 'weekly', daysOfWeek: [] })).toBe('weekly_any_day');
    });

    it('returns weekly_any_week_day for weekdays [1,2,3,4,5]', () => {
      expect(transformFrequencyToApiString({ type: 'weekly', daysOfWeek: [1, 2, 3, 4, 5] }))
        .toBe('weekly_any_week_day');
    });

    it('returns specific days format', () => {
      expect(transformFrequencyToApiString({ type: 'weekly', daysOfWeek: [2, 4] }))
        .toBe('weekly_specific_days_[TU, TH]');
    });

    it('handles legacy interval:2 by converting to biweekly', () => {
      expect(transformFrequencyToApiString({ type: 'weekly', interval: 2 }))
        .toBe('biweekly_first_week_any_day');
    });

    it('handles legacy interval:2 with specific days', () => {
      expect(transformFrequencyToApiString({ type: 'weekly', interval: 2, daysOfWeek: [1, 3] }))
        .toBe('biweekly_first_week_specific_days_[MO, WE]');
    });
  });

  describe('biweekly patterns', () => {
    it('returns biweekly_first_week_any_day by default', () => {
      expect(transformFrequencyToApiString({ type: 'biweekly' }))
        .toBe('biweekly_first_week_any_day');
    });

    it('returns biweekly_second_week_any_day for second week', () => {
      expect(transformFrequencyToApiString({ type: 'biweekly', weekOfMonth: 'second' }))
        .toBe('biweekly_second_week_any_day');
    });

    it('returns biweekly_first_week_any_week_day for weekdays first week', () => {
      expect(transformFrequencyToApiString({ type: 'biweekly', daysOfWeek: [1, 2, 3, 4, 5] }))
        .toBe('biweekly_first_week_any_week_day');
    });

    it('returns biweekly_second_week_any_week_day for weekdays second week', () => {
      expect(transformFrequencyToApiString({
        type: 'biweekly',
        weekOfMonth: 'second',
        daysOfWeek: [1, 2, 3, 4, 5]
      })).toBe('biweekly_second_week_any_week_day');
    });

    it('returns specific days format', () => {
      expect(transformFrequencyToApiString({ type: 'biweekly', daysOfWeek: [1, 5] }))
        .toBe('biweekly_first_week_specific_days_[MO, FR]');
    });
  });

  describe('monthly patterns', () => {
    it('returns monthly_1 as default', () => {
      expect(transformFrequencyToApiString({ type: 'monthly' })).toBe('monthly_1');
    });

    it('returns monthly day-of-month format', () => {
      expect(transformFrequencyToApiString({ type: 'monthly', dayOfMonth: 15 }))
        .toBe('monthly_15');
    });

    it('returns monthly_first_MO for first Monday', () => {
      expect(transformFrequencyToApiString({
        type: 'monthly',
        daysOfWeek: [1],
        weekOfMonth: 'first'
      })).toBe('monthly_first_MO');
    });

    it('returns monthly_last_TU for last Tuesday', () => {
      expect(transformFrequencyToApiString({
        type: 'monthly',
        daysOfWeek: [2],
        weekOfMonth: 'last'
      })).toBe('monthly_last_TU');
    });

    it('returns monthly_any_day_first_week for any day first week', () => {
      expect(transformFrequencyToApiString({
        type: 'monthly',
        weekOfMonth: 'first'
      })).toBe('monthly_any_day_first_week');
    });

    it('returns monthly_any_week_day_of_month for weekdays any week', () => {
      expect(transformFrequencyToApiString({
        type: 'monthly',
        daysOfWeek: [1, 2, 3, 4, 5]
      })).toBe('monthly_any_week_day_of_month');
    });

    it('returns monthly_any_week_day_second_week for weekdays specific week', () => {
      expect(transformFrequencyToApiString({
        type: 'monthly',
        daysOfWeek: [1, 2, 3, 4, 5],
        weekOfMonth: 'second'
      })).toBe('monthly_any_week_day_second_week');
    });

    it('returns monthly_any_day_last_week', () => {
      expect(transformFrequencyToApiString({
        type: 'monthly',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        weekOfMonth: 'last'
      })).toBe('monthly_any_day_last_week');
    });

    it('throws error for unsupported multi-day pattern without weekOfMonth', () => {
      expect(() => transformFrequencyToApiString({
        type: 'monthly',
        daysOfWeek: [1, 3, 5] // Not weekdays, not single day
      })).toThrow('Unsupported multi-day monthly pattern');
    });
  });

  describe('quarterly patterns', () => {
    it('returns quarterly_first_day as default', () => {
      expect(transformFrequencyToApiString({ type: 'quarterly' }))
        .toBe('quarterly_first_day');
    });

    it('returns quarterly_first_MO for first Monday', () => {
      expect(transformFrequencyToApiString({
        type: 'quarterly',
        daysOfWeek: [1],
        weekOfMonth: 'first'
      })).toBe('quarterly_first_MO');
    });

    it('returns quarterly_last_FR for last Friday', () => {
      expect(transformFrequencyToApiString({
        type: 'quarterly',
        daysOfWeek: [5],
        weekOfMonth: 'last'
      })).toBe('quarterly_last_FR');
    });

    it('returns quarterly_first_TU when single day without week specified', () => {
      expect(transformFrequencyToApiString({
        type: 'quarterly',
        daysOfWeek: [2]
      })).toBe('quarterly_first_TU');
    });

    it('returns quarterly_any_day_first_week', () => {
      expect(transformFrequencyToApiString({
        type: 'quarterly',
        weekOfMonth: 'first'
      })).toBe('quarterly_any_day_first_week');
    });

    it('returns quarterly_any_week_day_last_week for weekdays last week', () => {
      expect(transformFrequencyToApiString({
        type: 'quarterly',
        daysOfWeek: [1, 2, 3, 4, 5],
        weekOfMonth: 'last'
      })).toBe('quarterly_any_week_day_last_week');
    });

    it('returns quarterly_any_day_first_month for first month', () => {
      expect(transformFrequencyToApiString({
        type: 'quarterly',
        monthOfQuarter: 1
      })).toBe('quarterly_any_day_first_month');
    });

    it('returns quarterly_any_day_second_month for second month', () => {
      expect(transformFrequencyToApiString({
        type: 'quarterly',
        monthOfQuarter: 2
      })).toBe('quarterly_any_day_second_month');
    });

    it('returns quarterly_any_day_third_month for third month', () => {
      expect(transformFrequencyToApiString({
        type: 'quarterly',
        monthOfQuarter: 3
      })).toBe('quarterly_any_day_third_month');
    });

    it('returns quarterly_first_week_day for weekdays without week', () => {
      expect(transformFrequencyToApiString({
        type: 'quarterly',
        daysOfWeek: [1, 2, 3, 4, 5]
      })).toBe('quarterly_first_week_day');
    });

    it('throws error for unsupported multi-day selection', () => {
      expect(() => transformFrequencyToApiString({
        type: 'quarterly',
        daysOfWeek: [1, 3, 5] // Not weekdays, not single day
      })).toThrow('Unsupported multi-day selection for quarterly patterns');
    });
  });

  describe('yearly patterns', () => {
    it('returns yearly', () => {
      expect(transformFrequencyToApiString({ type: 'yearly' })).toBe('yearly');
    });
  });

  describe('invalid frequency types', () => {
    it('throws error for unknown frequency type', () => {
      expect(() => transformFrequencyToApiString({ type: 'hourly' as any }))
        .toThrow('Unsupported frequency type: hourly');
    });
  });

  describe('invalid days', () => {
    it('throws error for day values out of range', () => {
      expect(() => transformFrequencyToApiString({ type: 'daily', daysOfWeek: [7] }))
        .toThrow('Invalid day(s) in daysOfWeek: 7');
    });

    it('throws error for negative day values', () => {
      expect(() => transformFrequencyToApiString({ type: 'weekly', daysOfWeek: [-1] }))
        .toThrow('Invalid day(s) in daysOfWeek: -1');
    });
  });
});

describe('validateFrequencyObject', () => {
  describe('type validation', () => {
    it('returns invalid for missing type', () => {
      const result = validateFrequencyObject({} as FrequencyObject);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid frequency type');
    });

    it('returns invalid for unknown type', () => {
      const result = validateFrequencyObject({ type: 'hourly' } as any);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid frequency type: hourly');
    });

    it('returns valid for all known types', () => {
      const types: FrequencyObject['type'][] = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom'];
      for (const type of types) {
        if (type === 'custom') {
          expect(validateFrequencyObject({ type, customPattern: 'test' }).valid).toBe(true);
        } else {
          expect(validateFrequencyObject({ type }).valid).toBe(true);
        }
      }
    });
  });

  describe('custom type validation', () => {
    it('requires customPattern for custom type', () => {
      const result = validateFrequencyObject({ type: 'custom' });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Custom frequency type requires a non-empty customPattern');
    });

    it('rejects empty customPattern', () => {
      const result = validateFrequencyObject({ type: 'custom', customPattern: '' });
      expect(result.valid).toBe(false);
    });

    it('rejects whitespace-only customPattern', () => {
      const result = validateFrequencyObject({ type: 'custom', customPattern: '   ' });
      expect(result.valid).toBe(false);
    });

    it('accepts valid customPattern', () => {
      const result = validateFrequencyObject({ type: 'custom', customPattern: 'monthly_15' });
      expect(result.valid).toBe(true);
    });

    it('skips other validations for custom type', () => {
      // Invalid daysOfWeek would normally fail, but custom type skips validation
      const result = validateFrequencyObject({
        type: 'custom',
        customPattern: 'test',
        daysOfWeek: [99] // This would be invalid normally
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('daysOfWeek validation', () => {
    it('rejects non-array daysOfWeek', () => {
      const result = validateFrequencyObject({ type: 'daily', daysOfWeek: 'monday' as any });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('daysOfWeek must be an array');
    });

    it('rejects day values < 0', () => {
      const result = validateFrequencyObject({ type: 'daily', daysOfWeek: [-1] });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid day(s) in daysOfWeek');
    });

    it('rejects day values > 6', () => {
      const result = validateFrequencyObject({ type: 'daily', daysOfWeek: [7] });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid day(s) in daysOfWeek');
    });

    it('rejects non-number values in daysOfWeek', () => {
      const result = validateFrequencyObject({ type: 'daily', daysOfWeek: ['monday'] as any });
      expect(result.valid).toBe(false);
    });

    it('accepts valid daysOfWeek', () => {
      const result = validateFrequencyObject({ type: 'daily', daysOfWeek: [0, 3, 6] });
      expect(result.valid).toBe(true);
    });
  });

  describe('dayOfMonth validation', () => {
    it('rejects dayOfMonth < 1', () => {
      const result = validateFrequencyObject({ type: 'monthly', dayOfMonth: 0 });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('dayOfMonth must be a number between 1 and 31');
    });

    it('rejects dayOfMonth > 31', () => {
      const result = validateFrequencyObject({ type: 'monthly', dayOfMonth: 32 });
      expect(result.valid).toBe(false);
    });

    it('rejects non-number dayOfMonth', () => {
      const result = validateFrequencyObject({ type: 'monthly', dayOfMonth: '15' as any });
      expect(result.valid).toBe(false);
    });

    it('accepts valid dayOfMonth', () => {
      const result = validateFrequencyObject({ type: 'monthly', dayOfMonth: 15 });
      expect(result.valid).toBe(true);
    });
  });

  describe('weekOfMonth validation', () => {
    it('rejects invalid weekOfMonth values', () => {
      const result = validateFrequencyObject({ type: 'monthly', weekOfMonth: 'fifth' as any });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('weekOfMonth must be one of: first, second, third, fourth, last');
    });

    it('accepts all valid weekOfMonth values', () => {
      const weeks = ['first', 'second', 'third', 'fourth', 'last'] as const;
      for (const week of weeks) {
        const result = validateFrequencyObject({ type: 'monthly', weekOfMonth: week });
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('monthOfQuarter validation', () => {
    it('rejects monthOfQuarter < 1', () => {
      const result = validateFrequencyObject({ type: 'quarterly', monthOfQuarter: 0 as any });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('monthOfQuarter must be 1, 2, or 3');
    });

    it('rejects monthOfQuarter > 3', () => {
      const result = validateFrequencyObject({ type: 'quarterly', monthOfQuarter: 4 as any });
      expect(result.valid).toBe(false);
    });

    it('accepts valid monthOfQuarter values', () => {
      for (const month of [1, 2, 3] as const) {
        const result = validateFrequencyObject({ type: 'quarterly', monthOfQuarter: month });
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('interval validation', () => {
    it('rejects interval < 1', () => {
      const result = validateFrequencyObject({ type: 'weekly', interval: 0 });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('interval must be a positive number');
    });

    it('rejects negative interval', () => {
      const result = validateFrequencyObject({ type: 'weekly', interval: -1 });
      expect(result.valid).toBe(false);
    });

    it('accepts valid interval', () => {
      const result = validateFrequencyObject({ type: 'weekly', interval: 2 });
      expect(result.valid).toBe(true);
    });
  });

  describe('type-specific field restrictions', () => {
    it('rejects dayOfMonth for quarterly', () => {
      const result = validateFrequencyObject({ type: 'quarterly', dayOfMonth: 15 });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('dayOfMonth is not supported for quarterly patterns');
    });

    it('rejects dayOfMonth for biweekly', () => {
      const result = validateFrequencyObject({ type: 'biweekly', dayOfMonth: 15 });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('dayOfMonth is not supported for biweekly patterns');
    });

    it('rejects monthOfQuarter for biweekly', () => {
      const result = validateFrequencyObject({ type: 'biweekly', monthOfQuarter: 1 });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('monthOfQuarter is not supported for biweekly patterns');
    });

    it('rejects weekOfMonth third/fourth/last for biweekly', () => {
      const result = validateFrequencyObject({ type: 'biweekly', weekOfMonth: 'third' });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('weekOfMonth for biweekly patterns must be "first" or "second"');
    });

    it('accepts first/second weekOfMonth for biweekly', () => {
      expect(validateFrequencyObject({ type: 'biweekly', weekOfMonth: 'first' }).valid).toBe(true);
      expect(validateFrequencyObject({ type: 'biweekly', weekOfMonth: 'second' }).valid).toBe(true);
    });

    it('rejects monthOfQuarter for daily', () => {
      const result = validateFrequencyObject({ type: 'daily', monthOfQuarter: 1 });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('monthOfQuarter is not supported for daily patterns');
    });

    it('rejects weekOfMonth for daily', () => {
      const result = validateFrequencyObject({ type: 'daily', weekOfMonth: 'first' });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('weekOfMonth is not supported for daily patterns');
    });

    it('rejects monthOfQuarter for weekly', () => {
      const result = validateFrequencyObject({ type: 'weekly', monthOfQuarter: 1 });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('monthOfQuarter is not supported for weekly patterns');
    });

    it('rejects weekOfMonth for weekly', () => {
      const result = validateFrequencyObject({ type: 'weekly', weekOfMonth: 'first' });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('weekOfMonth is not supported for weekly patterns');
    });

    it('rejects monthOfQuarter for monthly', () => {
      const result = validateFrequencyObject({ type: 'monthly', monthOfQuarter: 1 });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('monthOfQuarter is not supported for monthly patterns');
    });
  });
});

describe('isValidFrequencyObject', () => {
  it('returns true for valid frequency object', () => {
    expect(isValidFrequencyObject({ type: 'daily' })).toBe(true);
  });

  it('returns false for invalid frequency object', () => {
    expect(isValidFrequencyObject({ type: 'invalid' } as any)).toBe(false);
  });
});
