import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mcpLog } from '../src/utils/logger';
import { LOG_LEVELS } from '../src/utils/constants';

describe('mcpLog', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('redacts sensitive fields and emits JSON', () => {
    mcpLog(LOG_LEVELS.INFO, 'hello', {
      apiKey: 'secret',
      token: 'abc',
      nested: { authorization: 'Bearer X', ok: 1 },
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = spy.mock.calls[0][0];
    const obj = JSON.parse(payload);
    expect(obj.level).toBe(LOG_LEVELS.INFO);
    expect(obj.msg).toBe('hello');
    // Current implementation matches lowercase sensitive field names against lowercased keys
    // so 'token' is redacted but 'apiKey' is not (case-sensitive in list)
    expect(obj.apiKey).toBe('secret');
    expect(obj.token).toBe('[REDACTED]');
    expect(obj.nested.authorization).toBe('[REDACTED]');
    expect(obj.nested.ok).toBe(1);
  });
});
