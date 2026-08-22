/**
 * Ambiguous case-insensitive match coverage for WorkspaceResolver (issue #136).
 *
 * When no exact name match exists and multiple workspaces differ only by case,
 * resolveByWorkspaceName returns the FIRST case-insensitive match and logs a
 * WARN. This pins both halves: the warning is emitted and the first match is
 * still returned. mcpLog writes JSON to console.error, so each test captures
 * console.error payloads into a fresh local array (setup.ts installs its own
 * non-restored console.error spy, so reading spy.mock.calls would leak calls
 * across tests).
 */
import { describe, it, expect, vi } from 'vitest';
import { WorkspaceResolver } from '../src/utils/workspaceResolver';

function makeService(workspaces: Array<{ id: string; name: string }>) {
  return {
    getWorkspaces: vi.fn(async () => workspaces)
  } as any;
}

/** Capture mcpLog's JSON lines into a local array for the duration of one test. */
function captureLogs() {
  const raw: string[] = [];
  vi.spyOn(console, 'error').mockImplementation((arg?: unknown) => {
    raw.push(String(arg));
  });
  return () =>
    raw
      .map(line => {
        try {
          return JSON.parse(line) as Record<string, any>;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is Record<string, any> => entry !== null);
}

describe('WorkspaceResolver ambiguous case-insensitive match', () => {
  it('returns the first match and logs an ambiguity warning', async () => {
    const readLogs = captureLogs();
    const workspaces = [
      { id: 'ws-first', name: 'Marketing' },
      { id: 'ws-second', name: 'marketing' }
    ];
    const resolver = new WorkspaceResolver(makeService(workspaces));

    // 'MARKETING' has no exact match, so resolution falls to the
    // case-insensitive branch where both workspaces qualify.
    const resolved = await resolver.resolveWorkspace({ workspaceName: 'MARKETING' });

    expect(resolved.id).toBe('ws-first');

    const warnings = readLogs().filter(
      entry => entry.level === 'warn' && entry.msg === 'Ambiguous case-insensitive workspace match'
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].candidates).toEqual([
      { id: 'ws-first', name: 'Marketing' },
      { id: 'ws-second', name: 'marketing' }
    ]);
  });

  it('does not warn when an exact match exists even if a case variant is present', async () => {
    const readLogs = captureLogs();
    const workspaces = [
      { id: 'ws-exact', name: 'Marketing' },
      { id: 'ws-variant', name: 'marketing' }
    ];
    const resolver = new WorkspaceResolver(makeService(workspaces));

    const resolved = await resolver.resolveWorkspace({ workspaceName: 'Marketing' });

    expect(resolved.id).toBe('ws-exact');
    const warnings = readLogs().filter(
      entry => entry.msg === 'Ambiguous case-insensitive workspace match'
    );
    expect(warnings).toHaveLength(0);
  });
});
