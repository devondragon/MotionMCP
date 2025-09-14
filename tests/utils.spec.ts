import { describe, it, expect } from 'vitest';

import { createMinimalPayload } from '../src/utils/constants';
import { sanitizeTextContent } from '../src/utils/sanitize';

describe('utils', () => {
  it('createMinimalPayload removes null/empty values and preserves meaningful ones', () => {
    const input = {
      a: null,
      b: undefined as unknown as string,
      c: '',
      d: [],
      e: {},
      f: 0,
      g: false,
      h: 'text',
      i: [1],
      j: { k: 1 },
    } as Record<string, any>;

    const result = createMinimalPayload(input);

    expect(result).toEqual({
      f: 0,
      g: false,
      h: 'text',
      i: [1],
      j: { k: 1 },
    });
  });

  it('sanitizeTextContent strips scripts and HTML while preserving text', () => {
    const input = 'Hello <script>alert(1)</script><b>World</b> & more';
    const sanitized = sanitizeTextContent(input);
    expect(sanitized).toContain('Hello');
    expect(sanitized).toContain('World');
    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('<b>');
    // Ensure ampersand is escaped
    expect(sanitized).toContain('&amp; more');
  });
});

