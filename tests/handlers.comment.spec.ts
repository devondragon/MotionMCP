import { describe, it, expect, vi } from 'vitest';
import { CommentHandler } from '../src/handlers';
import type { HandlerContext } from '../src/handlers/base/HandlerInterface';

function makeContext() {
  const motionService = {
    getComments: vi.fn().mockResolvedValue({
      data: [
        { id: 'c1', taskId: 't1', content: 'Hi', createdAt: '2024-01-01T00:00:00Z', creator: { id: 'u1', name: 'U', email: 'u@example.com' } },
      ],
      meta: { nextCursor: 'next', pageSize: 1 },
    }),
    createComment: vi.fn().mockResolvedValue({ id: 'c2', taskId: 't1', content: 'Hello', createdAt: '2024-01-01T00:00:00Z', creator: { id: 'u1', name: 'U', email: 'u@example.com' } }),
  } as any;

  const ctx: HandlerContext = {
    motionService,
    workspaceResolver: {} as any,
    validator: {} as any,
  };
  return { ctx, motionService };
}

describe('CommentHandler', () => {
  it('lists comments and appends nextCursor note', async () => {
    const { ctx } = makeContext();
    const handler = new CommentHandler(ctx);
    const res = await handler.handle({ operation: 'list', taskId: 't1' } as any);
    const text = (res.content?.[0] as any)?.text || '';
    expect(text).toContain('Found 1 comment');
    expect(text).toContain('More comments available. Use cursor: next');
  });

  it('creates a sanitized comment successfully', async () => {
    const { ctx, motionService } = makeContext();
    const handler = new CommentHandler(ctx);
    const res = await handler.handle({ operation: 'create', taskId: 't1', content: '<b>Hello</b>' } as any);
    const text = (res.content?.[0] as any)?.text || '';
    expect(motionService.createComment).toHaveBeenCalled();
    expect(text).toContain('Comment created successfully');
  });

  it('falls back to creator id when creator profile fields are missing', async () => {
    const { ctx, motionService } = makeContext();
    motionService.getComments.mockResolvedValueOnce({
      data: [
        {
          id: 'c3',
          taskId: 't1',
          content: 'Creator id only',
          createdAt: '2024-01-01T00:00:00Z',
          creator: { id: 'u2' }
        },
      ],
      meta: { nextCursor: undefined, pageSize: 1 },
    });
    motionService.createComment.mockResolvedValueOnce({
      id: 'c4',
      taskId: 't1',
      content: 'Creator id only',
      createdAt: '2024-01-01T00:00:00Z',
      creator: { id: 'u3' }
    });
    const handler = new CommentHandler(ctx);

    const listRes = await handler.handle({ operation: 'list', taskId: 't1' } as any);
    const listText = (listRes.content?.[0] as any)?.text || '';
    expect(listRes.isError).toBeFalsy();
    expect(listText).toContain('Author: u2');

    const createRes = await handler.handle({ operation: 'create', taskId: 't1', content: 'hello' } as any);
    const createText = (createRes.content?.[0] as any)?.text || '';
    expect(createRes.isError).toBeFalsy();
    expect(createText).toContain('- Author: u3');
  });
});
