/**
 * Input Sanitization Utilities
 * 
 * Provides secure sanitization functions for user-provided content
 * to prevent injection attacks and ensure data integrity.
 */

/**
 * Sanitize user-provided text content for safe storage and transmission
 * Removes dangerous HTML tags, script content, and other potentially harmful input
 * 
 * @param input - The user input to sanitize
 * @returns Sanitized string safe for storage/transmission
 */
export function sanitizeTextContent(input: string | undefined | null): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Trim whitespace
  const trimmed = input.trim();
  
  if (trimmed.length === 0) {
    return '';
  }

  // Remove or escape potentially dangerous characters and patterns
  let sanitized = trimmed
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove HTML tags but keep the content
    .replace(/<[^>]*>/g, '')
    // Escape remaining angle brackets
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Escape quotes to prevent attribute injection
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    // Escape ampersands (but do it last to avoid double-escaping)
    .replace(/&(?!(lt|gt|quot|#39|amp);)/g, '&amp;');

  // Limit length to prevent abuse
  const MAX_COMMENT_LENGTH = 10000;
  if (sanitized.length > MAX_COMMENT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_COMMENT_LENGTH);
  }

  return sanitized;
}

/**
 * Validate that sanitized content is not empty after sanitization
 * 
 * @param original - Original user input
 * @param sanitized - Sanitized version
 * @returns True if content is valid after sanitization
 */
export function isValidSanitizedContent(original: string | undefined | null, sanitized: string): boolean {
  // If original had content but sanitized is empty, it was likely malicious
  if (original && original.trim().length > 0 && sanitized.length === 0) {
    return false;
  }
  
  // Must have some actual content
  return sanitized.length > 0;
}

/**
 * Sanitize and validate comment content
 * 
 * @param content - Comment content to sanitize
 * @returns Object with sanitized content and validation result
 */
export function sanitizeCommentContent(content: string | undefined | null): {
  sanitized: string;
  isValid: boolean;
  error?: string;
} {
  const sanitized = sanitizeTextContent(content);
  const isValid = isValidSanitizedContent(content, sanitized);
  
  if (!isValid && content && content.trim().length > 0) {
    return {
      sanitized: '',
      isValid: false,
      error: 'Comment content contains invalid or potentially harmful content'
    };
  }
  
  if (!isValid) {
    return {
      sanitized: '',
      isValid: false,
      error: 'Comment content cannot be empty'
    };
  }
  
  return {
    sanitized,
    isValid: true
  };
}