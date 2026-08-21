import { describe, expect, it } from 'vitest';
import { formatCustomFieldSuccess, formatDetailResponse, formatTaskDetail, formatTaskList, taskToStructuredContent } from '../src/utils';
import { formatMcpSuccess } from '../src/utils/errors';
import { MotionTask } from '../src/types/motion';

function makeTask(overrides: Partial<MotionTask> = {}): MotionTask {
  return {
    id: 'task-1',
    name: 'Test Task',
    workspaceId: 'ws-1',
    status: { name: 'In Progress', isDefaultStatus: false, isResolvedStatus: false },
    priority: 'HIGH',
    completed: false,
    createdTime: '2026-08-10T14:00:00.000Z',
    labels: [],
    workspace: { id: 'ws-1', name: 'My Workspace', teamId: null, type: 'TEAM' },
    ...overrides,
  };
}

function textOf(result: ReturnType<typeof formatMcpSuccess>): string {
  return (result.content?.[0] as any)?.text || '';
}

describe('responseFormatters', () => {
  it('formats detail response with all fields when field list is omitted', () => {
    const res = formatDetailResponse(
      { id: 'p1', name: 'Project A', workspaceId: 'w1' },
      'Project details for "Project A"'
    );
    const text = textOf(res);

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
    const text = textOf(res);

    expect(text).not.toContain('remove_from_undefined');
    expect(text).toContain('Value ID: val_1');
  });
});

describe('formatMcpSuccess', () => {
  it('returns text-only result when structuredContent is omitted', () => {
    const result = formatMcpSuccess('hello');
    expect(textOf(result)).toBe('hello');
    expect(result.structuredContent).toBeUndefined();
  });

  it('attaches structuredContent when provided', () => {
    const sc = { foo: 'bar', n: 42 };
    const result = formatMcpSuccess('hello', sc);
    expect(textOf(result)).toBe('hello');
    expect(result.structuredContent).toEqual(sc);
  });
});

describe('taskToStructuredContent', () => {
  it('carries raw ISO timestamps without formatting', () => {
    const task = makeTask({
      dueDate: '2026-08-15T23:59:00.000Z',
      startOn: '2026-08-11',
      scheduledStart: '2026-08-12T09:00:00.000Z',
      scheduledEnd: '2026-08-12T10:30:00.000Z',
      schedulingIssue: false,
    });

    const sc = taskToStructuredContent(task);
    expect(sc.id).toBe('task-1');
    expect(sc.dueDate).toBe('2026-08-15T23:59:00.000Z');
    expect(sc.startOn).toBe('2026-08-11');
    expect(sc.scheduledStart).toBe('2026-08-12T09:00:00.000Z');
    expect(sc.scheduledEnd).toBe('2026-08-12T10:30:00.000Z');
    expect(sc.schedulingIssue).toBe(false);
  });

  it('nullifies absent optional fields', () => {
    const task = makeTask();
    const sc = taskToStructuredContent(task);
    expect(sc.dueDate).toBeNull();
    expect(sc.startOn).toBeNull();
    expect(sc.scheduledStart).toBeNull();
    expect(sc.scheduledEnd).toBeNull();
    expect(sc.schedulingIssue).toBeNull();
    expect(sc.completedTime).toBeNull();
    expect(sc.chunks).toEqual([]);
  });

  it('projects chunks with ?? null for stable serialization', () => {
    const task = makeTask({
      chunks: [
        { id: 'c1', duration: 30, scheduledStart: '2026-08-12T09:00:00.000Z', scheduledEnd: '2026-08-12T09:30:00.000Z', isFixed: false },
        { id: 'c2', duration: 60, scheduledStart: '2026-08-13T14:00:00.000Z', scheduledEnd: '2026-08-13T15:00:00.000Z', completedTime: '2026-08-13T14:45:00.000Z', isFixed: true },
      ],
    });

    const sc = taskToStructuredContent(task);
    const chunks = sc.chunks as any[];
    expect(chunks).toHaveLength(2);
    expect(chunks[0].completedTime).toBeNull();
    expect(chunks[1].completedTime).toBe('2026-08-13T14:45:00.000Z');
    expect(chunks[1].isFixed).toBe(true);
  });
});

describe('formatTaskDetail', () => {
  it('includes startOn in text output (zone-aware)', () => {
    const task = makeTask({ startOn: '2026-08-11T00:00:00.000Z' });
    const text = textOf(formatTaskDetail(task, 'America/New_York'));
    expect(text).toContain('Start On:');
    expect(text).toContain('America/New_York');
  });

  it('includes scheduling issue marker', () => {
    const task = makeTask({ schedulingIssue: true });
    const text = textOf(formatTaskDetail(task));
    expect(text).toContain('Scheduling Issue: Yes');
  });

  it('omits scheduling issue line when false or absent', () => {
    expect(textOf(formatTaskDetail(makeTask({ schedulingIssue: false })))).not.toContain('Scheduling Issue');
    expect(textOf(formatTaskDetail(makeTask()))).not.toContain('Scheduling Issue');
  });

  it('renders per-chunk start/end times with zone', () => {
    const task = makeTask({
      chunks: [
        { id: 'c1', duration: 30, scheduledStart: '2026-08-12T13:00:00.000Z', scheduledEnd: '2026-08-12T13:30:00.000Z', isFixed: false },
        { id: 'c2', duration: 60, scheduledStart: '2026-08-13T18:00:00.000Z', scheduledEnd: '2026-08-13T19:00:00.000Z', isFixed: true },
      ],
    });
    const text = textOf(formatTaskDetail(task, 'America/New_York'));
    expect(text).toContain('Scheduled Chunks (2):');
    expect(text).toContain('30 min');
    expect(text).toContain('60 min, fixed');
    expect(text).toContain('America/New_York');
  });

  it('attaches structuredContent with raw ISO timestamps', () => {
    const task = makeTask({
      dueDate: '2026-08-15T23:59:00.000Z',
      startOn: '2026-08-11',
      scheduledStart: '2026-08-12T09:00:00.000Z',
      scheduledEnd: '2026-08-12T10:30:00.000Z',
    });
    const result = formatTaskDetail(task, 'Asia/Kolkata');
    expect(result.structuredContent).toBeDefined();
    expect(result.structuredContent!.id).toBe('task-1');
    expect(result.structuredContent!.dueDate).toBe('2026-08-15T23:59:00.000Z');
    expect(result.structuredContent!.startOn).toBe('2026-08-11');
  });

  it('uses dateFormat.ts formatters, not toLocaleString', () => {
    const task = makeTask({
      dueDate: '2026-08-10T23:59:59.000Z',
      startOn: '2026-08-11T00:00:00.000Z',
    });
    const text = textOf(formatTaskDetail(task, 'Asia/Kolkata'));
    expect(text).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4},\s+\d{1,2}:\d{2}:\d{2}\s*(AM|PM)/);
    expect(text).toContain('Asia/Kolkata');
  });

  it('handles unschedulable task (schedulingIssue: true, no chunks, no scheduledStart)', () => {
    const task = makeTask({
      schedulingIssue: true,
      scheduledStart: undefined,
      scheduledEnd: undefined,
      chunks: undefined,
    });
    const text = textOf(formatTaskDetail(task));
    expect(text).toContain('Scheduling Issue: Yes');
    expect(text).not.toContain('Scheduled Start');
    expect(text).not.toContain('Scheduled End');
    expect(text).not.toContain('Scheduled Chunks');
  });
});

describe('formatTaskList', () => {
  it('includes startOn per task line', () => {
    const tasks = [makeTask({ startOn: '2026-08-11T00:00:00.000Z' })];
    const text = textOf(formatTaskList(tasks, { timeZone: 'America/New_York' }));
    expect(text).toContain('(Start:');
    expect(text).toContain('America/New_York');
  });

  it('includes scheduledEnd per task line', () => {
    const tasks = [makeTask({ scheduledEnd: '2026-08-12T17:00:00.000Z' })];
    const text = textOf(formatTaskList(tasks, { timeZone: 'America/New_York' }));
    expect(text).toContain('(Scheduled End:');
  });

  it('shows [SCHEDULING ISSUE] marker for unschedulable tasks', () => {
    const tasks = [makeTask({ schedulingIssue: true })];
    const text = textOf(formatTaskList(tasks));
    expect(text).toContain('[SCHEDULING ISSUE]');
  });

  it('omits scheduling issue marker when false', () => {
    const tasks = [makeTask({ schedulingIssue: false })];
    const text = textOf(formatTaskList(tasks));
    expect(text).not.toContain('[SCHEDULING ISSUE]');
  });

  it('attaches structuredContent with tasks array', () => {
    const tasks = [
      makeTask({ id: 't1', startOn: '2026-08-11' }),
      makeTask({ id: 't2', schedulingIssue: true }),
    ];
    const result = formatTaskList(tasks);
    expect(result.structuredContent).toBeDefined();
    const scTasks = result.structuredContent!.tasks as any[];
    expect(scTasks).toHaveLength(2);
    expect(scTasks[0].id).toBe('t1');
    expect(scTasks[0].startOn).toBe('2026-08-11');
    expect(scTasks[1].id).toBe('t2');
    expect(scTasks[1].schedulingIssue).toBe(true);
  });

  it('uses dateFormat.ts formatters, not toLocaleString', () => {
    const tasks = [makeTask({ dueDate: '2026-08-10T23:59:59.000Z' })];
    const text = textOf(formatTaskList(tasks, { timeZone: 'Asia/Kolkata' }));
    expect(text).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4},\s+\d{1,2}:\d{2}:\d{2}\s*(AM|PM)/);
  });
});
