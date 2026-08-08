import { describe, expect, it } from 'vitest';
import { formatCustomFieldSuccess, formatDetailResponse, formatTaskDetail, formatTaskList } from '../src/utils';
import type { MotionTask } from '../src/types/motion';

// Minimal MotionTask factory — override only the fields a test cares about.
function makeTask(overrides: Partial<MotionTask> = {}): MotionTask {
  return {
    id: 'task_1',
    name: 'Test Task',
    workspaceId: 'ws_1',
    status: { name: 'Todo', isDefaultStatus: true, isResolvedStatus: false },
    priority: 'MEDIUM',
    labels: [],
    completed: false,
    createdTime: '2026-08-01T00:00:00.000Z',
    workspace: { id: 'ws_1', name: 'Work', teamId: null, type: 'INDIVIDUAL' },
    ...overrides
  } as MotionTask;
}

describe('responseFormatters', () => {
  it('formats detail response with all fields when field list is omitted', () => {
    const res = formatDetailResponse(
      { id: 'p1', name: 'Project A', workspaceId: 'w1' },
      'Project details for "Project A"'
    );
    const text = (res.content?.[0] as any)?.text || '';

    expect(text).toContain('- Id: p1');
    expect(text).toContain('- Name: Project A');
    expect(text).toContain('- WorkspaceId: w1');
  });

  it('does not render remove_from_undefined tips', () => {
    const res = formatCustomFieldSuccess('added', undefined, undefined, {
      id: 'val_1',
      type: 'text',
      value: 'hello'
    });
    const text = (res.content?.[0] as any)?.text || '';

    expect(text).not.toContain('remove_from_undefined');
    expect(text).toContain('Value ID: val_1');
  });

  describe('formatTaskDetail scheduling fields', () => {
    it('renders schedulingIssue and startOn in the text', () => {
      const res = formatTaskDetail(makeTask({
        startOn: '2026-08-10T00:00:00.000Z',
        schedulingIssue: true
      }));
      const text = (res.content?.[0] as any)?.text || '';

      expect(text).toContain('Start On:');
      expect(text).toContain('Scheduling Issue: Yes');
    });

    it('lists each chunk with start and end times', () => {
      const res = formatTaskDetail(makeTask({
        chunks: [
          { id: 'c1', duration: 30, scheduledStart: '2026-08-10T14:00:00.000Z', scheduledEnd: '2026-08-10T14:30:00.000Z', isFixed: false },
          { id: 'c2', duration: 30, scheduledStart: '2026-08-11T09:00:00.000Z', scheduledEnd: '2026-08-11T09:30:00.000Z', isFixed: true }
        ]
      }));
      const text = (res.content?.[0] as any)?.text || '';

      expect(text).toContain('Scheduled Chunks: 2 time block(s)');
      expect(text).toContain('Chunk 1:');
      expect(text).toContain('Chunk 2:');
      expect(text).toContain('(fixed)');
    });

    it('attaches structuredContent with the expected keys and raw ISO timestamps', () => {
      const res = formatTaskDetail(makeTask({
        dueDate: '2026-08-15T17:00:00.000Z',
        deadlineType: 'HARD',
        duration: 60,
        scheduledStart: '2026-08-14T14:00:00.000Z',
        scheduledEnd: '2026-08-14T15:00:00.000Z',
        startOn: '2026-08-10T00:00:00.000Z',
        schedulingIssue: false,
        labels: ['urgent', { name: 'q3' }]
      }));
      const sc = res.structuredContent as Record<string, any>;

      expect(sc).toBeDefined();
      for (const key of ['id', 'name', 'dueDate', 'deadlineType', 'duration',
        'scheduledStart', 'scheduledEnd', 'schedulingIssue', 'startOn', 'labels', 'chunks']) {
        expect(sc).toHaveProperty(key);
      }
      // Timestamps are passed through raw (ISO 8601), not localized
      expect(sc.dueDate).toBe('2026-08-15T17:00:00.000Z');
      expect(sc.scheduledEnd).toBe('2026-08-14T15:00:00.000Z');
      // Labels normalized to plain strings regardless of source shape
      expect(sc.labels).toEqual(['urgent', 'q3']);
      expect(sc.schedulingIssue).toBe(false);
    });

    it('keeps the channels separate: readable text in content, fields in structuredContent', () => {
      const res = formatTaskDetail(makeTask({ name: 'Readable Task', schedulingIssue: true }));
      const text = (res.content?.[0] as any)?.text || '';
      const sc = res.structuredContent as Record<string, any>;

      // content is a plain-text block, not JSON
      expect(text).toContain('Task: Readable Task');
      expect(text).toContain('Scheduling Issue: Yes');
      // structuredContent holds the fields — and does NOT duplicate the prose
      expect(sc.summary).toBeUndefined();
      expect(sc.schedulingIssue).toBe(true);
      expect(sc.id).toBe('task_1');
    });

    it('renders startOn as a plain date, not a timezone-shifted timestamp', () => {
      const res = formatTaskDetail(makeTask({ startOn: '2026-08-31' }));
      const text = (res.content?.[0] as any)?.text || '';
      const startOnLine = text.split('\n').find((l: string) => l.startsWith('Start On:'));

      // Built from date parts, so the calendar day survives in zones behind UTC
      // (naive `new Date("2026-08-31")` would render as Aug 30, 8:00 PM in US Eastern).
      const expected = new Date(2026, 7, 31).toLocaleDateString();
      expect(startOnLine).toBe(`Start On: ${expected}`);
      // No time-of-day component
      expect(startOnLine).not.toMatch(/\d:\d\d/);
      // structuredContent still carries the raw ISO value
      expect((res.structuredContent as any).startOn).toBe('2026-08-31');
    });

    it('surfaces schedulingIssue: true for a task Motion could not fit (no scheduledEnd)', () => {
      const res = formatTaskDetail(makeTask({
        dueDate: '2026-08-15T17:00:00.000Z',
        schedulingIssue: true
        // no scheduledStart / scheduledEnd — the unschedulable case
      }));
      const sc = res.structuredContent as Record<string, any>;

      expect(sc.schedulingIssue).toBe(true);
      expect(sc.scheduledEnd).toBeNull();
    });
  });

  describe('formatTaskList scheduling fields', () => {
    it('includes scheduledEnd, startOn, and a scheduling-issue marker per line', () => {
      const res = formatTaskList([
        makeTask({ id: 't1', name: 'Fits', scheduledEnd: '2026-08-14T15:00:00.000Z', startOn: '2026-08-10T00:00:00.000Z' }),
        makeTask({ id: 't2', name: 'Cannot fit', schedulingIssue: true })
      ]);
      const text = (res.content?.[0] as any)?.text || '';

      expect(text).toContain('Scheduled End:');
      expect(text).toContain('Start On:');
      expect(text).toContain('[SCHEDULING ISSUE]');
    });

    it('attaches structuredContent with count and a per-task projection', () => {
      const res = formatTaskList([
        makeTask({ id: 't1', name: 'A' }),
        makeTask({ id: 't2', name: 'B', schedulingIssue: true })
      ]);
      const sc = res.structuredContent as Record<string, any>;

      expect(sc.count).toBe(2);
      expect(Array.isArray(sc.tasks)).toBe(true);
      expect(sc.tasks[0].id).toBe('t1');
      expect(sc.tasks[1].schedulingIssue).toBe(true);
    });

    it('stays lean — no prose duplicated into structuredContent', () => {
      const res = formatTaskList([makeTask({ id: 't1' }), makeTask({ id: 't2' })]);
      const sc = res.structuredContent as Record<string, any>;

      expect(sc.summary).toBeUndefined();
      expect(sc.tasks[0].summary).toBeUndefined();
    });

    it('renders startOn as a plain date in list lines too', () => {
      const res = formatTaskList([makeTask({ id: 't1', startOn: '2026-08-31' })]);
      const text = (res.content?.[0] as any)?.text || '';

      const expected = new Date(2026, 7, 31).toLocaleDateString();
      expect(text).toContain(`(Start On: ${expected})`);
    });
  });
});
