import { describe, it, expect } from 'vitest';
import {
  sanitizeTextContent,
  isValidSanitizedContent,
  sanitizeCommentContent,
  sanitizeDescription,
  sanitizeName
} from '../../src/utils/sanitize';

describe('sanitizeTextContent', () => {
  describe('null/undefined/empty handling', () => {
    it('returns empty string for null', () => {
      expect(sanitizeTextContent(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(sanitizeTextContent(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(sanitizeTextContent('')).toBe('');
    });

    it('returns empty string for whitespace-only input', () => {
      expect(sanitizeTextContent('   ')).toBe('');
      expect(sanitizeTextContent('\t\n')).toBe('');
    });
  });

  describe('XSS prevention', () => {
    it('removes script tags with content', () => {
      expect(sanitizeTextContent('<script>alert("xss")</script>')).toBe('');
    });

    it('removes script tags with attributes', () => {
      expect(sanitizeTextContent('<script type="text/javascript">malicious()</script>')).toBe('');
    });

    it('removes nested script tags', () => {
      expect(sanitizeTextContent('<script><script>inner</script></script>')).toBe('');
    });

    it('removes script tags case-insensitively', () => {
      expect(sanitizeTextContent('<SCRIPT>alert("xss")</SCRIPT>')).toBe('');
      expect(sanitizeTextContent('<ScRiPt>alert("xss")</sCrIpT>')).toBe('');
    });

    it('removes all HTML tags but keeps inner text', () => {
      expect(sanitizeTextContent('<b>hello</b>')).toBe('hello');
      expect(sanitizeTextContent('<div><p>text</p></div>')).toBe('text');
    });

    it('handles multiple tags', () => {
      expect(sanitizeTextContent('<a href="bad">link</a> and <b>bold</b>')).toBe('link and bold');
    });

    it('removes img tags with onerror handlers', () => {
      expect(sanitizeTextContent('<img src="x" onerror="alert(1)">')).toBe('');
    });

    it('removes event handler attributes in tags', () => {
      expect(sanitizeTextContent('<div onclick="evil()">text</div>')).toBe('text');
    });

    it('handles script tags with string literals containing closing tags', () => {
      // Edge case: script content contains "</script>" in a string
      // Current regex will stop at first </script>, leaving trailing content
      // This is acceptable behavior - the attack is still neutralized
      const result = sanitizeTextContent('<script>var x = "</script>"; alert(1);</script>');
      // The regex matches up to first </script>, leaving "; alert(1);</script>"
      // After HTML tag removal and cleanup, we get the remaining text
      expect(result).toContain('alert');
    });
  });

  describe('unicode normalization', () => {
    it('normalizes non-breaking spaces to regular spaces', () => {
      expect(sanitizeTextContent('hello\u00a0world')).toBe('hello world');
    });

    it('normalizes multiple non-breaking spaces', () => {
      expect(sanitizeTextContent('a\u00a0\u00a0b')).toBe('a b');
    });
  });

  describe('whitespace normalization', () => {
    it('converts CRLF to LF', () => {
      expect(sanitizeTextContent('line1\r\nline2')).toBe('line1\nline2');
    });

    it('collapses multiple spaces to single space', () => {
      expect(sanitizeTextContent('hello    world')).toBe('hello world');
    });

    it('collapses multiple tabs to single space', () => {
      expect(sanitizeTextContent('hello\t\t\tworld')).toBe('hello world');
    });

    it('removes trailing spaces before newlines', () => {
      expect(sanitizeTextContent('line1   \nline2')).toBe('line1\nline2');
    });

    it('collapses more than 2 consecutive newlines to 2', () => {
      expect(sanitizeTextContent('line1\n\n\n\nline2')).toBe('line1\n\nline2');
    });

    it('preserves single and double newlines', () => {
      expect(sanitizeTextContent('line1\nline2')).toBe('line1\nline2');
      expect(sanitizeTextContent('line1\n\nline2')).toBe('line1\n\nline2');
    });

    it('trims leading and trailing whitespace', () => {
      expect(sanitizeTextContent('  hello  ')).toBe('hello');
    });
  });

  describe('length limits', () => {
    it('truncates content exceeding 5000 characters', () => {
      const longString = 'a'.repeat(6000);
      const result = sanitizeTextContent(longString);
      expect(result.length).toBe(5000);
    });

    it('preserves content at exactly 5000 characters', () => {
      const exactString = 'b'.repeat(5000);
      const result = sanitizeTextContent(exactString);
      expect(result.length).toBe(5000);
      expect(result).toBe(exactString);
    });

    it('preserves content under 5000 characters', () => {
      const shortString = 'c'.repeat(4999);
      const result = sanitizeTextContent(shortString);
      expect(result.length).toBe(4999);
    });
  });

  describe('edge cases', () => {
    it('handles text with only HTML tags (becomes empty)', () => {
      expect(sanitizeTextContent('<div></div><span></span>')).toBe('');
    });

    it('handles mixed content correctly', () => {
      expect(sanitizeTextContent('  <b>Hello</b>   World  ')).toBe('Hello World');
    });

    it('preserves legitimate content', () => {
      expect(sanitizeTextContent('Hello, World!')).toBe('Hello, World!');
    });

    it('handles non-string input gracefully', () => {
      // TypeScript would catch this, but testing runtime safety
      expect(sanitizeTextContent(123 as any)).toBe('');
      expect(sanitizeTextContent({} as any)).toBe('');
    });
  });
});

describe('isValidSanitizedContent', () => {
  it('returns false when original had content but sanitized is empty (attack detected)', () => {
    expect(isValidSanitizedContent('<script>alert(1)</script>', '')).toBe(false);
  });

  it('returns false when sanitized result is empty', () => {
    expect(isValidSanitizedContent('', '')).toBe(false);
  });

  it('returns true when sanitized content is non-empty', () => {
    expect(isValidSanitizedContent('hello', 'hello')).toBe(true);
  });

  it('returns true when some content remains after sanitization', () => {
    expect(isValidSanitizedContent('<b>hello</b>', 'hello')).toBe(true);
  });

  it('returns false when original is null/undefined but sanitized is empty', () => {
    expect(isValidSanitizedContent(null, '')).toBe(false);
    expect(isValidSanitizedContent(undefined, '')).toBe(false);
  });

  it('handles whitespace-only original correctly', () => {
    // Original had only whitespace, sanitized is empty - this is a normal case, not an attack
    expect(isValidSanitizedContent('   ', '')).toBe(false);
  });
});

describe('sanitizeCommentContent', () => {
  it('returns sanitized content for valid input', () => {
    const result = sanitizeCommentContent('Hello, world!');
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe('Hello, world!');
    expect(result.error).toBeUndefined();
  });

  it('returns error for empty content', () => {
    const result = sanitizeCommentContent('');
    expect(result.isValid).toBe(false);
    expect(result.sanitized).toBe('');
    expect(result.error).toBe('Comment content cannot be empty');
  });

  it('returns error for null/undefined', () => {
    expect(sanitizeCommentContent(null).error).toBe('Comment content cannot be empty');
    expect(sanitizeCommentContent(undefined).error).toBe('Comment content cannot be empty');
  });

  it('returns error for potentially harmful content (attack detected)', () => {
    const result = sanitizeCommentContent('<script>alert("xss")</script>');
    expect(result.isValid).toBe(false);
    expect(result.sanitized).toBe('');
    expect(result.error).toBe('Comment content contains invalid or potentially harmful content');
  });

  it('strips HTML but preserves text content', () => {
    const result = sanitizeCommentContent('<b>bold</b> text');
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe('bold text');
  });

  it('returns error for whitespace-only content', () => {
    const result = sanitizeCommentContent('   ');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Comment content cannot be empty');
  });
});

describe('sanitizeDescription', () => {
  it('returns undefined for null/undefined', () => {
    expect(sanitizeDescription(null)).toBeUndefined();
    expect(sanitizeDescription(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(sanitizeDescription('')).toBeUndefined();
  });

  it('returns undefined for whitespace-only string', () => {
    expect(sanitizeDescription('   ')).toBeUndefined();
  });

  it('returns sanitized content for valid input', () => {
    expect(sanitizeDescription('Task description')).toBe('Task description');
  });

  it('strips HTML and returns text', () => {
    expect(sanitizeDescription('<p>Description</p>')).toBe('Description');
  });

  it('returns undefined for attack content that becomes empty', () => {
    // When sanitization removes all content (like script tags),
    // the result is empty string which returns undefined
    expect(sanitizeDescription('<script>evil()</script>')).toBeUndefined();
  });

  it('handles non-string input by returning undefined', () => {
    expect(sanitizeDescription(123 as any)).toBeUndefined();
  });

  it('handles description with only HTML tags that results in empty', () => {
    // Empty tags produce no text, should return undefined
    expect(sanitizeDescription('<div></div>')).toBeUndefined();
  });
});

describe('sanitizeName', () => {
  it('throws error for null/undefined', () => {
    expect(() => sanitizeName(null)).toThrow('Name is required');
    expect(() => sanitizeName(undefined)).toThrow('Name is required');
  });

  it('throws error for empty string', () => {
    // Empty string is falsy, so it's treated as "not provided"
    expect(() => sanitizeName('')).toThrow('Name is required');
  });

  it('throws error for whitespace-only string', () => {
    expect(() => sanitizeName('   ')).toThrow('Name cannot be empty');
  });

  it('returns sanitized name for valid input', () => {
    expect(sanitizeName('My Task')).toBe('My Task');
  });

  it('strips HTML and returns text', () => {
    expect(sanitizeName('<b>Task Name</b>')).toBe('Task Name');
  });

  it('throws error for attack content (XSS) that becomes empty', () => {
    // When sanitization removes all content, the result is empty
    // which triggers the "Name cannot be empty" error
    expect(() => sanitizeName('<script>alert(1)</script>')).toThrow(
      'Name cannot be empty'
    );
  });

  it('throws error for non-string input', () => {
    expect(() => sanitizeName(123 as any)).toThrow('Name is required');
  });

  it('trims whitespace from name', () => {
    expect(sanitizeName('  My Task  ')).toBe('My Task');
  });
});
