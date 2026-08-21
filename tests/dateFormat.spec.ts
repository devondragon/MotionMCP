import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatTimestamp,
  formatDateOnly,
  resolveDisplayTimeZone,
  endOfDayInZone,
  LEGACY_LOCALE_SHAPE
} from '../src/utils/dateFormat';
import { formatTaskDetail, formatTaskList } from '../src/utils/responseFormatters';
import { parseFilterDate } from '../src/utils/constants';
import { normalizeDueDateForApi } from '../src/utils/parameterUtils';

const text = (res: any): string => (res.content?.[0] as any)?.text || '';

// The exact instants observed on task tk_69txhSQfPDgkk8aWzDycx7.
// Under the old code these rendered as '8/7/2026, 4:15:00 AM' and
// '8/5/2026, 6:29:00 PM' — UTC wall-clock readings with no zone label.
const SCHEDULED_START = '2026-08-07T04:15:00.000Z'; // 09:45 Asia/Kolkata
const DUE_AT_UTC_EOD = '2026-08-10T23:59:59.000Z';  // 11 Aug in Asia/Kolkata
const IST = 'Asia/Kolkata';

describe('formatTimestamp', () => {
  it('always emits the ISO instant, offset intact', () => {
    expect(formatTimestamp(SCHEDULED_START)).toBe(SCHEDULED_START);
  });

  it('appends a zone-labelled local rendering when a zone is known', () => {
    expect(formatTimestamp(SCHEDULED_START, IST)).toBe(
      `${SCHEDULED_START} (2026-08-07 09:45:00 Asia/Kolkata)`
    );
  });

  it('never emits the unlabelled locale shape that caused the defect', () => {
    expect(formatTimestamp(SCHEDULED_START)).not.toMatch(LEGACY_LOCALE_SHAPE);
    expect(formatTimestamp(SCHEDULED_START, IST)).not.toMatch(LEGACY_LOCALE_SHAPE);
  });

  it('resolves a non-UTC zone without hardcoding any offset', () => {
    // Two zones, two different local readings, one identical instant.
    expect(formatTimestamp(SCHEDULED_START, 'America/New_York')).toContain('2026-08-07 00:15:00');
    expect(formatTimestamp(SCHEDULED_START, 'Asia/Tokyo')).toContain('2026-08-07 13:15:00');
    expect(formatTimestamp(SCHEDULED_START, 'America/New_York')).toContain(SCHEDULED_START);
  });

  it('honours DST transitions rather than a fixed offset', () => {
    // New York is UTC-4 in August, UTC-5 in January. A hardcoded offset fails this.
    expect(formatTimestamp('2026-01-15T12:00:00.000Z', 'America/New_York')).toContain('07:00:00');
    expect(formatTimestamp('2026-07-15T12:00:00.000Z', 'America/New_York')).toContain('08:00:00');
  });

  it('returns unparseable input verbatim instead of "Invalid Date"', () => {
    expect(formatTimestamp('not-a-date')).toBe('not-a-date');
    expect(formatTimestamp('not-a-date', IST)).toBe('not-a-date');
  });

  it('falls back to the ISO instant when the zone is unusable', () => {
    expect(formatTimestamp(SCHEDULED_START, 'Not/AZone')).toBe(SCHEDULED_START);
  });

  it('handles empty and absent values', () => {
    expect(formatTimestamp(undefined)).toBe('Not set');
    expect(formatTimestamp(null)).toBe('Not set');
    expect(formatTimestamp('')).toBe('Not set');
  });
});

describe('formatDateOnly', () => {
  it('reports the calendar date in the target zone, not in UTC', () => {
    // This is the off-by-one-day bug: 23:59:59Z on the 10th is the 11th in IST.
    expect(formatDateOnly(DUE_AT_UTC_EOD, IST)).toBe('2026-08-11 Asia/Kolkata');
  });

  it('labels the zone when none is supplied rather than implying local time', () => {
    expect(formatDateOnly(DUE_AT_UTC_EOD)).toBe('2026-08-10 UTC');
  });
});

describe('resolveDisplayTimeZone', () => {
  it('uses the zone when every schedule agrees', () => {
    expect(
      resolveDisplayTimeZone([
        { timezone: 'Asia/Kolkata' },
        { timezone: 'Asia/Kolkata' }
      ])
    ).toBe('Asia/Kolkata');
  });

  it('refuses to elect a winner when schedules disagree', () => {
    expect(
      resolveDisplayTimeZone([
        { timezone: 'Asia/Kolkata' },
        { timezone: 'America/New_York' }
      ])
    ).toBeUndefined();
  });

  it('returns undefined for empty, missing, or blank zones', () => {
    expect(resolveDisplayTimeZone([])).toBeUndefined();
    expect(resolveDisplayTimeZone(undefined)).toBeUndefined();
    expect(resolveDisplayTimeZone([{ timezone: '  ' }, { timezone: null }])).toBeUndefined();
  });

  it('rejects a zone the runtime cannot honour', () => {
    expect(resolveDisplayTimeZone([{ timezone: 'Mars/Olympus' }])).toBeUndefined();
  });
});

describe('task formatters — regression against the reported defect', () => {
  const task: any = {
    id: 'tk_test',
    name: 'Probe',
    status: 'Todo',
    priority: 'HIGH',
    completed: false,
    dueDate: DUE_AT_UTC_EOD,
    scheduledStart: SCHEDULED_START,
    scheduledEnd: '2026-08-07T04:30:00.000Z',
    createdTime: '2026-08-03T05:32:25.000Z',
    workspace: { id: 'w1', name: 'My Tasks' }
  };

  it('formatTaskDetail emits ISO instants and a labelled local time', () => {
    const out = text(formatTaskDetail(task, IST));

    expect(out).toContain(`Scheduled Start: ${SCHEDULED_START} (2026-08-07 09:45:00 Asia/Kolkata)`);
    expect(out).toContain('Scheduled End: 2026-08-07T04:30:00.000Z (2026-08-07 10:00:00 Asia/Kolkata)');
    expect(out).toContain(`Due Date: ${DUE_AT_UTC_EOD}`);
  });

  it('formatTaskDetail emits no unlabelled locale timestamps at all', () => {
    expect(text(formatTaskDetail(task, IST))).not.toMatch(LEGACY_LOCALE_SHAPE);
    expect(text(formatTaskDetail(task))).not.toMatch(LEGACY_LOCALE_SHAPE);
  });

  it('formatTaskDetail output does not depend on the host timezone', () => {
    // Every rendered instant is explicit, so the same input yields the same
    // string whatever TZ the Worker or test runner happens to be in.
    expect(text(formatTaskDetail(task, IST))).toContain(SCHEDULED_START);
    expect(text(formatTaskDetail(task))).toContain(SCHEDULED_START);
  });

  it('formatTaskList reports the due date on the correct local day', () => {
    const out = text(formatTaskList([task], { timeZone: IST }));

    expect(out).toContain('(Due: 2026-08-11 Asia/Kolkata)');
    expect(out).not.toContain('8/10/2026');
    expect(out).not.toMatch(LEGACY_LOCALE_SHAPE);
  });

  it('formatTaskList echoes the due-date filter verbatim in the title', () => {
    // A date-only filter string parsed as an instant is midnight UTC — the
    // previous calendar day in any zone behind UTC. Filter values are user
    // input, not instants, so they are echoed rather than parsed.
    const out = text(formatTaskList([task], { timeZone: 'America/New_York', dueDate: '2026-08-10' }));

    expect(out).toContain('due by 2026-08-10');
    expect(out).not.toContain('2026-08-09');

    const relative = text(formatTaskList([task], { timeZone: IST, dueDate: 'today' }));
    expect(relative).toContain('due by today');
  });
});

describe('zone-aware relative dates (parseFilterDate / normalizeDueDateForApi)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // 2026-08-06 20:00 UTC = 2026-08-07 01:30 in Asia/Kolkata — the exact window
  // where UTC-anchored resolution wrote yesterday's date.
  const IST_EARLY_MORNING = new Date('2026-08-06T20:00:00.000Z');

  it("resolves 'today' in the supplied zone, not UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(IST_EARLY_MORNING);

    expect(parseFilterDate('today', IST)).toBe('2026-08-07');
    expect(parseFilterDate('tomorrow', IST)).toBe('2026-08-08');
    expect(parseFilterDate('yesterday', IST)).toBe('2026-08-06');
  });

  it('keeps UTC resolution when no zone is supplied (legacy behavior)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(IST_EARLY_MORNING);

    expect(parseFilterDate('today')).toBe('2026-08-06');
  });

  it('works for zones behind UTC without hardcoding any offset', () => {
    vi.useFakeTimers();
    // 2026-08-07 02:00 UTC = 2026-08-06 22:00 in America/New_York
    vi.setSystemTime(new Date('2026-08-07T02:00:00.000Z'));

    expect(parseFilterDate('today', 'America/New_York')).toBe('2026-08-06');
    expect(parseFilterDate('today')).toBe('2026-08-07');
  });

  it('falls back to UTC resolution when the zone is unusable', () => {
    vi.useFakeTimers();
    vi.setSystemTime(IST_EARLY_MORNING);

    expect(parseFilterDate('today', 'Not/AZone')).toBe('2026-08-06');
  });

  it('leaves explicit dates untouched by the zone', () => {
    expect(parseFilterDate('2026-08-10', IST)).toBe('2026-08-10');
  });

  it("normalizeDueDateForApi stores end-of-day in the supplied zone (F10)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(IST_EARLY_MORNING);

    // The calendar day comes from the zone AND the stored instant is 23:59:59
    // local in that zone: 2026-08-07 23:59:59 IST == 2026-08-07T18:29:59Z.
    expect(normalizeDueDateForApi('today', IST)).toBe('2026-08-07T18:29:59.000Z');
    // Without a zone, it falls back to end-of-day UTC (legacy behavior).
    expect(normalizeDueDateForApi('today')).toBe('2026-08-06T23:59:59.000Z');
    // Full ISO input passes through byte-identical regardless of zone.
    expect(normalizeDueDateForApi('2026-08-05T18:29:00.000Z', IST)).toBe('2026-08-05T18:29:00.000Z');
  });

  it('stored due date renders back as the same calendar day in the account zone (F10)', () => {
    // A plain UTC end-of-day slips forward a day; a zone-anchored one does not.
    const stored = normalizeDueDateForApi('2026-08-10', IST);
    expect(stored).toBe('2026-08-10T18:29:59.000Z');
    expect(formatDateOnly(stored, IST)).toBe('2026-08-10 Asia/Kolkata');
  });
});

describe('endOfDayInZone', () => {
  it('anchors 23:59:59 to the wall clock of the given zone', () => {
    // IST is UTC+5:30 → 23:59:59 local is 18:29:59Z the same date.
    expect(endOfDayInZone('2026-08-10', 'Asia/Kolkata')).toBe('2026-08-10T18:29:59.000Z');
    // New York in August is UTC-4 → 23:59:59 local is 03:59:59Z the next date.
    expect(endOfDayInZone('2026-08-10', 'America/New_York')).toBe('2026-08-11T03:59:59.000Z');
  });

  it('returns null for a malformed date or an unusable zone', () => {
    expect(endOfDayInZone('not-a-date', 'Asia/Kolkata')).toBeNull();
    expect(endOfDayInZone('2026-08-10', 'Not/AZone')).toBeNull();
  });
});
