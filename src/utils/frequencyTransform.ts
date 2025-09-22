/**
 * Utility functions for transforming frequency objects to Motion API string format
 */

import { FrequencyObject } from '../types/motion';

/**
 * Maps day numbers (0-6) to Motion API day abbreviations
 * 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 */
const DAY_ABBREVIATIONS = {
  0: 'SU', // Sunday
  1: 'MO', // Monday
  2: 'TU', // Tuesday
  3: 'WE', // Wednesday
  4: 'TH', // Thursday
  5: 'FR', // Friday
  6: 'SA'  // Saturday
} as const;

/**
 * Transforms a frequency object into the Motion API expected string format
 *
 * Based on Motion API documentation: https://docs.usemotion.com/cookbooks/frequency/
 *
 * Supports all Motion API frequency patterns including:
 * - Daily: daily_every_day, daily_every_week_day, daily_specific_days_[...]
 * - Weekly: weekly_any_day, weekly_any_week_day, weekly_specific_days_[...]
 * - Biweekly: biweekly_first_week_*, biweekly_second_week_*
 * - Monthly: monthly_1-31, monthly_first_MO, monthly_last_TU, monthly_*_week, etc.
 * - Quarterly: quarterly_first_day, quarterly_last_FR, quarterly_any_day_first_week, etc.
 * - Custom: Direct API pattern passthrough
 *
 * @param frequency - The frequency object to transform
 * @returns The Motion API compatible frequency string
 */
export function transformFrequencyToApiString(frequency: FrequencyObject): string {
  const { type, daysOfWeek, dayOfMonth, weekOfMonth, monthOfQuarter, interval, customPattern } = frequency;

  // Custom pattern passthrough
  if (type === 'custom') {
    if (!customPattern) {
      throw new Error('customPattern is required when type is "custom"');
    }
    return customPattern;
  }

  // Legacy interval mapping: weekly + interval:2 → biweekly
  if (type === 'weekly' && interval === 2) {
    return transformBiweeklyPattern(daysOfWeek, 'first'); // Default to first week
  }

  switch (type) {
    case 'daily':
      return transformDailyPattern(daysOfWeek);

    case 'weekly':
      return transformWeeklyPattern(daysOfWeek);

    case 'biweekly':
      // Use weekOfMonth to determine which week (first or second)
      const biweeklyWeek = (weekOfMonth === 'second') ? 'second' : 'first';
      return transformBiweeklyPattern(daysOfWeek, biweeklyWeek);

    case 'monthly':
      return transformMonthlyPattern(daysOfWeek, dayOfMonth, weekOfMonth);

    case 'quarterly':
      return transformQuarterlyPattern(daysOfWeek, weekOfMonth, monthOfQuarter);

    case 'yearly':
      // Yearly patterns are basic in the API docs
      return 'yearly';

    default:
      throw new Error(`Unsupported frequency type: ${type}`);
  }
}

/**
 * Transform daily frequency patterns
 */
function transformDailyPattern(daysOfWeek?: number[]): string {
  if (!daysOfWeek || daysOfWeek.length === 0) {
    return 'daily_every_day';
  }

  // Check if it's weekdays only (Mon-Fri)
  const isWeekdaysOnly = isWeekdaysPattern(daysOfWeek);
  if (isWeekdaysOnly) {
    return 'daily_every_week_day';
  }

  // Specific days
  const dayAbbrevs = formatDayAbbreviations(daysOfWeek);
  return `daily_specific_days_[${dayAbbrevs}]`;
}

/**
 * Transform weekly frequency patterns
 */
function transformWeeklyPattern(daysOfWeek?: number[]): string {
  if (!daysOfWeek || daysOfWeek.length === 0) {
    return 'weekly_any_day';
  }

  // Check if it's weekdays only (Mon-Fri)
  const isWeekdaysOnly = isWeekdaysPattern(daysOfWeek);
  if (isWeekdaysOnly) {
    return 'weekly_any_week_day';
  }

  // Specific days
  const dayAbbrevs = formatDayAbbreviations(daysOfWeek);
  return `weekly_specific_days_[${dayAbbrevs}]`;
}

/**
 * Transform biweekly frequency patterns
 */
function transformBiweeklyPattern(daysOfWeek?: number[], week: 'first' | 'second' = 'first'): string {
  if (!daysOfWeek || daysOfWeek.length === 0) {
    return `biweekly_${week}_week_any_day`;
  }

  // Check if it's weekdays only (Mon-Fri)
  const isWeekdaysOnly = isWeekdaysPattern(daysOfWeek);
  if (isWeekdaysOnly) {
    return `biweekly_${week}_week_any_week_day`;
  }

  // Specific days
  const dayAbbrevs = formatDayAbbreviations(daysOfWeek);
  return `biweekly_${week}_week_specific_days_[${dayAbbrevs}]`;
}

/**
 * Transform monthly frequency patterns
 */
function transformMonthlyPattern(daysOfWeek?: number[], dayOfMonth?: number, weekOfMonth?: string): string {
  // Handle monthly with specific day of month
  if (dayOfMonth && (!daysOfWeek || daysOfWeek.length === 0)) {
    return `monthly_${dayOfMonth}`;
  }

  // Handle monthly with day-of-week patterns
  if (daysOfWeek && daysOfWeek.length > 0) {
    if (weekOfMonth) {
      // Specific week + specific day: monthly_first_MO, monthly_last_TU
      if (daysOfWeek.length === 1) {
        const dayAbbrev = DAY_ABBREVIATIONS[daysOfWeek[0] as keyof typeof DAY_ABBREVIATIONS];
        return `monthly_${weekOfMonth}_${dayAbbrev}`;
      }
      // Specific week + multiple days (not supported directly, use week pattern)
      if (isWeekdaysPattern(daysOfWeek)) {
        return `monthly_any_week_day_${weekOfMonth}_week`;
      }
      return `monthly_any_day_${weekOfMonth}_week`;
    } else {
      // No week specified, use general month patterns
      if (isWeekdaysPattern(daysOfWeek)) {
        return 'monthly_any_week_day_of_month';
      }
      // Multiple specific days without weekOfMonth is not supported
      throw new Error('Unsupported multi-day monthly pattern without weekOfMonth. Supported patterns include: monthly_1-31 (e.g., monthly_15), monthly_first_MO, monthly_last_TU, monthly_any_week_day_of_month, monthly_any_day_first_week, etc. Please specify weekOfMonth or see https://docs.usemotion.com/cookbooks/frequency/ for more options.');
    }
  }

  // Handle weekOfMonth without daysOfWeek (any day of specified week)
  if (weekOfMonth && (!daysOfWeek || daysOfWeek.length === 0)) {
    return `monthly_any_day_${weekOfMonth}_week`;
  }

  // Default to first day of month
  return 'monthly_1';
}

/**
 * Transform quarterly frequency patterns
 */
function transformQuarterlyPattern(daysOfWeek?: number[], weekOfMonth?: string, monthOfQuarter?: number): string {
  // Handle quarterly with specific day-of-week
  if (daysOfWeek && daysOfWeek.length === 1) {
    const dayAbbrev = DAY_ABBREVIATIONS[daysOfWeek[0] as keyof typeof DAY_ABBREVIATIONS];
    if (weekOfMonth === 'first') {
      return `quarterly_first_${dayAbbrev}`;
    }
    if (weekOfMonth === 'last') {
      return `quarterly_last_${dayAbbrev}`;
    }
    // Default to first if no week specified
    return `quarterly_first_${dayAbbrev}`;
  }

  // Handle quarterly with week patterns
  if (weekOfMonth) {
    if (daysOfWeek && isWeekdaysPattern(daysOfWeek)) {
      return `quarterly_any_week_day_${weekOfMonth}_week`;
    }
    return `quarterly_any_day_${weekOfMonth}_week`;
  }

  // Handle quarterly with month patterns
  if (monthOfQuarter) {
    return `quarterly_any_day_${getMonthOrdinal(monthOfQuarter)}_month`;
  }

  // Handle remaining patterns
  if (daysOfWeek && isWeekdaysPattern(daysOfWeek)) {
    return 'quarterly_first_week_day';
  }

  // Explicitly reject unsupported multi-day selections
  if (daysOfWeek && daysOfWeek.length > 1 && !isWeekdaysPattern(daysOfWeek)) {
    throw new Error(
      'Unsupported multi-day selection for quarterly patterns: ' + JSON.stringify(daysOfWeek) +
      '. Quarterly patterns only support a single day-of-week (e.g., "quarterly_first_MO"), weekdays (Mon-Fri, "quarterly_any_week_day_first_week"), or any day ("quarterly_any_day_first_week"). ' +
      'Please refer to the Motion API documentation for supported quarterly patterns: https://docs.usemotion.com/cookbooks/frequency/#quarterly-patterns'
    );
  }

  // Default pattern
  return 'quarterly_first_day';
}

/**
 * Helper: Check if daysOfWeek represents weekdays only (Mon-Fri)
 */
function isWeekdaysPattern(daysOfWeek: number[]): boolean {
  return daysOfWeek.length === 5 &&
    daysOfWeek.includes(1) && daysOfWeek.includes(2) &&
    daysOfWeek.includes(3) && daysOfWeek.includes(4) &&
    daysOfWeek.includes(5);
}

/**
 * Helper: Format day numbers to abbreviations
 * Throws error if invalid days are encountered
 */
function formatDayAbbreviations(daysOfWeek: number[]): string {
  const invalidDays = daysOfWeek.filter(day => day < 0 || day > 6);
  if (invalidDays.length > 0) {
    throw new Error(`Invalid day(s) in daysOfWeek: ${invalidDays.join(', ')}`);
  }
  return daysOfWeek
    .map(day => DAY_ABBREVIATIONS[day as keyof typeof DAY_ABBREVIATIONS])
    .filter(Boolean)
    .join(', ');
}

/**
 * Helper: Convert month number to ordinal string
 */
function getMonthOrdinal(month: number): string {
  const ordinals = { 1: 'first', 2: 'second', 3: 'third' };
  return ordinals[month as keyof typeof ordinals] || 'first';
}

/**
 * Result of frequency validation
 */
export interface FrequencyValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates that a frequency object is valid for transformation
 *
 * @param frequency - The frequency object to validate
 * @returns Validation result with detailed reason if invalid
 */
export function validateFrequencyObject(frequency: FrequencyObject): FrequencyValidationResult {
  if (!frequency.type || !['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom'].includes(frequency.type)) {
    return { valid: false, reason: `Invalid frequency type: ${frequency.type}` };
  }

  // Custom type requires customPattern
  if (frequency.type === 'custom') {
    if (!frequency.customPattern || typeof frequency.customPattern !== 'string' || frequency.customPattern.trim() === '') {
      return { valid: false, reason: 'Custom frequency type requires a non-empty customPattern' };
    }
    return { valid: true }; // Skip other validations for custom patterns
  }

  // Validate daysOfWeek if provided
  if (frequency.daysOfWeek) {
    if (!Array.isArray(frequency.daysOfWeek)) {
      return { valid: false, reason: 'daysOfWeek must be an array' };
    }

    // Check that all days are valid (0-6)
    const invalidDays = frequency.daysOfWeek.filter(day => typeof day !== 'number' || day < 0 || day > 6);
    if (invalidDays.length > 0) {
      return { valid: false, reason: `Invalid day(s) in daysOfWeek: ${invalidDays.join(', ')}. Days must be numbers 0-6` };
    }
  }

  // Validate dayOfMonth if provided
  if (frequency.dayOfMonth !== undefined) {
    if (typeof frequency.dayOfMonth !== 'number' || frequency.dayOfMonth < 1 || frequency.dayOfMonth > 31) {
      return { valid: false, reason: 'dayOfMonth must be a number between 1 and 31' };
    }
  }

  // Validate weekOfMonth if provided
  if (frequency.weekOfMonth !== undefined) {
    if (!['first', 'second', 'third', 'fourth', 'last'].includes(frequency.weekOfMonth)) {
      return { valid: false, reason: 'weekOfMonth must be one of: first, second, third, fourth, last' };
    }
  }

  // Validate monthOfQuarter if provided
  if (frequency.monthOfQuarter !== undefined) {
    if (typeof frequency.monthOfQuarter !== 'number' || frequency.monthOfQuarter < 1 || frequency.monthOfQuarter > 3) {
      return { valid: false, reason: 'monthOfQuarter must be 1, 2, or 3' };
    }
  }

  // Validate interval if provided (legacy support)
  if (frequency.interval !== undefined) {
    if (typeof frequency.interval !== 'number' || frequency.interval < 1) {
      return { valid: false, reason: 'interval must be a positive number' };
    }
  }

  // Type-specific validations
  switch (frequency.type) {
    case 'quarterly':
      // Quarterly doesn't support dayOfMonth (not implemented in transform logic)
      if (frequency.dayOfMonth) {
        return { valid: false, reason: 'dayOfMonth is not supported for quarterly patterns' };
      }
      break;

    case 'biweekly':
      // Biweekly doesn't use dayOfMonth or monthOfQuarter
      if (frequency.dayOfMonth) {
        return { valid: false, reason: 'dayOfMonth is not supported for biweekly patterns' };
      }
      if (frequency.monthOfQuarter) {
        return { valid: false, reason: 'monthOfQuarter is not supported for biweekly patterns' };
      }
      // Biweekly only supports 'first' and 'second' week
      if (frequency.weekOfMonth && !['first', 'second'].includes(frequency.weekOfMonth)) {
        return { valid: false, reason: 'weekOfMonth for biweekly patterns must be "first" or "second"' };
      }
      break;

    case 'daily':
    case 'weekly':
      // Daily/weekly don't use monthOfQuarter or weekOfMonth
      if (frequency.monthOfQuarter) {
        return { valid: false, reason: `monthOfQuarter is not supported for ${frequency.type} patterns` };
      }
      if (frequency.weekOfMonth) {
        return { valid: false, reason: `weekOfMonth is not supported for ${frequency.type} patterns` };
      }
      break;

    case 'monthly':
      // Monthly doesn't use monthOfQuarter
      if (frequency.monthOfQuarter) {
        return { valid: false, reason: 'monthOfQuarter is not supported for monthly patterns' };
      }
      break;
  }

  return { valid: true };
}

/**
 * Legacy boolean validation function for backward compatibility
 * @deprecated Use validateFrequencyObject instead for detailed error information
 */
export function isValidFrequencyObject(frequency: FrequencyObject): boolean {
  return validateFrequencyObject(frequency).valid;
}