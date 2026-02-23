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
    it('lists all schedules', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new ScheduleHandler(ctx);
      const args: MotionSchedulesArgs = {};

      const res = await handler.handle(args);

      expect(motionService.getSchedules).toHaveBeenCalledWith();
      expect(res.isError).toBeFalsy();
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('Work Hours');
      expect(text).toContain('Personal Time');
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
