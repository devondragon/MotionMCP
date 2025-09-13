import { describe, it, expect, vi } from 'vitest';
import { WorkspaceHandler } from '../src/handlers';
import type { HandlerContext } from '../src/handlers/base/HandlerInterface';

function makeContext(): HandlerContext {
  const motionService = {
    getWorkspaces: vi.fn().mockResolvedValue([
      { id: 'w1', name: 'Personal', teamId: null, type: 'personal', labels: [] },
      { id: 'w2', name: 'Team', teamId: 't1', type: 'team', labels: [] },
    ]),
  } as any;

  const ctx = {
    motionService,
    workspaceResolver: {} as any,
    validator: {} as any,
  } as HandlerContext;
  return ctx;
}

describe('WorkspaceHandler', () => {
  it('lists workspaces and formats response', async () => {
    const ctx = makeContext();
    const handler = new WorkspaceHandler(ctx);
    const res = await handler.handle({ operation: 'list' } as any);
    const text = (res.content?.[0] as any)?.text || '';
    expect(text).toContain('Available workspaces (2)');
    expect(text).toContain('(ID: w1)');
    expect(text).toContain('(ID: w2)');
  });
});

