import { describe, it, expect, vi } from 'vitest';
import { UserHandler } from '../src/handlers';
import type { HandlerContext } from '../src/handlers/base/HandlerInterface';

function makeContext() {
  const motionService = {
    getUsers: vi.fn().mockResolvedValue([
      { id: 'u1', name: 'Alice', email: 'alice@example.com' },
      { id: 'u2', name: 'Bob', email: 'bob@example.com' },
    ]),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1', name: 'Alice', email: 'alice@example.com' }),
  } as any;

  const workspaceResolver = {
    resolveWorkspace: vi.fn().mockResolvedValue({ id: 'w1', name: 'Dev' }),
  } as any;

  const ctx: HandlerContext = {
    motionService,
    workspaceResolver,
    validator: {} as any,
  };
  return { ctx, motionService, workspaceResolver };
}

describe('UserHandler', () => {
  it('lists users for resolved workspace', async () => {
    const { ctx, motionService } = makeContext();
    const handler = new UserHandler(ctx);
    const res = await handler.handle({ operation: 'list', workspaceName: 'Dev' } as any);
    expect(motionService.getUsers).toHaveBeenCalledWith('w1', undefined);
    const text = (res.content?.[0] as any)?.text || '';
    expect(text).toContain('Users in workspace "Dev"');
    expect(text).toContain('Alice');
    expect(text).toContain('Bob');
  });

  it('returns current user info', async () => {
    const { ctx, motionService } = makeContext();
    const handler = new UserHandler(ctx);
    const res = await handler.handle({ operation: 'current' } as any);
    expect(motionService.getCurrentUser).toHaveBeenCalled();
    const text = (res.content?.[0] as any)?.text || '';
    expect(text).toContain('Current user: Alice');
  });

  it('renders missing emails as "no email"', async () => {
    const { ctx, motionService } = makeContext();
    motionService.getUsers.mockResolvedValueOnce([
      { id: 'u3', name: 'NoEmail User' },
    ]);
    motionService.getCurrentUser.mockResolvedValueOnce({ id: 'u3', name: 'NoEmail User' });
    const handler = new UserHandler(ctx);

    const listRes = await handler.handle({ operation: 'list', workspaceName: 'Dev' } as any);
    const listText = (listRes.content?.[0] as any)?.text || '';
    expect(listText).toContain('(no email)');
    expect(listText).not.toContain('(undefined)');

    const currentRes = await handler.handle({ operation: 'current' } as any);
    const currentText = (currentRes.content?.[0] as any)?.text || '';
    expect(currentText).toContain('(no email)');
    expect(currentText).not.toContain('(undefined)');
  });
});
