import { describe, it, expect } from 'vitest';
import { formatAccountDateContext } from '../src/utils/dateFormat';
import { formatTaskList, formatScheduleList } from '../src/utils/responseFormatters';
import type { MotionSchedule, MotionTask } from '../src/types/motion';

function textOf(res: any): string {
  return (res.content?.[0] as any)?.text || '';
}

describe('formatAccountDateContext', () => {
  it('reports the account zone and local date/weekday for a pinned instant', () => {
    // 2026-08-24T20:00:00Z = 14:00 MDT (UTC-6) on Monday Aug 24 in Denver.
    const line = formatAccountDateContext('America/Denver', new Date('2026-08-24T20:00:00.000Z'));
    expect(line).toBe('Account timezone: America/Denver | Today: 2026-08-24 (Monday)');
  });

  it('resolves the local calendar day, not the UTC day, near midnight', () => {
    // 04:00Z is still 22:00 the previous day (Sunday Aug 23) in Denver.
    const line = formatAccountDateContext('America/Denver', new Date('2026-08-24T04:00:00.000Z'));
    expect(line).toContain('Today: 2026-08-23 (Sunday)');
  });

  it('falls back to a UTC-labelled reading when no zone is given', () => {
    const line = formatAccountDateContext(undefined, new Date('2026-08-24T20:00:00.000Z'));
    expect(line).toContain('unknown (times shown in UTC)');
    expect(line).toContain('Today: 2026-08-24');
  });

  it('falls back when the zone is not a valid IANA id', () => {
    const line = formatAccountDateContext('Not/AZone', new Date('2026-08-24T20:00:00.000Z'));
    expect(line).toContain('unknown (times shown in UTC)');
  });
});

describe('account context in list responses', () => {
  it('prepends the account context line to task lists', () => {
    const tasks = [{ id: 't1', name: 'A' }] as MotionTask[];
    const text = textOf(formatTaskList(tasks, { timeZone: 'America/Denver' }));
    expect(text).toContain('Account timezone: America/Denver | Today:');
    expect(text.startsWith('Account timezone:')).toBe(true);
  });

  it('derives the account context zone from the schedules for schedule lists', () => {
    const schedules = [
      { name: 'Work hours', isDefaultTimezone: true, timezone: 'America/Denver', schedule: {} },
    ] as MotionSchedule[];
    const text = textOf(formatScheduleList(schedules));
    expect(text).toContain('Account timezone: America/Denver | Today:');
    expect(text).toContain('Work hours');
  });
});
