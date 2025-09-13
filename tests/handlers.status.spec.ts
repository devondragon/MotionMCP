import { describe, it, expect, vi } from 'vitest';
import { StatusHandler } from '../src/handlers';
import type { HandlerContext } from '../src/handlers/base/HandlerInterface';

function makeContext() {
  const motionService = {
    getStatuses: vi.fn().mockResolvedValue([
      { name: 'Open', isDefaultStatus: true, isResolvedStatus: false },
      { name: 'Done', isDefaultStatus: false, isResolvedStatus: true },
    ]),
  } as any;

  const ctx: HandlerContext = {
    motionService,
    workspaceResolver: {} as any,
    validator: {} as any,
  };
  return { ctx, motionService };
}

describe('StatusHandler', () => {
  it('lists statuses and formats response', async () => {
    const { ctx, motionService } = makeContext();
    const handler = new StatusHandler(ctx);
    const res = await handler.handle({} as any);
    expect(motionService.getStatuses).toHaveBeenCalled();
    const text = (res.content?.[0] as any)?.text || '';
    expect(text).toContain('Open');
    expect(text).toContain('Done');
  });
});

