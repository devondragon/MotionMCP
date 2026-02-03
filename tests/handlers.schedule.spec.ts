import { describe, it, expect, vi } from 'vitest';
import { ScheduleHandler } from '../src/handlers';
import type { HandlerContext } from '../src/handlers/base/HandlerInterface';
import type { MotionSchedulesArgs } from '../src/types/mcp-tool-args';

function makeContext() {
  const motionService = {
    getSchedules: vi.fn().mockResolvedValue([
      {
        id: 'sch1',
        name: 'Work Hours',
        start: '09:00',
        end: '17:00',
        timezone: 'America/New_York',
      },
      {
        id: 'sch2',
        name: 'Personal Time',
        start: '18:00',
        end: '22:00',
        timezone: 'America/New_York',
      },
    ]),
  } as any;

  const ctx: HandlerContext = {
    motionService,
    workspaceResolver: {} as any,
    validator: {} as any,
  };
  return { ctx, motionService };
}

describe('ScheduleHandler', () => {
  describe('list operation', () => {
    it('lists all schedules without filters', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new ScheduleHandler(ctx);
      const args: MotionSchedulesArgs = {};

      const res = await handler.handle(args);

      expect(motionService.getSchedules).toHaveBeenCalledWith(undefined, undefined, undefined);
      expect(res.isError).toBeFalsy();
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('Work Hours');
      expect(text).toContain('Personal Time');
    });

    it('lists schedules with userId filter', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new ScheduleHandler(ctx);
      const args: MotionSchedulesArgs = { userId: 'user1' };

      const res = await handler.handle(args);

      expect(motionService.getSchedules).toHaveBeenCalledWith('user1', undefined, undefined);
      expect(res.isError).toBeFalsy();
    });

    it('lists schedules with date range', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new ScheduleHandler(ctx);
      const args: MotionSchedulesArgs = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      const res = await handler.handle(args);

      expect(motionService.getSchedules).toHaveBeenCalledWith(undefined, '2024-01-01', '2024-01-31');
      expect(res.isError).toBeFalsy();
    });

    it('lists schedules with all filters', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new ScheduleHandler(ctx);
      const args: MotionSchedulesArgs = {
        userId: 'user1',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      const res = await handler.handle(args);

      expect(motionService.getSchedules).toHaveBeenCalledWith('user1', '2024-01-01', '2024-01-31');
      expect(res.isError).toBeFalsy();
    });

    it('accepts ISO datetime format for dates', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new ScheduleHandler(ctx);
      const args: MotionSchedulesArgs = {
        startDate: '2024-01-15T10:30:00Z',
        endDate: '2024-01-20T15:00:00Z',
      };

      const res = await handler.handle(args);

      expect(motionService.getSchedules).toHaveBeenCalledWith(
        undefined,
        '2024-01-15T10:30:00Z',
        '2024-01-20T15:00:00Z'
      );
      expect(res.isError).toBeFalsy();
    });
  });

  describe('date validation', () => {
    it('returns error for invalid startDate', async () => {
      const { ctx } = makeContext();
      const handler = new ScheduleHandler(ctx);
      const args: MotionSchedulesArgs = {
        startDate: 'not-a-date',
      };

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('startDate');
      expect(text).toContain('valid date');
    });

    it('returns error for invalid endDate', async () => {
      const { ctx } = makeContext();
      const handler = new ScheduleHandler(ctx);
      const args: MotionSchedulesArgs = {
        endDate: 'invalid',
      };

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('endDate');
      expect(text).toContain('valid date');
    });

    it('returns error when startDate is after endDate', async () => {
      const { ctx } = makeContext();
      const handler = new ScheduleHandler(ctx);
      const args: MotionSchedulesArgs = {
        startDate: '2024-01-31',
        endDate: '2024-01-01',
      };

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('startDate must be before');
    });

    it('allows startDate equal to endDate', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new ScheduleHandler(ctx);
      const args: MotionSchedulesArgs = {
        startDate: '2024-01-15',
        endDate: '2024-01-15',
      };

      const res = await handler.handle(args);

      expect(motionService.getSchedules).toHaveBeenCalled();
      expect(res.isError).toBeFalsy();
    });
  });

  describe('error handling', () => {
    it('handles service errors gracefully', async () => {
      const { ctx, motionService } = makeContext();
      motionService.getSchedules.mockRejectedValue(new Error('API error'));
      const handler = new ScheduleHandler(ctx);
      const args: MotionSchedulesArgs = {};

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('API error');
    });
  });
});
