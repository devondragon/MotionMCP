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
    expect(motionService.getStatuses).toHaveBeenCalledWith(undefined);
    const text = (res.content?.[0] as any)?.text || '';
    expect(text).toContain('Open');
    expect(text).toContain('Done');
  });

  it('passes a supplied workspaceId straight through', async () => {
    const { ctx, motionService } = makeContext();
    const handler = new StatusHandler(ctx);
    await handler.handle({ workspaceId: 'ws1' } as any);
    expect(motionService.getStatuses).toHaveBeenCalledWith('ws1');
  });

  it('resolves a workspaceName to an ID before listing', async () => {
    const { ctx, motionService } = makeContext();
    const resolveWorkspace = vi.fn().mockResolvedValue({ id: 'ws-resolved', name: 'Dev' });
    ctx.workspaceResolver = { resolveWorkspace } as any;
    const handler = new StatusHandler(ctx);

    await handler.handle({ workspaceName: 'Dev' } as any);

    expect(resolveWorkspace).toHaveBeenCalledWith({ workspaceName: 'Dev' });
    expect(motionService.getStatuses).toHaveBeenCalledWith('ws-resolved');
  });
});

