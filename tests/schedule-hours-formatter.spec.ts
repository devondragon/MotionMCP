import { describe, it, expect } from 'vitest';
import { formatScheduleList } from '../src/utils/responseFormatters';
import type { MotionSchedule } from '../src/types/motion';

function text(res: any): string {
  return (res.content?.[0] as any)?.text || '';
}

describe('formatScheduleList working hours', () => {
  it('renders each working day start-end from the nested schedule details', () => {
    const schedules = [
      {
        name: 'Work hours',
        isDefaultTimezone: true,
        timezone: 'America/Denver',
        schedule: {
          monday: [{ start: '09:00', end: '17:00' }],
          tuesday: [{ start: '09:00', end: '17:00' }],
          friday: [{ start: '09:00', end: '12:00' }],
        },
      },
    ] as MotionSchedule[];

    const out = text(formatScheduleList(schedules));
    expect(out).toContain('Work hours (America/Denver)');
    expect(out).toContain('Mon 09:00-17:00');
    expect(out).toContain('Fri 09:00-12:00');
    expect(out).not.toContain('Wed'); // no wednesday slot
  });

  it('joins multiple slots in a day with a slash', () => {
    const schedules = [
      {
        name: 'Split',
        isDefaultTimezone: true,
        timezone: 'America/Denver',
        schedule: { monday: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
      },
    ] as MotionSchedule[];
    expect(text(formatScheduleList(schedules))).toContain('Mon 09:00-12:00/13:00-17:00');
  });

  it('reports when a schedule has no working hours', () => {
    const schedules = [
      { name: 'Empty', isDefaultTimezone: true, timezone: 'UTC', schedule: {} },
    ] as MotionSchedule[];
    expect(text(formatScheduleList(schedules))).toContain('No working hours defined');
  });
});
