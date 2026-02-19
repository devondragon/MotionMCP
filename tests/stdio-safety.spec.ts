import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('MCP stdio safety', () => {
  /**
   * Regression test: dotenv v17 writes a banner to stdout by default,
   * which corrupts the MCP JSON-RPC stdio transport. The quiet:true flag
   * must be passed to dotenv.config() to suppress this.
   *
   * This was first fixed in c5185d5 then accidentally reverted in 669a2b0.
   */
  it('mcp-server.ts must call dotenv.config with quiet: true', () => {
    const serverSource = fs.readFileSync(
      path.resolve(__dirname, '../src/mcp-server.ts'),
      'utf-8'
    );

    // Verify quiet: true is present in the dotenv.config call
    expect(serverSource).toMatch(/dotenv\.config\(\s*\{[^}]*quiet:\s*true[^}]*\}\s*\)/);

    // Verify there is NO bare dotenv.config() call (without options)
    // Match dotenv.config() with empty parens, but NOT dotenv.config({...})
    const bareConfigCalls = serverSource.match(/dotenv\.config\(\s*\)/g);
    expect(bareConfigCalls).toBeNull();
  });

  it('dotenv.config({ quiet: true }) must not write to stdout', () => {
    const writes: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = (chunk: any, ...args: any[]) => {
      writes.push(String(chunk));
      return true;
    };

    try {
      // Re-import dotenv to test its behavior
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const dotenv = require('dotenv');
      dotenv.config({ quiet: true });
    } finally {
      process.stdout.write = origWrite;
    }

    const stdoutContent = writes.join('');
    expect(stdoutContent).toBe('');
  });

});
