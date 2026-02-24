import { describe, it, expect, vi } from 'vitest';
import { ProjectHandler } from '../src/handlers';
import type { HandlerContext } from '../src/handlers/base/HandlerInterface';

function makeContext(overrides: Partial<HandlerContext> = {}): HandlerContext {
  const motionService = {
    createProject: vi.fn().mockResolvedValue({ id: 'p1', name: 'Proj' }),
    getProjects: vi.fn().mockResolvedValue({
      items: [
        { id: 'p1', name: 'A', description: '', workspaceId: 'w1' },
        { id: 'p2', name: 'B', description: '', workspaceId: 'w1' },
      ],
      truncation: undefined,
    }),
    getProject: vi.fn().mockResolvedValue({ id: 'p1', name: 'A', description: '', workspaceId: 'w1' }),
  } as any;

  const workspaceResolver = {
    resolveWorkspace: vi.fn().mockResolvedValue({ id: 'w1', name: 'Dev' })
  } as any;

  const validator = {} as any;

  return {
    motionService,
    workspaceResolver,
    validator,
    ...overrides,
  } as HandlerContext;
}

describe('ProjectHandler', () => {
  it('creates a project using resolved workspace', async () => {
    const ctx = makeContext();
    const handler = new ProjectHandler(ctx);
    const res = await handler.handle({ operation: 'create', name: 'Proj', workspaceName: 'Dev' } as any);

    expect(ctx.workspaceResolver.resolveWorkspace).toHaveBeenCalled();
    expect(ctx.motionService.createProject).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Proj',
      workspaceId: 'w1',
    }));
    expect(ctx.motionService.createProject.mock.calls[0][0]).not.toHaveProperty('workspaceName');

    const text = (res.content?.[0] as any)?.text || '';
    expect(text).toContain('Successfully created project');
  });

  it('lists projects and includes workspace name in text', async () => {
    const ctx = makeContext();
    const handler = new ProjectHandler(ctx);
    const res = await handler.handle({ operation: 'list', workspaceName: 'Dev' } as any);
    expect(ctx.motionService.getProjects).toHaveBeenCalledWith('w1');
    const text = (res.content?.[0] as any)?.text || '';
    expect(text).toContain('Found 2 projects in workspace "Dev"');
    expect(text).toContain('(ID: p1)');
    expect(text).toContain('(ID: p2)');
  });

  it('gets project details with populated fields', async () => {
    const ctx = makeContext();
    const handler = new ProjectHandler(ctx);
    const res = await handler.handle({ operation: 'get', projectId: 'p1' } as any);

    expect(ctx.motionService.getProject).toHaveBeenCalledWith('p1');
    const text = (res.content?.[0] as any)?.text || '';
    expect(text).toContain('Project details for "A" Details:');
    expect(text).toContain('- Id: p1');
    expect(text).toContain('- Name: A');
    expect(text).toContain('- WorkspaceId: w1');
  });
});
